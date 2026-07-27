import assert from "node:assert/strict";
import test from "node:test";

import { createPlaceImageHttpHandlers } from "../src/features/placeImages/placeImageHttpHandler.js";

function createJsonRequest(body) {
  return new Request("http://localhost/api/place-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function createHandlers() {
  return createPlaceImageHttpHandlers({
    getCountryBySlug: (slug) => slug === "singapore" ? { slug, name: "Singapore" } : null,
    normalizeFeedback: (value) => String(value ?? "").trim(),
    respondNotFound: () => {},
    resolveImage: async () => null,
    readCachedImage: async () => null,
    mimeTypeForImagePath: () => "image/jpeg",
    toSafeHeaderValue: (value) => value,
    resetPlaceImage: async () => ({ reset: true }),
    resetCountryImages: async () => ({ reset: true }),
    getSuggestionContext: () => ({ title: "Marina Bay", children: [], kind: "district" }),
    suggestPrompts: async () => ({ source: "curated-fallback", suggestions: ["More greenery"] }),
    readHistory: async () => [],
    toHistoryItem: (item) => item,
    selectHistoryEntry: async () => ({ selected: true }),
    deleteHistoryEntry: async () => ({ deleted: true }),
    factBoundary: "Reference photos are not travel facts."
  });
}

test("place-image feedback requires a country, place, and normalized feedback", async () => {
  const response = await createHandlers().handleFeedbackRequest(createJsonRequest({
    countrySlug: "singapore",
    place: "Marina Bay",
    feedback: ""
  }));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /country, place, and photo feedback/);
});

test("place-image suggestions explicitly label external search output as non-factual", async () => {
  const response = await createHandlers().handleSuggestionsRequest(createJsonRequest({
    countrySlug: "singapore",
    place: "Marina Bay"
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.factBoundary, /not travel facts/);
  assert.deepEqual(body.suggestions, ["More greenery"]);
});
