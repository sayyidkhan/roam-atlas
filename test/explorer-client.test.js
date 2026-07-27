import assert from "node:assert/strict";
import test from "node:test";

import { createExplorerClient } from "../src/features/explorer/explorerClient.js";

test("explorer client posts flipbook clicks and reads environment plans", async () => {
  const requests = [];
  const client = createExplorerClient({
    fetchFn: async (path, options) => {
      requests.push({ path, options });
      return { ok: true, json: async () => ({ status: "ready" }) };
    }
  });

  await client.resolveFlipbookClick({ currentPage: { id: "page" }, normalizedClick: { x: 0.4, y: 0.5 } });
  await client.getEnvironmentPlan("/runtime-cache/singapore/environment/page.json");

  assert.equal(requests[0].path, "/api/flipbook/click");
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body).normalizedClick, { x: 0.4, y: 0.5 });
  assert.equal(requests[1].path, "/runtime-cache/singapore/environment/page.json");
  assert.equal(requests[1].options.cache, "no-store");
});

test("explorer client preserves HTTP status for retry policy", async () => {
  const client = createExplorerClient({
    fetchFn: async () => ({ ok: false, status: 202, text: async () => "" })
  });

  await assert.rejects(
    () => client.getEnvironmentPlan("/runtime-cache/environment.json"),
    (error) => error.status === 202
  );
});
