import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createOpenAIClickResolver } from "../src/features/explorer/openAIClickResolver.js";
import {
  appendSemanticRegion,
  createBaseUnderstanding,
  selectSemanticRegionForPoint
} from "../src/features/explorer/semanticRegionPolicy.js";

const pack = {
  countrySlug: "singapore",
  title: "Singapore",
  overviewSceneId: "singapore-overview",
  scenes: {
    "singapore-overview": { rootNodeId: "singapore" }
  },
  nodes: {
    singapore: {
      childIds: ["marina-bay"]
    },
    "marina-bay": {
      title: "Marina Bay"
    }
  }
};

test("click VLM resolver does not call providers without a configured key", async () => {
  let fetchCalls = 0;
  const resolve = createOpenAIClickResolver({
    apiKey: "",
    model: "test-vlm",
    defaultCountrySlug: "singapore",
    getCountryPack: () => pack,
    getSceneArtwork: () => null,
    getImagePathFromUrl: () => null,
    fetchFn: async () => {
      fetchCalls += 1;
      throw new Error("must not be called");
    }
  });

  const result = await resolve({ sceneId: "singapore-overview" });

  assert.equal(fetchCalls, 0);
  assert.equal(result.status, "provider_missing");
});

test("click VLM resolver sends local fixture bytes through an injected provider", async () => {
  const fixturePath = fileURLToPath(
    new URL("../public/country-cards/singapore.jpg", import.meta.url)
  );
  const requests = [];
  const resolve = createOpenAIClickResolver({
    apiKey: "test-key",
    model: "test-vlm",
    defaultCountrySlug: "singapore",
    getCountryPack: () => pack,
    getSceneArtwork: () => ({ imageUrl: "/fixture/singapore.jpg" }),
    getImagePathFromUrl: () => fixturePath,
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          phrase: "Marina Bay",
          confidence: "high",
          reason: "Matches a supplied candidate"
        })
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const result = await resolve({
    sceneId: "singapore-overview",
    normalizedClick: { x: 0.5, y: 0.5 }
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
  assert.equal(result.status, "resolved");
  assert.equal(result.phrase, "Marina Bay");
  const body = JSON.parse(requests[0].options.body);
  const prompt = body.input[0].content[0].text;
  assert.match(prompt, /Known RoamAtlas candidate labels.*Marina Bay/);
  assert.match(prompt, /Do not make factual travel claims/);
});

test("semantic click cache prefers the nearest learned click and keeps matched nodes curated", () => {
  const understanding = createBaseUnderstanding(
    {
      id: "singapore-page",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "/runtime-cache/singapore/flipbook/page.png"
    },
    { countrySlug: "singapore", assetVersion: "asset-v1" }
  );
  appendSemanticRegion(understanding, {
    normalizedClick: { x: 0.2, y: 0.2 },
    result: {
      click: {
        phrase: "Marina Bay",
        nodeId: "marina-bay",
        confidence: "confirmed"
      }
    },
    vlm: { status: "resolved", phrase: "Marina Bay" },
    pack: {
      nodes: { "marina-bay": { title: "Marina Bay" } }
    }
  });
  understanding.regions.push({
    id: "lower-confidence-nearer",
    bbox: { x: 0.15, y: 0.15, width: 0.2, height: 0.2 },
    cacheClick: { x: 0.26, y: 0.26 },
    confidenceScore: 10
  });

  const hit = selectSemanticRegionForPoint(
    understanding.regions,
    { x: 0.25, y: 0.25 }
  );

  assert.equal(hit.id, "lower-confidence-nearer");
  assert.equal(understanding.regions[0].matchedNodeId, "marina-bay");
  assert.equal(understanding.regions[0].status, "matched");
});
