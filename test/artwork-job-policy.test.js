import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseHigherPriorityJobKind,
  createArtworkJobPolicy,
  isTransientGenerationError,
  shouldProcessJob,
  shouldQueueEnvironmentPlanForJobKind
} from "../apps/api/src/features/artwork/artworkJobProcessingPolicy.ts";

test("artwork job policy keeps interactive work ahead of speculative work", () => {
  assert.equal(
    chooseHigherPriorityJobKind("prefetch", "interactive"),
    "interactive"
  );
  assert.equal(
    chooseHigherPriorityJobKind("interactive", "prefetch"),
    "interactive"
  );
  assert.equal(shouldQueueEnvironmentPlanForJobKind("prefetch"), false);
  assert.equal(shouldQueueEnvironmentPlanForJobKind("interactive"), true);
});

test("artwork job policy gates processing by retry time and flush state", () => {
  const job = {
    status: "pending_codex_image_generation",
    autoProcess: true,
    assetVersion: "version",
    prompt: "draw Singapore",
    retryNotBefore: "2026-01-01T00:00:10.000Z"
  };

  assert.equal(
    shouldProcessJob({
      job,
      jobPath: "/cache/job.json",
      processingJobs: new Map(),
      isPathBeingFlushed: () => false,
      now: Date.parse("2026-01-01T00:00:09.000Z")
    }),
    false
  );
  assert.equal(
    shouldProcessJob({
      job,
      jobPath: "/cache/job.json",
      processingJobs: new Map(),
      isPathBeingFlushed: () => false,
      now: Date.parse("2026-01-01T00:00:11.000Z")
    }),
    true
  );
  assert.equal(isTransientGenerationError(new Error("429 rate limit")), true);
  assert.equal(isTransientGenerationError(new Error("invalid request")), false);
});

test("artwork asset identity includes normalized quality and pack versions", () => {
  const policy = createArtworkJobPolicy({
    imageConfig: {
      quality: "medium",
      fallbackModel: "fallback-image-model",
      size: "1536x1024",
      outputFormat: "png",
      outputCompression: 80
    },
    getCountryPackForPage: () => ({
      versions: {
        prompt: "prompt-v1",
        style: "style-v1",
        data: "data-v1"
      },
      scenes: {}
    }),
    normalizeImageQuality: (quality) => String(quality).toLowerCase()
  });
  const page = { id: "singapore", plan: {} };

  const medium = policy.createAssetVersion(page, {
    imageModel: "gpt-image-2",
    prompt: "Singapore",
    imageQuality: "MEDIUM"
  });
  const high = policy.createAssetVersion(page, {
    imageModel: "gpt-image-2",
    prompt: "Singapore",
    imageQuality: "HIGH"
  });

  assert.notEqual(medium, high);
});
