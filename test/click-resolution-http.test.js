import assert from "node:assert/strict";
import test from "node:test";

import { handleFlipbookClickHttpRequest } from "../src/features/explorer/clickResolutionHttpHandler.js";

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

function createDependencies(overrides = {}) {
  const calls = [];
  const pack = {
    title: "Singapore",
    scenes: {
      scene: { id: "scene", pageType: "region" }
    },
    nodes: {}
  };
  return {
    calls,
    dependencies: {
      readJson: async () => ({
        currentPage: { id: "page", sceneId: "scene", nodeId: "root", imageUrl: "/art.png" },
        normalizedClick: { x: 0.4, y: 0.5 }
      }),
      getCountryPackForPage: () => pack,
      getCountrySlugForPage: () => "singapore",
      sceneArtwork: {},
      hasRuntimeGeneratedPage: () => false,
      resolveDeterministicClick: () => null,
      resolveSemanticRegionHit: async () => null,
      resolveClickPhrase: async () => ({ status: "resolved", phrase: "Gardens", confidence: "high" }),
      matchVlmPhraseForCurrentPage: () => ({ status: "matched", nodeId: "gardens", confidence: "confirmed" }),
      resolveFlipbookClick: (input) => {
        calls.push(input);
        return { click: { status: "matched", nodeId: input.targetNodeId }, page: { status: "ready" } };
      },
      appendSemanticRegionFromResult: async () => {},
      createUnresolvedClickResult: () => ({ click: { status: "unmapped" }, page: { status: "ready" } }),
      centerOfBox: () => ({ x: 0.5, y: 0.5 }),
      attachArtwork: async (page) => page,
      ...overrides
    }
  };
}

test("click HTTP handler only turns reliable VLM output into a curated matched node", async () => {
  const response = createResponse();
  const { dependencies, calls } = createDependencies();

  await handleFlipbookClickHttpRequest({ request: {}, response, ...dependencies });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].targetNodeId, "gardens");
  assert.equal(response.body.vlm.matchedNodeId, "gardens");
});

test("click HTTP handler preserves explicit overlay navigation without VLM or semantic resolution", async () => {
  const response = createResponse();
  let semanticCalls = 0;
  let vlmCalls = 0;
  const { dependencies, calls } = createDependencies({
    readJson: async () => ({
      currentPage: { id: "page", sceneId: "scene", nodeId: "root" },
      normalizedClick: { x: 0.4, y: 0.5 },
      targetNodeId: "marina-bay-sands"
    }),
    resolveSemanticRegionHit: async () => {
      semanticCalls += 1;
      return null;
    },
    resolveClickPhrase: async () => {
      vlmCalls += 1;
      return { status: "resolved", phrase: "ignored", confidence: "high" };
    }
  });

  await handleFlipbookClickHttpRequest({ request: {}, response, ...dependencies });

  assert.equal(response.status, 200);
  assert.equal(calls[0].targetNodeId, "marina-bay-sands");
  assert.equal(semanticCalls, 0);
  assert.equal(vlmCalls, 0);
  assert.equal(response.body.vlm, undefined);
});

test("runtime pages reject non-confirmed VLM matches as an unverified detour", async () => {
  const response = createResponse();
  let cachedResult = null;
  const { dependencies, calls } = createDependencies({
    hasRuntimeGeneratedPage: () => true,
    matchVlmPhraseForCurrentPage: () => ({
      status: "matched",
      nodeId: "likely-node",
      confidence: "general"
    }),
    createUnresolvedClickResult: ({ vlm }) => ({
      click: { status: "unmapped", resolver: "vlm_guard", phrase: vlm.phrase },
      page: { status: "ready" }
    }),
    appendSemanticRegionFromResult: async (input) => {
      cachedResult = input;
    }
  });

  await handleFlipbookClickHttpRequest({ request: {}, response, ...dependencies });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].detourPhrase, "Gardens");
  assert.equal(response.body.click.status, "matched");
  assert.equal(cachedResult?.result.click.status, "matched");
});
