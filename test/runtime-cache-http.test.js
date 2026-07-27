import assert from "node:assert/strict";
import test from "node:test";

import { flushCountryRuntimeCache } from "../src/features/runtimeCache/runtimeCacheClient.js";
import { handleRuntimeCacheFlushHttpRequest } from "../src/features/runtimeCache/runtimeCacheHttpHandler.js";

function createResponse() {
  return {
    status: null,
    body: null,
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = JSON.parse(body);
    }
  };
}

test("runtime cache handler restricts visual flushes to known countries", async () => {
  const response = createResponse();
  let flushedSlug = null;
  await handleRuntimeCacheFlushHttpRequest({
    request: {},
    response,
    readJson: async () => ({ countrySlug: "Singapore", scope: "visuals" }),
    getCountryBySlug: (slug) => slug === "singapore" ? { slug, name: "Singapore" } : null,
    flushVisualCache: async (slug) => {
      flushedSlug = slug;
      return { flushed: true, preservedFolders: ["starter-map"] };
    },
    flushRuntimeCache: async () => {
      throw new Error("full flush should not run");
    }
  });

  assert.equal(response.status, 200);
  assert.equal(flushedSlug, "singapore");
  assert.equal(response.body.scope, "visuals");
  assert.deepEqual(response.body.preservedFolders, ["starter-map"]);
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
  const response = createResponse();
  let invoked = false;
  await handleRuntimeCacheFlushHttpRequest({
    request: {},
    response,
    readJson: async () => ({ countrySlug: "", scope: "dangerous" }),
    getCountryBySlug: () => null,
    flushVisualCache: async () => { invoked = true; },
    flushRuntimeCache: async () => { invoked = true; }
  });

  assert.equal(response.status, 400);
  assert.equal(invoked, false);
});
