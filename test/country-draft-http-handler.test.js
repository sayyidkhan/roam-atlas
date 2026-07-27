import assert from "node:assert/strict";
import test from "node:test";

import { createCountryDraftHttpHandlers } from "../src/features/countryDraft/countryDraftHttpHandler.js";

function createJsonRequest(body) {
  return new Request("http://localhost/api/country-draft/influence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function createHandlers({ countryPack, generateCountryDraft = async () => ({ generationStatus: "ready" }) }) {
  const cache = new Map();
  return createCountryDraftHttpHandlers({
    getCountryBySlug: (slug) => slug === "singapore" ? { slug, name: "Singapore" } : null,
    getCountryPack: () => countryPack,
    isSourceControlledCountryPack: (pack) => Boolean(pack?.registration === "source_controlled"),
    countryDraftCache: cache,
    readStoredCountryDraft: async () => null,
    writeStoredCountryDraft: async () => {},
    withFreshPackThemes: (draft) => draft,
    generateCountryDraft,
    normalizeCurrentCountryDraft: (draft) => draft,
    createStarterMapConfirmation: () => ({}),
    writeStoredCountryPromotion: async () => ({
      starterMapConfirmationUrl: "/runtime-cache/confirmation.json",
      countryPackDraftUrl: "/runtime-cache/pack.json"
    })
  });
}

test("source-reviewed packs only accept append-only GenAI candidates inside a region", async () => {
  const handlers = createHandlers({
    countryPack: { registration: "source_controlled", confidence: "confirmed" }
  });

  const response = await handlers.handleInfluenceRequest(createJsonRequest({
    countrySlug: "singapore",
    target: "starter-map",
    instruction: "Replace everything"
  }));
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.error, /append-only GenAI candidates/);
});

test("unregistered country drafts keep generated updates unconfirmed", async () => {
  const handlers = createHandlers({
    countryPack: null,
    generateCountryDraft: async () => ({ generationStatus: "ready", changeNote: "Candidate added." })
  });

  const response = await handlers.handleInfluenceRequest(createJsonRequest({
    countrySlug: "singapore",
    target: "starter-map",
    instruction: "Add gardens"
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.message.text, "Candidate added.");
});
