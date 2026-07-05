import { buildRoamAtlasImagePrompt as buildPromptOutput } from "../lib/prompts/buildRoamAtlasImagePrompt.js";

export function buildRoamAtlasImagePrompt({
  nodeId = "unknown-node",
  nodeTitle,
  visualContext,
  pageType = "region_overview",
  zoomLevel = 1,
  density = "balanced",
  aspectRatio = "16:9",
  parentNodeTitle,
  knownChildNodeTitles = [],
  countryName
}) {
  return buildPromptOutput({
    nodeId,
    nodeTitle,
    visualContext,
    pageType: normalizePageType(pageType),
    zoomLevel: normalizeZoomLevel(zoomLevel),
    density: normalizeDensity(density),
    aspectRatio: normalizeAspectRatio(aspectRatio),
    parentNodeTitle,
    knownChildNodeTitles,
    countryName
  }).prompt;
}

export function inferPageTypeForNode(node) {
  const byType = {
    country: "homepage_overview",
    district: "region_overview",
    attraction: "district_or_attraction",
    zone: "street_or_zone",
    animal: "natural_history_detail",
    anatomy_plate: "animal_anatomy_plate",
    itinerary_item: "itinerary_board",
    detour: "ai_detour"
  };

  return byType[node?.type] ?? "region_overview";
}

export function inferZoomLevelForNode(node) {
  const byType = {
    country: 0,
    district: 1,
    attraction: 2,
    zone: 3,
    animal: 4,
    anatomy_plate: 4,
    itinerary_item: 2,
    detour: 2
  };

  return byType[node?.type] ?? 1;
}

function normalizePageType(pageType) {
  const legacy = {
    district_map: "region_overview",
    attraction_plate: "district_or_attraction",
    street_or_zone_plate: "street_or_zone",
    architectural_detail_plate: "architectural_detail",
    natural_history_plate: "natural_history_detail",
    ai_detour_plate: "ai_detour"
  };

  return legacy[pageType] ?? pageType;
}

function normalizeZoomLevel(zoomLevel) {
  return Math.min(4, Math.max(0, Number(zoomLevel)));
}

function normalizeDensity(density) {
  return density === "sparse" ? "minimal" : density;
}

function normalizeAspectRatio(aspectRatio) {
  if (["16:9", "2:1", "4:3", "1:1"].includes(aspectRatio)) return aspectRatio;
  if (String(aspectRatio).includes("2:1")) return "2:1";
  if (String(aspectRatio).includes("4:3")) return "4:3";
  if (String(aspectRatio).includes("1:1")) return "1:1";
  return "16:9";
}
