import assert from "node:assert/strict";
import test from "node:test";

import { createArtworkJobCreationGuard } from "../apps/api/src/features/artwork/artworkJobCreationGuard.ts";
import { createArtworkJobReuseService } from "../apps/api/src/features/artwork/artworkJobReuseService.ts";

test("artwork creation waits for a country flush and exposes active work", async () => {
  let releaseFlush;
  let flushRun = new Promise((resolve) => {
    releaseFlush = resolve;
  });
  const guard = createArtworkJobCreationGuard({
    getCountryCacheFlushRun: () => flushRun
  });

  const beginRun = guard.begin("singapore");
  let creationStarted = false;
  beginRun.then(() => {
    creationStarted = true;
  });
  await Promise.resolve();
  assert.equal(creationStarted, false);

  flushRun = null;
  releaseFlush();
  const releaseCreation = await beginRun;

  let countrySettled = false;
  const waitRun = guard.waitForCountry("singapore").then(() => {
    countrySettled = true;
  });
  await Promise.resolve();
  assert.equal(countrySettled, false);

  releaseCreation();
  await waitRun;
  assert.equal(countrySettled, true);
});

test("artwork reuse promotes an active speculative job without losing its fact boundary", async () => {
  const writes = [];
  let processingRequests = 0;
  const processingJobs = new Map([["/tmp/job.json", "prefetch"]]);
  const reuseService = createArtworkJobReuseService({
    configuredImageProvider: {
      provider: "mock",
      canAutoProcess: true
    },
    jobRepository: {
      async writeJob(jobPath, job) {
        writes.push({ jobPath, job });
      }
    },
    environmentPlanQueue: {
      async findMatchingPlan() {
        return null;
      },
      queuePlan() {}
    },
    jobPolicy: {
      chooseHigherPriorityJobKind: () => "interactive",
      shouldQueueEnvironmentPlanForJobKind: () => true
    },
    processingJobs,
    async ensurePageUnderstanding() {},
    requestProcessing() {
      processingRequests += 1;
    }
  });

  const result = await reuseService.promoteExistingJob({
    page: { id: "singapore-overview" },
    countrySlug: "singapore",
    assetVersion: "asset-v1",
    existingJob: {
      status: "processing_openai_image",
      jobKind: "prefetch",
      autoProcess: false,
      partialImageUrl: "/runtime-cache/singapore/partial.webp"
    },
    jobKind: "interactive",
    jobPath: "/tmp/job.json",
    jobUrl: "/runtime-cache/singapore/job.json"
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].job.jobKind, "interactive");
  assert.equal(writes[0].job.autoProcess, true);
  assert.equal(processingJobs.get("/tmp/job.json"), "interactive");
  assert.equal(processingRequests, 1);
  assert.match(result.generated.factBoundary, /not a fact source/);
});
