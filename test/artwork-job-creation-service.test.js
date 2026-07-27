import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createArtworkJobCreationService } from "../src/features/artwork/artworkJobCreationService.js";

test("artwork creation persists a pending job without calling the image provider", async (t) => {
  const cacheRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-artwork-creation-")
  );
  t.after(() => rm(cacheRoot, { recursive: true, force: true }));
  const writtenJobs = [];
  let providerCalls = 0;
  let processingRequests = 0;
  const service = createArtworkJobCreationService({
    runtimeCacheRoot: cacheRoot,
    imageConfig: {
      quality: "medium",
      outputFormat: "png"
    },
    configuredImageProvider: {
      model: "mock-image-model",
      provider: "mock",
      canAutoProcess: false,
      normalizeQuality: (quality) => quality,
      generate: async () => {
        providerCalls += 1;
        throw new Error("creation must not call the provider");
      }
    },
    jobRepository: {
      readJob: async () => null,
      readMetadata: async () => null,
      isFileAvailable: async () => false,
      writeJob: async (jobPath, job) => {
        writtenJobs.push({ jobPath, job });
      }
    },
    environmentPlanQueue: {
      findMatchingPlan: async () => null,
      queuePlan: () => {}
    },
    jobPolicy: {
      createAssetVersion: () => "asset-v1",
      chooseHigherPriorityJobKind: (_, requested) => requested,
      shouldQueueEnvironmentPlanForJobKind: () => true
    },
    processingJobs: new Map(),
    getCountrySlugForPage: () => "singapore",
    ensurePageUnderstanding: async () => {},
    getCountryCacheFlushRun: () => null,
    requestProcessing: () => {
      processingRequests += 1;
    }
  });

  const result = await service.createImageJob({
    id: "singapore-overview",
    sceneId: "singapore-overview",
    nodeId: "singapore",
    plan: {
      title: "Singapore",
      pageType: "homepage",
      imagePrompt: "Draw a visual-only Singapore overview."
    }
  });

  assert.equal(providerCalls, 0);
  assert.equal(processingRequests, 1);
  assert.equal(writtenJobs.length, 1);
  assert.equal(writtenJobs[0].job.status, "pending_codex_image_generation");
  assert.equal(writtenJobs[0].job.autoProcess, false);
  assert.equal(result.status, "pending_codex_image_generation");
  assert.match(result.generated.factBoundary, /visual only/);
});
