import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createRuntimeCacheRepository } from "../src/features/runtimeCache/runtimeCacheRepository.js";
import { createRuntimeCacheService } from "../src/features/runtimeCache/runtimeCacheService.js";

test("visual cache flush removes only generated visual folders", async (t) => {
  const cacheRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-runtime-cache-")
  );
  t.after(() => rm(cacheRoot, { recursive: true, force: true }));
  const countryRoot = path.join(cacheRoot, "singapore");
  await Promise.all(
    ["image-jobs", "flipbook", "environment", "understanding", "starter-map"]
      .map((folder) => mkdir(path.join(countryRoot, folder), {
        recursive: true
      }))
  );
  const calls = [];
  const service = createRuntimeCacheService({
    repository: createRuntimeCacheRepository({
      runtimeCacheRoot: cacheRoot
    }),
    waitForArtworkCreations: async (countrySlug) => {
      calls.push(`wait:${countrySlug}`);
    },
    cancelArtworkForCountry: () => {
      calls.push("cancel:artwork");
      return [];
    },
    cancelEnvironmentForCountry: () => {
      calls.push("cancel:environment");
      return [];
    },
    clearArtworkRuntimeMemory: () => {
      calls.push("clear:artwork");
    },
    clearPlaceImageRuntimeMemory: () => {
      calls.push("clear:place-images");
    },
    clearCountryDraftRuntimeMemory: () => {
      calls.push("clear:country-draft");
    }
  });

  const result = await service.flushVisualCache("singapore");

  await assert.rejects(stat(path.join(countryRoot, "image-jobs")));
  assert.equal((await stat(path.join(countryRoot, "starter-map"))).isDirectory(), true);
  assert.deepEqual(result.preservedFolders, [
    "starter-map",
    "country-pack-draft",
    "place-images"
  ]);
  assert.deepEqual(calls, [
    "wait:singapore",
    "cancel:artwork",
    "cancel:environment",
    "clear:artwork"
  ]);
});

test("runtime cache service rejects traversal outside its cache root", async () => {
  const service = createRuntimeCacheService({
    repository: createRuntimeCacheRepository({
      runtimeCacheRoot: "/tmp/roamatlas-cache"
    }),
    waitForArtworkCreations: async () => {},
    cancelArtworkForCountry: () => [],
    cancelEnvironmentForCountry: () => [],
    clearArtworkRuntimeMemory: () => {},
    clearPlaceImageRuntimeMemory: () => {},
    clearCountryDraftRuntimeMemory: () => {}
  });

  await assert.rejects(
    service.flushRuntimeCache("../outside"),
    /Unsafe runtime cache path/
  );
});
