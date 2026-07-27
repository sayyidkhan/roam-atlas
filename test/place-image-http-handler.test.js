import assert from "node:assert/strict";
import test from "node:test";

import { createPlaceImageHttpHandlers } from "../src/features/placeImages/placeImageHttpHandler.js";

function createResponse() {
  return {
    status: null,
    body: null,
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
    }
  };
}

function createHandlers(body) {
  return createPlaceImageHttpHandlers({
    readJson: async () => body,
    getCountryBySlug: (slug) => slug === "singapore" ? { slug, name: "Singapore" } : null,
    normalizeFeedback: (value) => String(value ?? "").trim(),
    respondNotFound: () => {},
    resolveImage: async () => null,
    getImagePathFromUrl: () => null,
    readFile: async () => null,
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
  const response = createResponse();
  await createHandlers({ countrySlug: "singapore", place: "Marina Bay", feedback: "" })
    .handleFeedbackRequest({}, response);

  assert.equal(response.status, 400);
  assert.match(response.body.error, /country, place, and photo feedback/);
});

test("place-image suggestions explicitly label external search output as non-factual", async () => {
  const response = createResponse();
  await createHandlers({ countrySlug: "singapore", place: "Marina Bay" })
    .handleSuggestionsRequest({}, response);

  assert.equal(response.status, 200);
  assert.match(response.body.factBoundary, /not travel facts/);
  assert.deepEqual(response.body.suggestions, ["More greenery"]);
});
