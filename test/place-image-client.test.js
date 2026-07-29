import assert from "node:assert/strict";
import test from "node:test";

import { createPlaceImageClient } from "../apps/web/src/features/placeImages/placeImageClient.ts";

test("place-image client owns all mutable reference-photo API requests", async () => {
  const requests = [];
  const client = createPlaceImageClient({
    fetchFn: async (path, options) => {
      requests.push({ path, options });
      return { ok: true, json: async () => ({ items: [] }) };
    }
  });

  await client.reset({ countrySlug: "singapore", place: "Marina Bay" });
  await client.submitFeedback({ countrySlug: "singapore", place: "Marina Bay", feedback: "More gardens" });
  await client.requestSuggestions({ countrySlug: "singapore", place: "Marina Bay" });
  await client.loadHistory({ countrySlug: "singapore", place: "Marina Bay" });
  await client.selectHistoryEntry({ countrySlug: "singapore", place: "Marina Bay", entryId: "entry-1" });
  await client.deleteHistoryEntry({ countrySlug: "singapore", place: "Marina Bay", entryId: "entry-1" });

  assert.deepEqual(
    requests.map((request) => request.path),
    [
      "/api/place-image/reset",
      "/api/place-image/feedback",
      "/api/place-image/suggestions",
      "/api/place-image/history?countrySlug=singapore&place=Marina+Bay",
      "/api/place-image/history/select",
      "/api/place-image/history/delete"
    ]
  );
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[3].options, undefined);
});
