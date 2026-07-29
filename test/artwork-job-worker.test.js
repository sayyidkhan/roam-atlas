import assert from "node:assert/strict";
import test from "node:test";

import { createArtworkJobWorker } from "../apps/api/src/features/artwork/artworkJobWorker.ts";

test("artwork worker persists partial and ready artifacts with a visual-only boundary", async () => {
  const repository = createMemoryJobRepository();
  const queuedPlans = [];
  const understoodPages = [];
  let processingRequests = 0;
  const worker = createArtworkJobWorker({
    runtimeCacheRoot: "/tmp/roamatlas-worker-test",
    imageConfig: {
      quality: "medium",
      outputFormat: "png",
      outputCompression: 80
    },
    configuredImageProvider: {
      model: "mock-image-model",
      provider: "mock",
      async generate({ onPartialImage }) {
        await onPartialImage({
          b64Json: Buffer.from("partial").toString("base64"),
          partialImageIndex: 1
        });
        return {
          b64Json: Buffer.from("ready").toString("base64"),
          provider: "mock",
          model: "mock-image-model",
          quality: "medium",
          outputFormat: "png"
        };
      }
    },
    jobRepository: repository,
    environmentPlanQueue: {
      queuePlan(input) {
        queuedPlans.push(input);
      }
    },
    jobPolicy: {
      shouldQueueEnvironmentPlanForJobKind: () => true,
      isTransientGenerationError: () => false
    },
    getCountrySlugForJob: () => "singapore",
    async ensurePageUnderstanding(page) {
      understoodPages.push(page);
    },
    requestProcessing() {
      processingRequests += 1;
    },
    logger: { error() {} }
  });
  const jobPath = "/tmp/roamatlas-worker-test/image-jobs/page.json";
  repository.seed(jobPath, createPendingJob());

  await worker.run(jobPath, repository.current(jobPath));

  const readyJob = repository.current(jobPath);
  assert.equal(readyJob.status, "ready");
  assert.equal(readyJob.environmentStatus, "pending");
  assert.match(repository.jsonArtifacts[0].value.factBoundary, /not a fact source/);
  assert.equal(repository.binaryArtifacts.length, 2);
  assert.equal(queuedPlans.length, 1);
  assert.equal(understoodPages.length, 1);
  assert.equal(processingRequests, 1);
});

test("artwork worker schedules bounded retries for transient provider failures", async () => {
  const repository = createMemoryJobRepository();
  const worker = createArtworkJobWorker({
    runtimeCacheRoot: "/tmp/roamatlas-worker-retry-test",
    imageConfig: {
      quality: "medium",
      outputFormat: "png",
      outputCompression: 80
    },
    configuredImageProvider: {
      model: "mock-image-model",
      provider: "mock",
      async generate() {
        const error = new Error("provider busy");
        error.retryAfterMs = 2_000;
        throw error;
      }
    },
    jobRepository: repository,
    environmentPlanQueue: { queuePlan() {} },
    jobPolicy: {
      shouldQueueEnvironmentPlanForJobKind: () => true,
      isTransientGenerationError: () => true
    },
    getCountrySlugForJob: () => "singapore",
    async ensurePageUnderstanding() {},
    requestProcessing() {},
    logger: { error() {} }
  });
  const jobPath = "/tmp/roamatlas-worker-retry-test/image-jobs/page.json";
  repository.seed(jobPath, createPendingJob());

  await worker.run(jobPath, repository.current(jobPath));

  const retryJob = repository.current(jobPath);
  assert.equal(retryJob.status, "pending_codex_image_generation");
  assert.equal(retryJob.transientError, true);
  assert.match(retryJob.error, /provider busy/);
  assert.ok(Date.parse(retryJob.retryNotBefore) > Date.now());
});

function createPendingJob() {
  return {
    pageId: "singapore-overview",
    sceneId: "singapore-overview",
    nodeId: "singapore",
    assetVersion: "0123456789abcdef",
    status: "pending_codex_image_generation",
    jobKind: "interactive",
    prompt: "Draw visual-only Singapore artwork.",
    imageQuality: "medium",
    title: "Singapore",
    pageType: "homepage"
  };
}

function createMemoryJobRepository() {
  const jobs = new Map();
  const binaryArtifacts = [];
  const jsonArtifacts = [];
  return {
    binaryArtifacts,
    jsonArtifacts,
    seed(jobPath, job) {
      jobs.set(jobPath, { ...job });
    },
    current(jobPath) {
      return jobs.get(jobPath);
    },
    async readJob(jobPath) {
      return jobs.get(jobPath);
    },
    async writeJob(jobPath, job) {
      jobs.set(jobPath, { ...job });
    },
    async writeBinaryArtifact(filePath, bytes, jobPath) {
      binaryArtifacts.push({ filePath, bytes, jobPath });
    },
    async writeJsonArtifact(filePath, value, jobPath) {
      jsonArtifacts.push({ filePath, value, jobPath });
    },
    clearTerminalUnder() {}
  };
}
