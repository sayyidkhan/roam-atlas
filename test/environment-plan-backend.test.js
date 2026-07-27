import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createArtworkJobRepository } from "../src/features/artwork/artworkJobRepository.js";
import { createEnvironmentPlanQueue } from "../src/features/artwork/environmentPlanQueue.js";
import { createEnvironmentPlanServerPolicy } from "../src/features/explorer/environmentPlanServerPolicy.js";
import { createOpenAIEnvironmentPlanner } from "../src/features/explorer/openAIEnvironmentPlanner.js";
import {
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_SCHEMA_VERSION
} from "../src/lib/prompts/buildEnvironmentPlanPrompt.js";

const page = {
  id: "marina-page",
  countrySlug: "singapore",
  sceneId: "marina-scene",
  nodeId: "marina",
  imageUrl: "/runtime-cache/singapore/flipbook/marina.png",
  plan: { title: "Marina Bay", pageType: "region" }
};

const pack = {
  title: "Singapore",
  nodes: {
    marina: { id: "marina", childIds: ["gardens"] },
    gardens: { id: "gardens", title: "Gardens by the Bay" }
  },
  scenes: {
    "marina-scene": {
      rootNodeId: "marina",
      hotspots: [{ nodeId: "gardens", mapNumber: 1 }]
    }
  }
};

test("environment plan policy accepts only curated targets and safe placements", () => {
  const policy = createEnvironmentPlanServerPolicy({
    getCountryPackForPage: () => pack,
    getRuntimeCountrySlugForPage: () => "singapore"
  });

  const plan = policy.normalizePlan({
    targets: [
      {
        nodeId: "gardens",
        confidence: "high",
        visualBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        labelBounds: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }
      },
      {
        nodeId: "invented-place",
        confidence: "high",
        visualBounds: { x: 0, y: 0, width: 0.2, height: 0.2 },
        labelBounds: { x: 0, y: 0, width: 0.1, height: 0.1 }
      }
    ],
    layers: [
      {
        kind: "water",
        safePlacement: "land",
        bounds: { x: 0, y: 0, width: 1, height: 1 }
      },
      {
        kind: "light",
        safePlacement: "open_light",
        bounds: { x: 0, y: 0, width: 1, height: 1 }
      }
    ]
  }, page, { source: "mock-vlm", model: "test-model" });

  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0].nodeId, "gardens");
  assert.equal(plan.targets[0].visualBounds.width, 0.48);
  assert.equal(plan.targets[0].labelBounds.width, 0.24);
  assert.deepEqual(plan.layers.map((layer) => layer.kind), ["light"]);
  assert.match(plan.factBoundary, /not fact sources/);
});

test("environment planner avoids provider traffic without an API key", async () => {
  let fetchCalls = 0;
  const policy = createEnvironmentPlanServerPolicy({
    getCountryPackForPage: () => pack,
    getRuntimeCountrySlugForPage: () => "singapore"
  });
  const createPlan = createOpenAIEnvironmentPlanner({
    apiKey: "",
    model: "test-model",
    getImagePathFromUrl: () => {
      throw new Error("must not read an image");
    },
    buildPrompt: () => "",
    getPromptContext: policy.getPromptContext,
    normalizePlan: policy.normalizePlan,
    createFallback: policy.createFallback,
    fetchFn: async () => {
      fetchCalls += 1;
      throw new Error("must not call provider");
    }
  });

  const plan = await createPlan(page);

  assert.equal(fetchCalls, 0);
  assert.equal(plan.status, "fallback");
  assert.deepEqual(plan.targets, []);
  assert.deepEqual(plan.layers.map((layer) => layer.kind), ["light"]);
});

test("environment plan queue persists and reuses a matching mocked plan", async (t) => {
  const cacheRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-environment-plan-")
  );
  t.after(() => rm(cacheRoot, { recursive: true, force: true }));
  const environmentPath = path.join(cacheRoot, "environment", "marina.json");
  const paths = {
    environmentPath,
    environmentUrl: "/runtime-cache/singapore/environment/marina.json"
  };
  let providerCalls = 0;
  const queue = createEnvironmentPlanQueue({
    jobRepository: createArtworkJobRepository({
      runtimeCacheRoot: cacheRoot,
      assertJobWritable() {}
    }),
    createEnvironmentPlan: async (requestedPage) => {
      providerCalls += 1;
      return {
        version: ENVIRONMENT_PLAN_SCHEMA_VERSION,
        promptVersion: ENVIRONMENT_PLAN_PROMPT_VERSION,
        imageUrl: requestedPage.imageUrl,
        status: "ready",
        targets: [{ nodeId: "gardens" }],
        layers: []
      };
    },
    createFallbackPlan: () => {
      throw new Error("fallback should not be used");
    },
    hasExpectedTargets: () => true,
    isPathBeingFlushed: () => false,
    logger: { error: () => {} }
  });

  const first = await queue.ensurePlan(page, paths);
  const second = await queue.ensurePlan(page, paths);

  assert.equal(providerCalls, 1);
  assert.deepEqual(second, first);
  assert.equal(
    JSON.parse(await readFile(environmentPath, "utf8")).imageUrl,
    page.imageUrl
  );
});
