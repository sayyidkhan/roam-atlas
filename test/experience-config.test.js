import assert from "node:assert/strict";
import test from "node:test";

import { fetchExperienceConfig } from "../src/features/experience/experienceConfigClient.js";
import { handleExperienceConfigHttpRequest } from "../src/features/experience/experienceConfigHttpHandler.js";

test("experience config publishes only browser-safe image settings", () => {
  const response = {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = JSON.parse(body);
    }
  };

  handleExperienceConfigHttpRequest({
    response,
    experienceConfig: { maxParallelImageJobs: 2, providerApiKey: "must-not-be-here" },
    defaultImageQuality: "high"
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "no-cache");
  assert.equal(response.body.defaultImageQuality, "high");
  assert.deepEqual(response.body.imageQualityOptions, ["low", "medium", "high"]);
  assert.equal(response.body.providerApiKey, undefined);
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
