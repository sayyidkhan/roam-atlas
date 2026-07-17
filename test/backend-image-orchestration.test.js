import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ROAMATLAS_EXPERIENCE_CONFIG,
  resolveRoamAtlasExperienceConfig
} from "../src/config/experienceConfig.js";
import {
  isStaleProcessingImageJob,
  selectImageJobsForProcessing
} from "../src/domain/imageJobQueue.js";

const entry = (fileName, jobKind, createdAt = "2026-01-01T00:00:00.000Z") => ({
  fileName,
  jobPath: `/tmp/${fileName}`,
  job: {
    jobKind,
    status: "pending_codex_image_generation",
    createdAt
  }
});

test("experience config separates provider capacity, reserved slots, and prefetch breadth", () => {
  const defaults = resolveRoamAtlasExperienceConfig({});
  assert.equal(ROAMATLAS_EXPERIENCE_CONFIG.providerConcurrency, 10);
  assert.equal(defaults.providerConcurrency, 10);
  assert.equal(defaults.interactiveReservedSlots, 1);
  assert.equal(defaults.prefetchDestinationLimit, 10);
  assert.equal(defaults.maxParallelImageJobs, 10);

  const explicit = resolveRoamAtlasExperienceConfig({
    ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY: "5",
    ROAMATLAS_INTERACTIVE_RESERVED_SLOTS: "2",
    ROAMATLAS_PREFETCH_DESTINATION_LIMIT: "4"
  });
  assert.deepEqual(
    {
      providerConcurrency: explicit.providerConcurrency,
      interactiveReservedSlots: explicit.interactiveReservedSlots,
      prefetchDestinationLimit: explicit.prefetchDestinationLimit
    },
    { providerConcurrency: 5, interactiveReservedSlots: 2, prefetchDestinationLimit: 4 }
  );
});

test("legacy parallel setting remains compatible with both old clients and server capacity", () => {
  const config = resolveRoamAtlasExperienceConfig({
    ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS: "4"
  });
  assert.equal(config.maxParallelImageJobs, 4);
  assert.equal(config.providerConcurrency, 4);
  assert.equal(config.prefetchDestinationLimit, 4);
});

test("legacy zero keeps paid image processing disabled", () => {
  const config = resolveRoamAtlasExperienceConfig({
    ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS: "0"
  });
  assert.equal(config.maxParallelImageJobs, 0);
  assert.equal(config.providerConcurrency, 0);
  assert.equal(config.interactiveReservedSlots, 0);
  assert.equal(config.prefetchDestinationLimit, 0);
  assert.deepEqual(
    selectImageJobsForProcessing({
      jobs: [entry("interactive", "interactive")],
      providerConcurrency: 0,
      interactiveReservedSlots: 0
    }),
    []
  );
});

test("a single provider slot stays usable for background work", () => {
  const config = resolveRoamAtlasExperienceConfig({
    ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY: "1"
  });
  assert.equal(config.providerConcurrency, 1);
  assert.equal(config.interactiveReservedSlots, 0);
  assert.deepEqual(
    selectImageJobsForProcessing({
      jobs: [entry("prefetch", "prefetch")],
      providerConcurrency: config.providerConcurrency,
      interactiveReservedSlots: config.interactiveReservedSlots
    }).map((item) => item.fileName),
    ["prefetch"]
  );
});

test("background jobs cannot consume the interactive reserved slot", () => {
  const selected = selectImageJobsForProcessing({
    jobs: [entry("a", "prefetch"), entry("b", "artwork"), entry("c", "prewarm")],
    providerConcurrency: 3,
    interactiveReservedSlots: 1
  });
  assert.deepEqual(selected.map((item) => item.fileName), ["a", "b"]);
});

test("interactive work can use reserved capacity while background work is running", () => {
  const selected = selectImageJobsForProcessing({
    jobs: [entry("interactive", "interactive"), entry("background", "prefetch")],
    runningJobKinds: ["prefetch", "prewarm"],
    providerConcurrency: 3,
    interactiveReservedSlots: 1
  });
  assert.deepEqual(selected.map((item) => item.fileName), ["interactive"]);
});

test("processing and partial jobs become recoverable only after their lease expires", () => {
  const now = Date.parse("2026-01-01T00:20:00.000Z");
  assert.equal(
    isStaleProcessingImageJob(
      { status: "partial_ready", processingStartedAt: "2026-01-01T00:00:00.000Z" },
      { now, leaseMs: 10 * 60 * 1000 }
    ),
    true
  );
  assert.equal(
    isStaleProcessingImageJob(
      { status: "processing_openai_image", processingStartedAt: "2026-01-01T00:15:00.000Z" },
      { now, leaseMs: 10 * 60 * 1000 }
    ),
    false
  );
});

test("server publishes final readiness before queuing environment analysis", async () => {
  const source = await readFile(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const workerStart = source.indexOf("async function processCodexImageJob");
  const workerEnd = source.indexOf("function isTransientImageGenerationError", workerStart);
  const worker = source.slice(workerStart, workerEnd);

  const readyWrite = worker.indexOf('status: "ready"');
  const environmentQueue = worker.indexOf("queueEnvironmentPlan({ page: readyPage");
  assert.ok(readyWrite >= 0);
  assert.ok(environmentQueue > readyWrite);
  assert.doesNotMatch(worker, /await ensureEnvironmentPlanForPage/);
  assert.match(worker, /status: "partial_ready"/);
  assert.match(worker, /processingStartedAt/);
  assert.match(worker, /metadataWrittenAt/);
  assert.match(worker, /shouldQueueEnvironmentPlanForJobKind\(completedJobKind\)/);
});

test("finished pages map their targets while unrelated image jobs continue", async () => {
  const source = await readFile(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const workerStart = source.indexOf("async function processNextEnvironmentPlan");
  const workerEnd = source.indexOf("async function updateReadyJobForImage", workerStart);
  const worker = source.slice(workerStart, workerEnd);

  assert.match(worker, /pendingEnvironmentPlans\.size === 0/);
  assert.match(worker, /ensureEnvironmentPlanForPage\(task\.page/);
  assert.doesNotMatch(worker, /processingJobs/);
  assert.doesNotMatch(worker, /scheduleEnvironmentPlanProcessing\(1000\)/);
});

test("server forwards optimized image options and stores versioned partial assets", async () => {
  const source = await readFile(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(source, /createImageVariantKey/);
  assert.match(source, /variantKey: job\.assetVersion/);
  assert.match(source, /paths\.partialImagePath/);
  assert.match(source, /partialImages: appConfig\.image\.partialImages/);
  assert.match(source, /outputCompression: appConfig\.image\.outputCompression/);
  assert.match(source, /for \(const jobPath of processingJobs\.keys\(\)\)/);
  assert.match(source, /terminalImageJobs\.has\(jobPath\)/);
  assert.match(source, /cachedImageAvailable/);
  assert.match(source, /await stat\(filePath\)/);
  assert.match(source, /No marker was drawn on this image/);
  assert.match(source, /const markerInstruction = markedImage/);
  assert.match(source, /const targetInstruction = markedImage/);
  assert.match(source, /processingJobAbortControllers/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /cancelEnvironmentPlansForCountry/);
  assert.match(source, /error\?\.retryAfterMs/);
  assert.match(source, /countryCacheFlushRuns/);
  assert.match(source, /beginCountryImageJobCreation/);
  assert.match(source, /await rename\(tempPath, jobPath\)/);
});

test("selected image quality controls provider generation and cache identity", async () => {
  const source = await readFile(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const assetVersionStart = source.indexOf("function createAssetVersionForPage");
  const assetVersionEnd = source.indexOf("function getCountryPackForPage", assetVersionStart);
  const assetVersion = source.slice(assetVersionStart, assetVersionEnd);
  const providerStart = source.indexOf("async function generateConfiguredImage");
  const providerEnd = source.indexOf("async function resolveClickPhraseWithOpenAI", providerStart);
  const provider = source.slice(providerStart, providerEnd);

  assert.match(source, /defaultImageQuality: appConfig\.image\.quality/);
  assert.match(source, /url\.searchParams\.get\("quality"\)/);
  assert.match(source, /imageQuality: normalizeRequestedImageQuality\(imageQuality\)/);
  assert.match(assetVersion, /quality: normalizeRequestedImageQuality\(imageQuality\)/);
  assert.match(source, /quality: job\.imageQuality/);
  assert.match(provider, /quality: normalizeRequestedImageQuality\(quality\)/);
  assert.match(provider, /\["low", "medium", "high"\]\.includes\(normalized\)/);
});
