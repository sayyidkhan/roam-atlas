import assert from "node:assert/strict";
import test from "node:test";

import { createCountryDraftClient } from "../apps/web/src/features/countryDraft/countryDraftClient.ts";

test("country draft client centralizes draft API paths and payloads", async () => {
  const requests = [];
  const client = createCountryDraftClient({
    fetchFn: async (path, options) => {
      requests.push({ path, options });
      return { ok: true, json: async () => ({ draft: { countryName: "Singapore" } }) };
    }
  });

  await client.load("singapore", { force: true, generate: false });
  await client.influence({ countrySlug: "singapore", instruction: "Add parks" });
  await client.approve({ countrySlug: "singapore", target: "region:Central", approved: true });
  await client.reorder({ countrySlug: "singapore", currentDraft: {} });
  await client.confirm({ countrySlug: "singapore", currentDraft: {} });

  assert.equal(requests[0].path, "/api/country-draft?countrySlug=singapore&generate=false&force=true");
  assert.deepEqual(
    requests.slice(1).map((request) => request.path),
    [
      "/api/country-draft/influence",
      "/api/country-draft/approve-item",
      "/api/country-draft/reorder",
      "/api/country-draft/confirm"
    ]
  );
  assert.equal(requests[1].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    countrySlug: "singapore",
    instruction: "Add parks"
  });
});

test("country draft client preserves server error messages", async () => {
  const client = createCountryDraftClient({
    fetchFn: async () => ({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: "Source-reviewed facts are immutable." })
    })
  });

  await assert.rejects(
    () => client.influence({ countrySlug: "singapore", instruction: "Rewrite facts" }),
    /Starter map update failed: Source-reviewed facts are immutable\./
  );
});
