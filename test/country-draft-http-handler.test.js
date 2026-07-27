import assert from "node:assert/strict";
import test from "node:test";

import { createCountryDraftHttpHandlers } from "../src/features/countryDraft/countryDraftHttpHandler.js";

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

function createHandlers({ body, countryPack, generateCountryDraft = async () => ({ generationStatus: "ready" }) }) {
  const cache = new Map();
  return createCountryDraftHttpHandlers({
    readJson: async () => body,
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
  const response = createResponse();
  const handlers = createHandlers({
    body: { countrySlug: "singapore", target: "starter-map", instruction: "Replace everything" },
    countryPack: { registration: "source_controlled", confidence: "confirmed" }
  });

  await handlers.handleInfluenceRequest({}, response);

  assert.equal(response.status, 409);
  assert.match(response.body.error, /append-only GenAI candidates/);
});

test("unregistered country drafts keep generated updates unconfirmed", async () => {
  const response = createResponse();
  const handlers = createHandlers({
    body: { countrySlug: "singapore", target: "starter-map", instruction: "Add gardens" },
    countryPack: null,
    generateCountryDraft: async () => ({ generationStatus: "ready", changeNote: "Candidate added." })
  });

  await handlers.handleInfluenceRequest({}, response);

  assert.equal(response.status, 200);
  assert.equal(response.body.message.text, "Candidate added.");
});
