import assert from "node:assert/strict";
import test from "node:test";

import { fetchExperienceConfig } from "../apps/web/src/features/experience/experienceConfigClient.js";
import { handleExperienceConfigHttpRequest } from "../apps/api/src/features/experience/experienceConfigHttpHandler.js";

test("experience config publishes only browser-safe image settings", async () => {
  const response = handleExperienceConfigHttpRequest({
    experienceConfig: { maxParallelImageJobs: 2, providerApiKey: "must-not-be-here" },
    defaultImageQuality: "high"
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-cache");
  assert.equal(body.defaultImageQuality, "high");
  assert.deepEqual(body.imageQualityOptions, ["low", "medium", "high"]);
  assert.equal(body.providerApiKey, undefined);
});

test("experience config client uses a no-store request and exposes request errors", async () => {
  let request = null;
  const config = await fetchExperienceConfig({
    fetchFn: async (path, options) => {
      request = { path, options };
      return { ok: true, json: async () => ({ maxParallelImageJobs: 2 }) };
    }
  });
  assert.equal(request.path, "/api/experience-config");
  assert.equal(request.options.cache, "no-store");
  assert.equal(config.maxParallelImageJobs, 2);
  await assert.rejects(
    () => fetchExperienceConfig({ fetchFn: async () => ({ ok: false, status: 503 }) }),
    /503/
  );
});
