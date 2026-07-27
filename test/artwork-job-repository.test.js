import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createArtworkJobRepository } from "../src/features/artwork/artworkJobRepository.js";

test("artwork job repository atomically persists and indexes terminal jobs", async (t) => {
  const runtimeCacheRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-job-repository-")
  );
  t.after(() => rm(runtimeCacheRoot, { recursive: true, force: true }));
  const repository = createArtworkJobRepository({
    runtimeCacheRoot,
    assertJobWritable() {}
  });
  const jobPath = path.join(
    runtimeCacheRoot,
    "singapore",
    "image-jobs",
    "overview.json"
  );

  await repository.writeJob(jobPath, {
    status: "pending_codex_image_generation",
    assetVersion: "asset-v1"
  });
  assert.equal(repository.isTerminal(jobPath), false);
  assert.equal((await repository.readJob(jobPath)).assetVersion, "asset-v1");

  await repository.writeJob(jobPath, {
    status: "ready",
    assetVersion: "asset-v1"
  });
  assert.equal(repository.isTerminal(jobPath), true);
  assert.deepEqual(await repository.listJobFiles(), [{
    fileName: "singapore/overview.json",
    jobPath
  }]);

  repository.clearTerminalUnder(
    path.join(runtimeCacheRoot, "singapore")
  );
  assert.equal(repository.isTerminal(jobPath), false);
});

test("artwork repository owns binary and JSON artifact persistence", async (t) => {
  const runtimeCacheRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-artifact-repository-")
  );
  t.after(() => rm(runtimeCacheRoot, { recursive: true, force: true }));
  const repository = createArtworkJobRepository({
    runtimeCacheRoot,
    assertJobWritable() {}
  });
  const imagePath = path.join(
    runtimeCacheRoot,
    "singapore",
    "flipbook",
    "overview.png"
  );
  const metadataPath = path.join(
    runtimeCacheRoot,
    "singapore",
    "flipbook",
    "overview.json"
  );

  await repository.writeBinaryArtifact(
    imagePath,
    Buffer.from("fixture-image")
  );
  await repository.writeJsonArtifact(metadataPath, {
    factBoundary: "Generated image is visual only."
  });

  assert.equal(
    (await readFile(imagePath)).toString(),
    "fixture-image"
  );
  assert.match(
    (await readFile(metadataPath, "utf8")),
    /Generated image is visual only/
  );
});

test("artwork job repository rejects paths outside its runtime root", async (t) => {
  const runtimeCacheRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-job-boundary-")
  );
  t.after(() => rm(runtimeCacheRoot, { recursive: true, force: true }));
  const repository = createArtworkJobRepository({
    runtimeCacheRoot,
    assertJobWritable() {}
  });

  await assert.rejects(
    repository.writeJob(
      path.join(runtimeCacheRoot, "..", "outside.json"),
      { status: "ready" }
    ),
    /outside the runtime cache/
  );
});
