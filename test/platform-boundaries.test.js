import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLocalEnv } from "../apps/api/src/platform/env/loadLocalEnv.js";
import { readJsonRequest } from "../apps/api/src/platform/http/readJsonRequest.js";
import { serveRuntimeArtifact } from "../apps/api/src/features/runtimeCache/runtimeArtifactHttpHandler.js";
import {
  createRuntimeArtifactPathResolver,
  isMutableRuntimeJsonPath,
  normalizeRuntimeCacheRelativePath
} from "../apps/api/src/platform/runtime/runtimeCacheFiles.js";

test("JSON request reader treats an empty request as an empty object", async () => {
  assert.deepEqual(
    await readJsonRequest(new Request("http://localhost", { method: "POST" })),
    {}
  );
  assert.deepEqual(
    await readJsonRequest(new Request("http://localhost", {
      method: "POST",
      body: '{"countrySlug":"singapore"}'
    })),
    { countrySlug: "singapore" }
  );
});

test("local environment loader preserves explicit blank test overrides", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roamatlas-env-"));
  const envPath = path.join(temporaryRoot, ".env");
  try {
    await writeFile(
      envPath,
      'OPENAI_API_KEY="local-secret"\nEXA_API_KEY=local-exa\nNEW_SETTING=enabled\n'
    );
    const environment = { OPENAI_API_KEY: "", EXA_API_KEY: "" };
    loadLocalEnv(envPath, environment);

    assert.equal(environment.OPENAI_API_KEY, "");
    assert.equal(environment.EXA_API_KEY, "");
    assert.equal(environment.NEW_SETTING, "enabled");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("runtime cache paths preserve compatibility and reject traversal", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roamatlas-runtime-"));
  const repositoryRoot = path.join(temporaryRoot, "repository");
  const runtimeCacheRoot = path.join(temporaryRoot, "runtime-cache");
  await mkdir(repositoryRoot, { recursive: true });
  await mkdir(runtimeCacheRoot, { recursive: true });

  try {
    const resolveArtifactPath = createRuntimeArtifactPathResolver({
      repositoryRoot,
      runtimeCacheRoot,
      runtimeCacheUrlPrefix: "/runtime-cache"
    });

    assert.equal(
      normalizeRuntimeCacheRelativePath("singapore/codex-jobs/page.json"),
      "singapore/image-jobs/page.json"
    );
    assert.equal(isMutableRuntimeJsonPath("singapore/image-jobs/page.json"), true);
    assert.equal(
      resolveArtifactPath("/runtime-cache/singapore/flipbook/page.png"),
      path.join(runtimeCacheRoot, "singapore/flipbook/page.png")
    );
    assert.equal(resolveArtifactPath("/runtime-cache/../outside.png"), null);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("runtime artifact server disables cache for mutable job entries", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roamatlas-static-"));
  const runtimeCacheRoot = path.join(temporaryRoot, "runtime-cache");
  await mkdir(path.join(runtimeCacheRoot, "singapore", "image-jobs"), {
    recursive: true
  });
  await writeFile(
    path.join(runtimeCacheRoot, "singapore", "image-jobs", "page.json"),
    "{}"
  );

  try {
    const jobResponse = await serveRuntimeArtifact({
      pathname: "/runtime-cache/singapore/image-jobs/page.json",
      runtimeCacheRoot,
      runtimeCacheUrlPrefix: "/runtime-cache"
    });
    assert.equal(jobResponse.status, 200);
    assert.equal(jobResponse.headers.get("Cache-Control"), "no-store");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
