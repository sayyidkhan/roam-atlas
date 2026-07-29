import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLocalEnv } from "../apps/api/src/platform/env/loadLocalEnv.ts";
import {
  HttpRequestError,
  readJsonRequest
} from "../apps/api/src/platform/http/readJsonRequest.ts";
import {
  createMediaDownloadOptions,
  createMediaMetadataFetchOptions,
  mediaImageExtension
} from "../apps/api/src/platform/media/mediaFetch.ts";
import { serveRuntimeArtifact } from "../apps/api/src/features/runtimeCache/runtimeArtifactHttpHandler.ts";
import {
  createRuntimeArtifactPathResolver,
  isMutableRuntimeJsonPath,
  normalizeRuntimeCacheRelativePath
} from "../apps/api/src/platform/runtime/runtimeCacheFiles.ts";

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

test("JSON request reader exposes typed 400 and 413 failures", async () => {
  await assert.rejects(
    readJsonRequest(
      new Request("http://localhost", {
        method: "POST",
        body: "{invalid"
      })
    ),
    (error) =>
      error instanceof HttpRequestError &&
      error.statusCode === 400
  );
  await assert.rejects(
    readJsonRequest(
      new Request("http://localhost", {
        method: "POST",
        body: '{"countrySlug":"singapore"}'
      }),
      { maxBodyBytes: 4 }
    ),
    (error) =>
      error instanceof HttpRequestError &&
      error.statusCode === 413
  );
});

test("local environment loader preserves explicit blank test overrides", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roamatlas-env-"));
  const envPath = path.join(temporaryRoot, ".env");
  try {
    await writeFile(
      envPath,
      'OPENAI_API_KEY="local-secret"\nEXA_API_KEY=local-exa\nNEW_SETTING=enabled\nINVALID-KEY=ignored\n=ignored\n'
    );
    const environment = { OPENAI_API_KEY: "", EXA_API_KEY: "" };
    loadLocalEnv(envPath, environment);

    assert.equal(environment.OPENAI_API_KEY, "");
    assert.equal(environment.EXA_API_KEY, "");
    assert.equal(environment.NEW_SETTING, "enabled");
    assert.equal(environment["INVALID-KEY"], undefined);
    assert.equal(environment[""], undefined);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("media fetch options use bounded timeouts and deterministic extensions", () => {
  const metadataOptions = createMediaMetadataFetchOptions();
  const downloadOptions = createMediaDownloadOptions();

  assert.equal(
    new Headers(metadataOptions.headers).get("User-Agent"),
    "RoamAtlas/0.1 local-dev reference-media"
  );
  assert.ok(metadataOptions.signal instanceof AbortSignal);
  assert.ok(downloadOptions.signal instanceof AbortSignal);
  assert.notEqual(metadataOptions.signal, downloadOptions.signal);

  assert.equal(
    mediaImageExtension("image/webp; charset=binary", "https://example.com/a"),
    ".webp"
  );
  assert.equal(
    mediaImageExtension("", "https://example.com/photo.PNG?width=960"),
    ".png"
  );
  assert.equal(
    mediaImageExtension("", "not a URL"),
    ".jpg"
  );
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
    assert.equal(
      resolveArtifactPath(
        "/runtime-cache/%2e%2e/outside.png"
      ),
      null
    );
    assert.equal(
      resolveArtifactPath(
        "/runtime-cache/%E0%A4%A"
      ),
      null
    );
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

test("runtime artifact server rejects malformed encoded paths", async () => {
  const response = await serveRuntimeArtifact({
    pathname: "/runtime-cache/%E0%A4%A",
    runtimeCacheRoot: "/tmp/roamatlas-runtime-cache",
    runtimeCacheUrlPrefix: "/runtime-cache"
  });

  assert.equal(response.status, 400);
});
