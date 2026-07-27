import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { shouldIgnoreLiveReloadPath } from "../src/platform/dev/liveReloadServer.js";
import { loadLocalEnv } from "../src/platform/env/loadLocalEnv.js";
import { readJsonRequest } from "../src/platform/http/readJsonRequest.js";
import { createStaticAssetServer } from "../src/platform/http/staticAssetServer.js";
import {
  createRuntimeArtifactPathResolver,
  isMutableRuntimeJsonPath,
  normalizeRuntimeCacheRelativePath
} from "../src/platform/runtime/runtimeCacheFiles.js";

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

test("static asset server serves app routes and disables mutable cache entries", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roamatlas-static-"));
  const repositoryRoot = path.join(temporaryRoot, "repository");
  const runtimeCacheRoot = path.join(temporaryRoot, "runtime-cache");
  await mkdir(repositoryRoot, { recursive: true });
  await mkdir(path.join(runtimeCacheRoot, "singapore", "image-jobs"), {
    recursive: true
  });
  await writeFile(
    path.join(repositoryRoot, "index.html"),
    "<html><body><main>RoamAtlas</main></body></html>"
  );
  await writeFile(
    path.join(runtimeCacheRoot, "singapore", "image-jobs", "page.json"),
    "{}"
  );

  try {
    const { serveStaticAsset } = createStaticAssetServer({
      repositoryRoot,
      runtimeCacheRoot,
      runtimeCacheUrlPrefix: "/runtime-cache",
      liveReloadScript: "<script>reload()</script>"
    });
    const appResponse = await serveStaticAsset("/singapore/place/marina-bay");
    assert.equal(appResponse.status, 200);
    const appBody = await appResponse.text();
    assert.match(appBody, /RoamAtlas/);
    assert.match(appBody, /reload\(\)/);
    assert.equal(appResponse.headers.get("Cache-Control"), "no-cache");

    const jobResponse = await serveStaticAsset(
      "/runtime-cache/singapore/image-jobs/page.json"
    );
    assert.equal(jobResponse.status, 200);
    assert.equal(jobResponse.headers.get("Cache-Control"), "no-store");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("live reload ignores generated country-card writes", () => {
  assert.equal(shouldIgnoreLiveReloadPath("country-cards/singapore.jpg"), true);
  assert.equal(
    shouldIgnoreLiveReloadPath("public/country-cards/singapore.jpg"),
    true
  );
  assert.equal(shouldIgnoreLiveReloadPath("src/features/explorer/view.ts"), false);
});
