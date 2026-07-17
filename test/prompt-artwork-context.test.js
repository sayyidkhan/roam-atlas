import test from "node:test";
import assert from "node:assert/strict";

import { atlasNodes, scrollScenes } from "../src/data/sceneGraph.js";
import { getDefaultArtworkPageForNode } from "../src/data/defaultArtworkPages.js";
import { buildRegionPrompt } from "../src/lib/prompts/buildRegionPrompt.js";

test("child artwork does not inherit unrelated parent-scene landmarks", () => {
  const marinaBaySands = getDefaultArtworkPageForNode(
    "marina-bay-sands",
    "marina-bay-scroll",
    scrollScenes,
    atlasNodes,
    "singapore",
    "Singapore"
  );
  const merlion = getDefaultArtworkPageForNode(
    "merlion-park",
    "marina-bay-scroll",
    scrollScenes,
    atlasNodes,
    "singapore",
    "Singapore"
  );

  for (const page of [marinaBaySands, merlion]) {
    assert.doesNotMatch(page.plan.visualContext, /glass conservator|supertree/i);
    assert.doesNotMatch(page.plan.imagePrompt, /two glass conservator|Gardens by the Bay waterfront/i);
  }
  assert.match(marinaBaySands.plan.imagePrompt, /Marina Bay Sands/);
  assert.match(marinaBaySands.plan.imagePrompt, /1\. Rooftop deck/);
  assert.match(marinaBaySands.plan.imagePrompt, /2\. Hotel towers/);
  assert.match(marinaBaySands.plan.imagePrompt, /3\. Museum building/);
  assert.match(marinaBaySands.plan.imagePrompt, /4\. Waterfront podium/);
  assert.match(marinaBaySands.plan.imagePrompt, /Do not leave a supplied numbered callout panel blank/);
  assert.deepEqual(
    marinaBaySands.plan.frontendOverlays.map(({ text }) => text),
    ["Rooftop deck", "Hotel towers", "Museum building", "Waterfront podium"]
  );
  assert.match(merlion.plan.imagePrompt, /Merlion Park/);
});

test("region prompt honors page type and density without asking images to carry facts", () => {
  const output = buildRegionPrompt({
    nodeId: "marina-bay-sands",
    nodeTitle: "Marina Bay Sands",
    pageType: "district_or_attraction",
    zoomLevel: 2,
    density: "minimal",
    countryName: "Singapore",
    visualContext: "A focused architectural study of Marina Bay Sands.",
    knownChildNodeTitles: [],
    knownCalloutLabels: []
  });

  assert.equal(output.pageType, "district_or_attraction");
  assert.match(output.prompt, /Page type: district_or_attraction/);
  assert.match(output.prompt, /Density: minimal/);
  assert.match(output.prompt, /Exact facts, recommendations, and source badges belong to frontend overlays/);
  assert.match(output.prompt, /Do not draw numbered anchors or empty callout panels/);
  assert.doesNotMatch(output.prompt, /Do not rely on frontend text overlays/);
  assert.ok(output.prompt.length < 3600, `prompt was ${output.prompt.length} characters`);
});
