import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  atlasNodes,
  createInitialSavedState,
  findAnimalExhibitClaim,
  scrollScenes,
  searchKnownNode
} from "../src/data/sceneGraph.js";
import {
  buildItinerary,
  createUnmappedDetour,
  filterCuratedItineraryNodes
} from "../src/domain/itinerary.js";
import {
  buildTileCacheKey,
  findTopmostHotspot,
  getMissingTiles,
  resolveHotspotAction,
  viewportToScenePoint
} from "../src/domain/scrollScene.js";
import { assertGeneratedImagesAreNotFactSources } from "../src/domain/guardrails.js";
import {
  precomputeClickableRegions,
  resolveImageClick
} from "../src/domain/clickResolver.js";
import { matchClickPhraseToNode } from "../src/domain/nodeMatcher.js";
import { buildWanderImagePrompt } from "../src/domain/imagePromptBuilder.js";
import { planNextFlipbookPage } from "../src/domain/pagePlanner.js";
import { getSceneArtwork } from "../src/data/sceneArtwork.js";
import { sceneArtwork } from "../src/data/sceneArtwork.js";
import {
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "../src/data/defaultArtworkPages.js";
import { resolveFlipbookClick } from "../src/domain/flipbookPage.js";
import {
  buildHomepagePrompt,
  buildRegionPrompt,
  buildEncyclopediaPrompt,
  buildWanderImagePrompt as buildPromptOutput
} from "../src/lib/prompts/index.js";
import {
  DEFAULT_FAL_IMAGE_MODEL,
  DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT,
  normalizeFalImageModel,
  normalizeImageModel
} from "../src/domain/imageProvider.js";
import {
  shouldQueueDefaultArtwork,
  sortImageJobsForProcessing
} from "../src/domain/imageJobQueue.js";
import {
  RUNTIME_CACHE_URL_PREFIX,
  createRuntimeCachePaths,
  resolveRuntimeCacheRoot
} from "../src/domain/runtimeCache.js";

test("planner only uses curated itinerary nodes and rejects unknown ids", () => {
  const saved = createInitialSavedState([
    "marina-bay-sands",
    "fake-night-market",
    "giraffe",
    "singapore-zoo"
  ]);

  const curated = filterCuratedItineraryNodes(saved.savedNodeIds, atlasNodes);

  assert.deepEqual(
    curated.map((node) => node.id),
    ["marina-bay-sands", "singapore-zoo"]
  );
});

test("saved discoveries produce an approximate itinerary with warnings", () => {
  const saved = createInitialSavedState([
    "singapore-zoo",
    "wild-africa",
    "giraffe",
    "gardens-by-the-bay"
  ]);

  const itinerary = buildItinerary({
    days: 1,
    pace: "balanced",
    savedNodeIds: saved.savedNodeIds,
    nodes: atlasNodes
  });

  assert.equal(itinerary.days.length, 1);
  assert.equal(itinerary.days[0].items[0].nodeId, "singapore-zoo");
  assert.match(itinerary.days[0].items[0].startTime, /^approximate /);
  assert.ok(
    itinerary.days[0].warnings.some((warning) =>
      warning.includes("Only curated WanderSG nodes")
    )
  );
  assert.ok(
    itinerary.days[0].items.every((item) => atlasNodes[item.nodeId])
  );
});

test("unknown searches become unmapped detours instead of invented nodes", () => {
  const result = searchKnownNode("blue whale");

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);

  const detour = createUnmappedDetour("blue whale");
  assert.equal(detour.type, "detour");
  assert.equal(detour.confidence, "unconfirmed");
  assert.match(detour.message, /not mapped/);
});

test("animal exhibit claims require confirmed data", () => {
  const giraffeClaim = findAnimalExhibitClaim("giraffe");
  const blueWhaleClaim = findAnimalExhibitClaim("blue-whale");

  assert.equal(giraffeClaim.status, "confirmed");
  assert.equal(giraffeClaim.nodeId, "giraffe");
  assert.equal(blueWhaleClaim.status, "unmapped");
});

test("generated images are never accepted as fact sources", () => {
  assert.doesNotThrow(() => assertGeneratedImagesAreNotFactSources(atlasNodes));

  const polluted = {
    bad: {
      id: "bad",
      facts: [
        {
          id: "bad-fact",
          text: "A fake claim from an image.",
          sourceType: "ai_generated",
          confidence: "confirmed"
        }
      ]
    }
  };

  assert.throws(
    () => assertGeneratedImagesAreNotFactSources(polluted),
    /Generated images cannot be fact sources/
  );
});

test("tile cache key changes across fact, prompt, style, and model versions", () => {
  const base = {
    sceneId: "singapore-overview",
    tileId: "overview-r0-c0",
    styleVersion: "atlas-v1",
    dataVersion: "data-v1",
    promptVersion: "prompt-v1",
    imageModel: "gpt-image-2"
  };

  assert.equal(
    buildTileCacheKey(base),
    "scene:singapore-overview:tile:overview-r0-c0:style:atlas-v1:data:data-v1:prompt:prompt-v1:model:gpt-image-2"
  );
  assert.notEqual(
    buildTileCacheKey(base),
    buildTileCacheKey({ ...base, dataVersion: "data-v2" })
  );
  assert.notEqual(
    buildTileCacheKey(base),
    buildTileCacheKey({ ...base, imageModel: "fallback-image-model" })
  );
});

test("image model aliases normalize for OpenAI and fal providers", () => {
  assert.equal(normalizeImageModel("image1"), "gpt-image-1");
  assert.equal(normalizeImageModel("image2"), "gpt-image-2");
  assert.equal(normalizeFalImageModel("nano-banana-2"), DEFAULT_FAL_IMAGE_MODEL);
  assert.equal(normalizeFalImageModel("nano banana 2"), DEFAULT_FAL_IMAGE_MODEL);
  assert.match(DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT, /central 16:9 safe area/);
  assert.match(DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT, /restrained flipbook encyclopedia style/);
});

test("runtime cache paths live outside the repo and expose stable runtime urls", () => {
  const cacheRoot = resolveRuntimeCacheRoot({
    WANDERSG_RUNTIME_CACHE_DIR: "/tmp/wandersg-test-cache"
  });
  const paths = createRuntimeCachePaths({
    cacheRoot,
    pageId: "node-cloud-forest",
    imageModel: "gpt-image-1"
  });

  assert.equal(cacheRoot, "/tmp/wandersg-test-cache");
  assert.equal(paths.jobUrl, `${RUNTIME_CACHE_URL_PREFIX}/image-jobs/node-cloud-forest.json`);
  assert.equal(paths.imageUrl, `${RUNTIME_CACHE_URL_PREFIX}/flipbook/node-cloud-forest.gpt-image-1.png`);
  assert.ok(paths.jobPath.startsWith(cacheRoot));
  assert.ok(paths.imagePath.startsWith(cacheRoot));
});

test("default artwork pre-generation is opt-in for interactive dev speed", () => {
  assert.equal(shouldQueueDefaultArtwork({}), false);
  assert.equal(
    shouldQueueDefaultArtwork({ WANDERSG_PREGENERATE_DEFAULT_ARTWORK: "true" }),
    true
  );
});

test("interactive image jobs process before artwork prewarm jobs", () => {
  const jobs = sortImageJobsForProcessing([
    {
      fileName: "artwork-singapore-overview.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "prewarm",
        createdAt: "2026-05-09T01:00:00.000Z"
      }
    },
    {
      fileName: "node-cloud-forest.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "interactive",
        createdAt: "2026-05-09T02:00:00.000Z"
      }
    },
    {
      fileName: "artwork-marina-bay-scroll.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "artwork",
        createdAt: "2026-05-09T01:30:00.000Z"
      }
    }
  ]);

  assert.deepEqual(
    jobs.map((item) => item.fileName),
    [
      "node-cloud-forest.json",
      "artwork-marina-bay-scroll.json",
      "artwork-singapore-overview.json"
    ]
  );
});

test("viewport clicks convert into scene coordinates", () => {
  const point = viewportToScenePoint({
    viewportX: 200,
    viewportY: 120,
    camera: { x: 500, y: 300, zoom: 2 }
  });

  assert.deepEqual(point, { x: 600, y: 360 });
});

test("overlapping hotspots resolve by highest zIndex", () => {
  const hotspots = [
    {
      id: "region",
      zIndex: 1,
      shape: { x: 0, y: 0, width: 300, height: 300 }
    },
    {
      id: "poi",
      zIndex: 5,
      shape: { x: 100, y: 100, width: 80, height: 80 }
    }
  ];

  assert.equal(findTopmostHotspot(hotspots, { x: 120, y: 120 }).id, "poi");
  assert.equal(findTopmostHotspot(hotspots, { x: 20, y: 20 }).id, "region");
  assert.equal(findTopmostHotspot(hotspots, { x: 400, y: 400 }), null);
});

test("scene transitions preserve the selected known node", () => {
  const hotspot = scrollScenes["singapore-overview"].hotspots.find(
    (item) => item.nodeId === "nature-wildlife-scroll"
  );

  const result = resolveHotspotAction({
    hotspot,
    scenes: scrollScenes,
    currentSelectedNodeId: "singapore"
  });

  assert.equal(result.kind, "enter_scene");
  assert.equal(result.sceneId, "nature-wildlife-scroll");
  assert.equal(result.selectedNodeId, "nature-wildlife-scroll");
});

test("scene transition history can restore the previous scene", () => {
  const history = [];
  const current = { sceneId: "singapore-overview", nodeId: null };
  const hotspot = scrollScenes["singapore-overview"].hotspots.find(
    (item) => item.nodeId === "nature-wildlife-scroll"
  );
  const next = resolveHotspotAction({
    hotspot,
    scenes: scrollScenes,
    currentSelectedNodeId: current.nodeId
  });

  history.push(current);
  const restored = history.pop();

  assert.equal(next.sceneId, "nature-wildlife-scroll");
  assert.deepEqual(restored, { sceneId: "singapore-overview", nodeId: null });
});

test("missing tiles do not block factual node display", () => {
  const scene = scrollScenes["singapore-overview"];

  assert.ok(getMissingTiles(scene).length > 0);
  assert.ok(scene.hotspots.length > 0);
  assert.ok(atlasNodes[scene.rootNodeId].facts.length > 0);
});

test("image click resolver matches clicks through the curated scene graph", () => {
  const result = resolveImageClick({
    scene: scrollScenes["singapore-overview"],
    point: { x: 1260, y: 220 },
    nodes: atlasNodes
  });

  assert.equal(result.status, "matched");
  assert.equal(result.nodeId, "nature-wildlife-scroll");
  assert.equal(result.action.type, "enter_scene");
});

test("overview includes static demo hotspots across west, east, and north Singapore", () => {
  const overview = scrollScenes["singapore-overview"];
  const hotspotNodeIds = overview.hotspots.map((hotspot) => hotspot.nodeId);

  assert.ok(hotspotNodeIds.includes("west-campus-scroll"));
  assert.ok(hotspotNodeIds.includes("changi-east-scroll"));
  assert.ok(hotspotNodeIds.includes("singapore-zoo"));
  assert.ok(atlasNodes["west-campus-scroll"].childIds.includes("nus"));
  assert.ok(atlasNodes["west-campus-scroll"].childIds.includes("ntu"));
  assert.ok(atlasNodes["changi-east-scroll"].childIds.includes("changi-airport"));
});

test("overview hotspot geometry matches Changi and Wildlife positions in the demo art", () => {
  const overview = scrollScenes["singapore-overview"];
  const changi = resolveImageClick({
    scene: overview,
    point: { x: 1450, y: 250 },
    nodes: atlasNodes
  });
  const wildlife = resolveImageClick({
    scene: overview,
    point: { x: 1120, y: 205 },
    nodes: atlasNodes
  });

  assert.equal(changi.nodeId, "changi-east-scroll");
  assert.equal(wildlife.nodeId, "nature-wildlife-scroll");
});

test("image click resolver returns unmapped for unknown image regions", () => {
  const result = resolveImageClick({
    scene: scrollScenes["singapore-overview"],
    point: { x: 20, y: 20 },
    nodes: atlasNodes
  });

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);
});

test("clickable region precompute keeps the candidate set small", () => {
  const regions = precomputeClickableRegions(scrollScenes["singapore-overview"], 3);

  assert.equal(regions.length, 3);
  assert.ok(regions.every((region) => region.nodeId));
});

test("VLM click phrase must match curated candidates before becoming verified", () => {
  const result = matchClickPhraseToNode({
    phrase: "lush wildlife nature reserve with forest paths",
    candidates: scrollScenes["singapore-overview"].hotspots,
    nodes: atlasNodes
  });

  assert.equal(result.status, "matched");
  assert.equal(result.nodeId, "nature-wildlife-scroll");
});

test("unmatched VLM phrase remains unmapped", () => {
  const result = matchClickPhraseToNode({
    phrase: "floating moon castle",
    candidates: scrollScenes["singapore-overview"].hotspots,
    nodes: atlasNodes
  });

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);
});

test("unmapped visible buildings do not get forced into nearby curated Marina nodes", () => {
  const result = matchClickPhraseToNode({
    phrase: "The Fullerton Hotel building",
    candidates: scrollScenes["marina-bay-scroll"].hotspots,
    nodes: atlasNodes
  });

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);
});

test("image prompt builder enforces planning-board style and avoids dense atlas cues", () => {
  const prompt = buildWanderImagePrompt({
    nodeTitle: "Marina Bay",
    visualContext: "Gardens by the Bay waterfront",
    density: "sparse"
  });

  assert.match(prompt, /urban planning proposal board/);
  assert.match(prompt, /medium|8 to 12 major visual elements/);
  assert.match(prompt, /Readable image text is allowed|short readable labels/);
  assert.match(prompt, /crowded travel atlas/);
});

test("homepage prompt is a sparse flipbook visual table of contents", () => {
  const output = buildHomepagePrompt({
    nodeId: "singapore",
    nodeTitle: "Singapore",
    pageType: "homepage_overview",
    zoomLevel: 0,
    visualContext: "Singapore entry page",
    knownChildNodeTitles: ["Marina Bay", "Heritage Belt", "Sentosa", "Mandai"]
  });

  assert.equal(output.promptVersion, "wandersg-flipbook-v3-image-text");
  assert.match(output.prompt, /visual table of contents/);
  assert.match(output.prompt, /5 to 7 major anchor clusters/);
  assert.match(output.prompt, /35% of the image visually open/);
  assert.match(output.prompt, /Do not fully render the entire island/);
  assert.match(output.prompt, /Readable image text is allowed/);
  assert.match(output.prompt, /central 16:9 safe area/);
  assert.match(output.prompt, /dense tourist map/);
  assert.match(output.prompt, /busy panoramic city poster/);
  assert.match(output.prompt, /Do not draw dense road networks/);
});

test("region prompt focuses one region and puts short labels in the generated image", () => {
  const output = buildRegionPrompt({
    nodeId: "marina-bay-scroll",
    nodeTitle: "Marina Bay",
    pageType: "region_overview",
    zoomLevel: 1,
    visualContext: "waterfront gardens and civic district",
    knownChildNodeTitles: ["Gardens by the Bay", "Merlion Park"]
  });

  assert.match(output.prompt, /one region only/);
  assert.match(output.prompt, /not the whole city/);
  assert.match(output.prompt, /image itself should include short readable labels/);
  assert.match(output.prompt, /central 16:9 safe area/);
  assert.match(output.prompt, /callout panels|short readable labels/);
  assert.match(output.prompt, /No prices|No hours|No route times/);
});

test("encyclopedia prompt creates explanatory visual plates with constrained image text", () => {
  const output = buildEncyclopediaPrompt({
    nodeId: "supertree-detail",
    nodeTitle: "Supertree Structure",
    pageType: "architectural_detail",
    zoomLevel: 3,
    visualContext: "one Supertree cutaway with canopy, trunk, and planting layers"
  });

  assert.match(output.prompt, /illustrated encyclopedia plate/);
  assert.match(output.prompt, /One main subject only/);
  assert.match(output.prompt, /cutaway, exploded view, sectional view/);
  assert.match(output.prompt, /Readable image text is allowed/);
  assert.match(output.prompt, /central 16:9 safe area/);
  assert.match(output.prompt, /No prices|No hours|No route times/);
  assert.match(output.prompt, /blank callout panels|numbered anchor dots|leader lines/);
});

test("central prompt router sends page depths to the right builders", () => {
  const homepage = buildPromptOutput({
    nodeId: "singapore",
    nodeTitle: "Singapore",
    pageType: "region_overview",
    zoomLevel: 0,
    visualContext: "overview"
  });
  const region = buildPromptOutput({
    nodeId: "marina-bay-scroll",
    nodeTitle: "Marina Bay",
    pageType: "district_or_attraction",
    zoomLevel: 2,
    visualContext: "focused waterfront chapter"
  });
  const encyclopedia = buildPromptOutput({
    nodeId: "giraffe",
    nodeTitle: "Giraffe",
    pageType: "natural_history_detail",
    zoomLevel: 3,
    visualContext: "natural history plate"
  });

  assert.equal(homepage.pageType, "homepage_overview");
  assert.match(homepage.prompt, /visual table of contents/);
  assert.equal(region.pageType, "district_or_attraction");
  assert.match(region.prompt, /one region only/);
  assert.equal(encyclopedia.pageType, "natural_history_detail");
  assert.match(encyclopedia.prompt, /illustrated encyclopedia plate/);
});

test("page planner shifts verified nodes into deeper encyclopedia pages", () => {
  const plan = planNextFlipbookPage({
    currentNode: atlasNodes.singapore,
    matchedNode: atlasNodes["gardens-by-the-bay"],
    clickedPhrase: "glass garden domes"
  });

  assert.equal(plan.factMode, "verified");
  assert.equal(plan.nextNodeId, "gardens-by-the-bay");
  assert.equal(plan.pageType, "district_or_attraction");
  assert.equal(plan.zoomLevel, 2);
  assert.match(plan.imagePrompt, /illustrated encyclopedia plate|architectural planning illustration/);
});

test("page planner keeps unmatched clicks as unverified detours", () => {
  const plan = planNextFlipbookPage({
    currentNode: atlasNodes.singapore,
    matchedNode: null,
    clickedPhrase: "mysterious floating garden"
  });

  assert.equal(plan.factMode, "unverified_detour");
  assert.equal(plan.nextNodeId, null);
  assert.equal(plan.pageType, "ai_detour");
  assert.ok(plan.imagePrompt);
});

test("scene artwork registry does not reuse old public generated images", () => {
  assert.deepEqual(sceneArtwork, {});
  assert.equal(getSceneArtwork("singapore-overview"), null);
  assert.equal(getSceneArtwork("unknown-scene"), null);
});

test("frontend homepage requests runtime artwork without hardcoded local host", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /overview-codex-local\.png/);
  assert.doesNotMatch(appSource, /127\.0\.0\.1:4173/);
  assert.match(appSource, /requestSceneArtwork/);
  assert.match(appSource, /apiPath\("\/api\/flipbook\/click"\)/);
  assert.match(appSource, /getCurrentRequestPage/);
});

test("default artwork pages are generated through the runtime image pipeline", () => {
  const homepage = getDefaultArtworkPageForScene("singapore-overview", scrollScenes);
  const pages = listDefaultArtworkPages(scrollScenes);

  assert.equal(homepage.id, "artwork-singapore-overview");
  assert.equal(homepage.status, "generation_required");
  assert.equal(homepage.nodeId, "singapore");
  assert.match(homepage.plan.imagePrompt, /visual table of contents/);
  assert.ok(pages.some((page) => page.sceneId === "singapore-overview"));
  assert.ok(pages.some((page) => page.sceneId === "singapore-zoo-scroll"));
});

test("flipbook click returns generation-required page when runtime artwork is not cached yet", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "./public/generated/scenes/singapore-overview/overview-codex-local.png"
    },
    normalizedClick: { x: 0.58, y: 0.4 },
    resolvedPhrase: "southern island beaches and resort coastline",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.page.parentId, "root");
  assert.equal(result.page.id, "node-sentosa-south-scroll");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
  assert.ok(result.page.plan.imagePrompt);
});

test("overview wildlife hotspot is not stolen by synthetic child regions", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "./public/generated/scenes/singapore-overview/overview-codex-local.png"
    },
    normalizedClick: { x: 0.67, y: 0.39 },
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "nature-wildlife-scroll");
  assert.equal(result.page.nodeId, "nature-wildlife-scroll");
  assert.notEqual(result.page.nodeId, "sentosa-south-scroll");
});

test("flipbook click can use a VLM phrase before planning the next page", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "./public/generated/scenes/singapore-overview/overview-codex-local.png"
    },
    normalizedClick: { x: 0.1, y: 0.1 },
    resolvedPhrase: "waterfront skyline garden district with glass domes",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "marina-bay-scroll");
  assert.equal(result.page.nodeId, "marina-bay-scroll");
  assert.equal(result.page.plan.factMode, "verified");
  assert.ok(result.page.plan.imagePrompt);
});

test("flipbook VLM phrases that do not match curated candidates become unverified detours", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "./public/generated/scenes/singapore-overview/overview-codex-local.png"
    },
    normalizedClick: { x: 0.1, y: 0.1 },
    resolvedPhrase: "floating moon castle",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.click.status, "unmapped");
  assert.equal(result.page.nodeId, null);
  assert.equal(result.page.plan.factMode, "unverified_detour");
});

test("flipbook VLM matching uses current node children after turning the page", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root-150-450",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-scroll",
      imageUrl: "./public/generated/scenes/marina-bay-scroll/marina-bay-codex-local.png"
    },
    normalizedClick: { x: 0.34, y: 0.48 },
    resolvedPhrase: "glass conservatories and garden domes",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "gardens-by-the-bay");
  assert.equal(result.page.id, "node-gardens-by-the-bay");
  assert.equal(result.page.nodeId, "gardens-by-the-bay");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
  assert.equal(result.page.plan.pageType, "district_or_attraction");
});

test("flipbook can keep drilling from Gardens into Supertree Grove", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root-150-450-340-480",
      sceneId: "marina-bay-scroll",
      nodeId: "gardens-by-the-bay",
      imageUrl: "./public/generated/scenes/gardens-by-the-bay/gardens-by-the-bay-codex-local.png"
    },
    normalizedClick: { x: 0.52, y: 0.42 },
    resolvedPhrase: "supertree grove canopy structures",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "supertree-grove");
  assert.equal(result.page.id, "node-supertree-grove");
  assert.equal(result.page.nodeId, "supertree-grove");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
});

test("flipbook overlay target can drill directly into a curated child node", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "node-gardens-by-the-bay",
      sceneId: "marina-bay-scroll",
      nodeId: "gardens-by-the-bay",
      imageUrl: "./public/generated/scenes/gardens-by-the-bay/gardens-by-the-bay-codex-local.png"
    },
    normalizedClick: { x: 0.5, y: 0.34 },
    targetNodeId: "cloud-forest",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "overlay");
  assert.equal(result.click.status, "matched");
  assert.equal(result.page.id, "node-cloud-forest");
  assert.equal(result.page.nodeId, "cloud-forest");
  assert.equal(result.page.status, "generation_required");
});

test("flipbook leaf pages can still create an unverified drill-down job", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "node-supertree-structure-plate",
      sceneId: "marina-bay-scroll",
      nodeId: "supertree-structure-plate",
      imageUrl: "./public/generated/scenes/supertree-grove/supertree-grove-codex-local.png"
    },
    normalizedClick: { x: 0.5, y: 0.5 },
    detourPhrase: "Supertree canopy detail study",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "overlay");
  assert.equal(result.click.status, "unmapped");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.plan.factMode, "unverified_detour");
  assert.match(result.page.plan.imagePrompt, /Supertree canopy detail study/);
});

test("flipbook page ids are stable per node so generated images can be reused", () => {
  const first = resolveFlipbookClick({
    currentPage: {
      id: "node-marina-bay-scroll",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-scroll",
      imageUrl: "./public/generated/scenes/marina-bay-scroll/marina-bay-codex-local.png"
    },
    normalizedClick: { x: 0.34, y: 0.48 },
    resolvedPhrase: "glass conservatories and garden domes",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });
  const second = resolveFlipbookClick({
    currentPage: {
      id: "node-marina-bay-scroll",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-scroll",
      imageUrl: "./public/generated/scenes/marina-bay-scroll/marina-bay-codex-local.png"
    },
    normalizedClick: { x: 0.62, y: 0.31 },
    resolvedPhrase: "glass domes and conservatory garden",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(first.page.id, "node-gardens-by-the-bay");
  assert.equal(second.page.id, "node-gardens-by-the-bay");
  assert.equal(first.page.imageUrl, second.page.imageUrl);
  assert.equal(first.page.imageUrl, null);
});

test("local dev click fallback uses current page precomputed child regions", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root-150-450-340-480",
      sceneId: "marina-bay-scroll",
      nodeId: "gardens-by-the-bay",
      imageUrl: "./public/generated/scenes/gardens-by-the-bay/gardens-by-the-bay-codex-local.png"
    },
    normalizedClick: { x: 0.2, y: 0.42 },
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "local");
  assert.equal(result.click.reason, "Matched through current page precomputed click region.");
  assert.equal(result.click.nodeId, "supertree-grove");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
});

test("deep page clicks do not reuse parent scene hotspots", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "node-marina-bay-sands",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-sands",
      imageUrl: "/runtime-cache/flipbook/node-marina-bay-sands.fal-ai-nano-banana-2.png"
    },
    normalizedClick: { x: 0.2, y: 0.42 },
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "unmapped");
  assert.equal(result.page.nodeId, null);
  assert.equal(result.page.plan.factMode, "unverified_detour");
});

test("runtime page clicks without reliable VLM should stay on the current page", () => {
  const currentPage = {
    id: "artwork-singapore-overview",
    sceneId: "singapore-overview",
    nodeId: "singapore",
    imageUrl: "/runtime-cache/flipbook/artwork-singapore-overview.fal-ai-nano-banana-2.png",
    status: "ready"
  };

  assert.ok(currentPage.imageUrl.startsWith(RUNTIME_CACHE_URL_PREFIX));
});

test("server keeps deterministic fallback for non-runtime flipbook click handling", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /resolveSemanticRegionHit/);
  assert.match(serverSource, /resolveClickPhraseWithOpenAI/);
  assert.match(serverSource, /shouldUseLocalFallback/);
  assert.match(serverSource, /!isRuntimePage/);
  assert.doesNotMatch(serverSource, /canUseStaticHomepageFallback/);
  assert.doesNotMatch(serverSource, /isHomepagePage/);
  assert.doesNotMatch(serverSource, /resolvedPhrase:/);
});

test("server VLM resolver tolerates missing generated artwork", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /if \(!artwork\?\.imageUrl\)/);
  assert.doesNotMatch(serverSource, /if \(!artwork\.imageUrl\)/);
});

test("server VLM resolver marks the clicked point in the image", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /annotateClickPointOnPng/);
  assert.match(serverSource, /red crosshair with a white halo/);
  assert.match(serverSource, /imageMarked: Boolean\(markedImage\)/);
  assert.match(serverSource, /data:\$\{vlmMimeType\};base64/);
});

test("server semantic cache prefers the nearest cached click over confidence alone", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /selectSemanticRegionForPoint/);
  assert.match(serverSource, /semanticRegionClickDistance/);
  assert.doesNotMatch(serverSource, /sort\(\(a, b\) => \(b\.confidenceScore \?\? 0\) - \(a\.confidenceScore \?\? 0\)\)/);
  assert.match(serverSource, /matchedNodeId\s*\?\s*mergeBoxes\(existing\.bbox, nextRegion\.bbox\)\s*:\s*nextRegion\.bbox/);
});

test("runtime image job polling is not cached by the browser", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  assert.match(serverSource, /startsWith\("image-jobs\/"\)/);
  assert.match(serverSource, /"Cache-Control": isMutableRuntimeJson/);
  assert.match(serverSource, /"no-store"/);
  assert.match(appSource, /fetch\(toApiUrl\(jobUrl\), \{ cache: "no-store" \}\)/);
});
