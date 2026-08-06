import assert from "node:assert/strict";
import test from "node:test";

import {
  createCountryArtworkQualityLockService
} from "../apps/api/src/features/artwork/countryArtworkQualityLockService.ts";

test("country artwork quality is fixed after the first generation request", async () => {
  const repository = createJobRepository();
  const service = createCountryArtworkQualityLockService({
    runtimeCacheRoot: "/runtime-cache",
    jobRepository: repository,
    normalizeImageQuality: (value) => String(value).toLowerCase()
  });

  assert.equal(
    await service.lockImageQuality("singapore", "HIGH"),
    "high"
  );
  assert.equal(
    await service.getLockedImageQuality("singapore"),
    "high"
  );
  assert.equal(
    await service.lockImageQuality("singapore", "medium"),
    "high",
    "stale clients cannot create a second visual-quality variant"
  );
});

test("an existing artwork job is treated as a lock until visual cache reset", async () => {
  const repository = createJobRepository([
    {
      jobPath: "/runtime-cache/singapore/image-jobs/overview.json",
      job: { countrySlug: "singapore", imageQuality: "medium", status: "ready" }
    }
  ]);
  const service = createCountryArtworkQualityLockService({
    runtimeCacheRoot: "/runtime-cache",
    jobRepository: repository,
    normalizeImageQuality: (value) => String(value).toLowerCase()
  });

  assert.equal(
    await service.getLockedImageQuality("singapore"),
    "medium"
  );
  assert.equal(
    await service.lockImageQuality("singapore", "high"),
    "medium"
  );
});

function createJobRepository(seed = []) {
  const records = new Map(seed.map(({ jobPath, job }) => [jobPath, job]));
  return {
    async listJobFiles() {
      return [...records.keys()].map((jobPath) => ({ jobPath, fileName: jobPath }));
    },
    async readJob(jobPath) {
      return records.get(jobPath) ?? null;
    },
    async writeJsonArtifact(artifactPath, payload) {
      records.set(artifactPath, payload);
    }
  };
}
