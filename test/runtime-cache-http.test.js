import assert from "node:assert/strict";
import test from "node:test";

import { flushCountryRuntimeCache } from "../src/features/runtimeCache/runtimeCacheClient.js";
import { handleRuntimeCacheFlushHttpRequest } from "../src/features/runtimeCache/runtimeCacheHttpHandler.js";

function createJsonRequest(body) {
  return new Request("http://localhost/api/runtime-cache/flush", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("runtime cache handler restricts visual flushes to known countries", async () => {
  let flushedSlug = null;
  const response = await handleRuntimeCacheFlushHttpRequest({
    request: createJsonRequest({ countrySlug: "Singapore", scope: "visuals" }),
    getCountryBySlug: (slug) => slug === "singapore" ? { slug, name: "Singapore" } : null,
    flushVisualCache: async (slug) => {
      flushedSlug = slug;
      return { flushed: true, preservedFolders: ["starter-map"] };
    },
    flushRuntimeCache: async () => {
      throw new Error("full flush should not run");
    }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(flushedSlug, "singapore");
  assert.equal(body.scope, "visuals");
  assert.deepEqual(body.preservedFolders, ["starter-map"]);
});

test("runtime cache client posts an explicit country and scope", async () => {
  let request = null;
  await flushCountryRuntimeCache({
    countrySlug: "singapore",
    scope: "all",
    fetchFn: async (path, options) => {
      request = { path, options };
      return { ok: true, json: async () => ({ flushed: true }) };
    }
  });

  assert.equal(request.path, "/api/runtime-cache/flush");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), { countrySlug: "singapore", scope: "all" });
});

test("runtime cache handler rejects an empty country before invoking a flush adapter", async () => {
  let invoked = false;
  const response = await handleRuntimeCacheFlushHttpRequest({
    request: createJsonRequest({ countrySlug: "", scope: "dangerous" }),
    getCountryBySlug: () => null,
    flushVisualCache: async () => { invoked = true; },
    flushRuntimeCache: async () => { invoked = true; }
  });

  assert.equal(response.status, 400);
  assert.equal(invoked, false);
});
