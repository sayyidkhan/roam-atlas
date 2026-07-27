import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ROAMATLAS_EXPERIENCE_CONFIG,
  resolveRoamAtlasExperienceConfig
} from "../packages/atlas-data/src/experienceConfig.js";
import {
  isStaleProcessingImageJob,
  selectImageJobsForProcessing
} from "../apps/api/src/domain/imageJobQueue.js";

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
  const source = await readFile(
    new URL("../apps/api/src/features/artwork/artworkJobService.js", import.meta.url),
    "utf8"
  );
  const workerStart = source.indexOf("async function processJob");
  const worker = source.slice(workerStart);

  const readyWrite = worker.indexOf('status: "ready"');
  const environmentQueue = worker.indexOf(
    "environmentPlanQueue.queuePlan({ page: readyPage"
  );
  assert.ok(readyWrite >= 0);
  assert.ok(environmentQueue > readyWrite);
  assert.doesNotMatch(worker, /await ensureEnvironmentPlanForPage/);
  assert.match(worker, /status: "partial_ready"/);
  assert.match(worker, /processingStartedAt/);
  assert.match(worker, /metadataWrittenAt/);
  assert.match(worker, /shouldQueueEnvironmentPlanForJobKind\(completedJobKind\)/);
});

test("finished pages map their targets while unrelated image jobs continue", async () => {
  const worker = await readFile(
    new URL(
      "../apps/api/src/features/artwork/environmentPlanQueue.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(worker, /pendingPlans\.size === 0/);
  assert.match(worker, /ensurePlan\(task\.page/);
  assert.doesNotMatch(worker, /processingJobs/);
  assert.doesNotMatch(worker, /scheduleProcessing\(1000\)/);
});

test("server forwards optimized image options and stores versioned partial assets", async () => {
  const source = await readFile(new URL("../apps/api/src/main.ts", import.meta.url), "utf8");
  const jobService = await readFile(
    new URL("../apps/api/src/features/artwork/artworkJobService.js", import.meta.url),
    "utf8"
  );
  const jobCreationService = await readFile(
    new URL(
      "../apps/api/src/features/artwork/artworkJobCreationService.js",
      import.meta.url
    ),
    "utf8"
  );
  const configuredProvider = await readFile(
    new URL("../apps/api/src/features/artwork/configuredImageProvider.js", import.meta.url),
    "utf8"
  );
  const jobRepository = await readFile(
    new URL("../apps/api/src/features/artwork/artworkJobRepository.js", import.meta.url),
    "utf8"
  );
  const jobPolicy = await readFile(
    new URL(
      "../apps/api/src/features/artwork/artworkJobProcessingPolicy.js",
      import.meta.url
    ),
    "utf8"
  );
  const clickResolver = await readFile(
    new URL("../apps/api/src/features/explorer/openAIClickResolver.js", import.meta.url),
    "utf8"
  );
  const runtimeCacheService = await readFile(
    new URL(
      "../apps/api/src/features/runtimeCache/runtimeCacheService.js",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(jobPolicy, /createImageVariantKey/);
  assert.match(jobService, /variantKey: job\.assetVersion/);
  assert.match(jobService, /paths\.partialImagePath/);
  assert.match(configuredProvider, /partialImages: imageConfig\.partialImages/);
  assert.match(configuredProvider, /outputCompression: imageConfig\.outputCompression/);
  assert.match(jobService, /for \(const jobPath of processingJobs\.keys\(\)\)/);
  assert.match(jobService, /jobRepository\.isTerminal\(jobPath\)/);
  assert.match(jobCreationService, /cachedImageAvailable/);
  assert.match(jobRepository, /await stat\(filePath\)/);
  assert.match(clickResolver, /No marker was drawn on this image/);
  assert.match(clickResolver, /const markerInstruction = imageMarked/);
  assert.match(clickResolver, /const targetInstruction = imageMarked/);
  assert.match(jobService, /processingJobAbortControllers/);
  assert.match(jobCreationService, /Promise\.allSettled/);
  assert.match(runtimeCacheService, /cancelEnvironmentForCountry/);
  assert.match(jobService, /error\?\.retryAfterMs/);
  assert.match(runtimeCacheService, /countryCacheFlushRuns/);
  assert.match(jobCreationService, /beginCountryJobCreation/);
  assert.match(jobRepository, /await rename\(temporaryPath, jobPath\)/);
});

test("selected image quality controls provider generation and cache identity", async () => {
  const source = await readFile(new URL("../apps/api/src/main.ts", import.meta.url), "utf8");
  const jobService = await readFile(
    new URL("../apps/api/src/features/artwork/artworkJobService.js", import.meta.url),
    "utf8"
  );
  const provider = await readFile(
    new URL("../apps/api/src/features/artwork/configuredImageProvider.js", import.meta.url),
    "utf8"
  );
  const artworkHandler = await readFile(
    new URL("../apps/api/src/features/artwork/artworkHttpHandler.js", import.meta.url),
    "utf8"
  );
  const assetVersion = await readFile(
    new URL(
      "../apps/api/src/features/artwork/artworkJobProcessingPolicy.js",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(source, /defaultImageQuality: appConfig\.image\.quality/);
  assert.match(source, /createArtworkRoutes/);
  assert.match(artworkHandler, /handleArtworkHttpRequest/);
  assert.match(artworkHandler, /url\.searchParams\.get\("quality"\)/);
  assert.match(artworkHandler, /imageQuality: normalizeImageQuality\(query\.quality\)/);
  assert.match(assetVersion, /quality: normalizeImageQuality\(imageQuality\)/);
  assert.match(jobService, /quality: job\.imageQuality/);
  assert.match(provider, /quality: normalizeQuality\(quality\)/);
  assert.match(provider, /\["low", "medium", "high"\]\.includes\(normalized\)/);
});
