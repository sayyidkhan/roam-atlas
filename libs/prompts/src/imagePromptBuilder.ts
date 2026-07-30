import { buildRoamAtlasImagePrompt as buildPromptOutput } from "./buildRoamAtlasImagePrompt.ts";
import type {
  PromptNode,
  RoamAtlasAspectRatio,
  RoamAtlasDensity,
  RoamAtlasImagePromptRequest,
  RoamAtlasPageType,
  RoamAtlasZoomLevel
} from "./roamAtlasPromptTypes.ts";

const PAGE_TYPES = new Set<RoamAtlasPageType>([
  "homepage_overview",
  "region_overview",
  "district_or_attraction",
  "street_or_zone",
  "architectural_detail",
  "natural_history_detail",
  "animal_anatomy_plate",
  "food_anatomy_plate",
  "cultural_object_plate",
  "itinerary_board",
  "ai_detour"
]);

const DENSITIES = new Set<RoamAtlasDensity>([
  "minimal",
  "restrained",
  "balanced",
  "detailed"
]);

const ASPECT_RATIOS = new Set<RoamAtlasAspectRatio>([
  "3:2",
  "16:9",
  "2:1",
  "4:3",
  "1:1"
]);

export function buildRoamAtlasImagePrompt({
  nodeId = "unknown-node",
  nodeTitle,
  visualContext,
  pageType = "region_overview",
  zoomLevel = 1,
  density = "balanced",
  aspectRatio = "3:2",
  parentNodeTitle,
  knownChildNodeTitles = [],
  knownCalloutLabels = [],
  countryName
}: RoamAtlasImagePromptRequest): string {
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
    knownCalloutLabels,
    countryName
  }).prompt;
}

export function inferPageTypeForNode(
  node: PromptNode | null | undefined
): RoamAtlasPageType {
  const byType: Record<string, RoamAtlasPageType> = {
    country: "homepage_overview",
    district: "region_overview",
    attraction: "district_or_attraction",
    zone: "street_or_zone",
    animal: "natural_history_detail",
    anatomy_plate: "animal_anatomy_plate",
    itinerary_item: "itinerary_board",
    detour: "ai_detour"
  };

  return node?.type
    ? byType[node.type] ?? "region_overview"
    : "region_overview";
}

export function inferZoomLevelForNode(
  node: PromptNode | null | undefined
): RoamAtlasZoomLevel {
  const byType: Record<string, RoamAtlasZoomLevel> = {
    country: 0,
    district: 1,
    attraction: 2,
    zone: 3,
    animal: 4,
    anatomy_plate: 4,
    itinerary_item: 2,
    detour: 2
  };

  return node?.type
    ? byType[node.type] ?? 1
    : 1;
}

function normalizePageType(pageType: string): RoamAtlasPageType {
  const legacy: Record<string, RoamAtlasPageType> = {
    district_map: "region_overview",
    attraction_plate: "district_or_attraction",
    street_or_zone_plate: "street_or_zone",
    architectural_detail_plate: "architectural_detail",
    natural_history_plate: "natural_history_detail",
    ai_detour_plate: "ai_detour"
  };

  const normalized = legacy[pageType] ?? pageType;
  return PAGE_TYPES.has(normalized as RoamAtlasPageType)
    ? normalized as RoamAtlasPageType
    : "region_overview";
}

function normalizeZoomLevel(zoomLevel: number): RoamAtlasZoomLevel {
  const numericZoom = Number(zoomLevel);
  if (!Number.isFinite(numericZoom)) return 1;
  return Math.min(4, Math.max(0, Math.round(numericZoom))) as RoamAtlasZoomLevel;
}

function normalizeDensity(density: string): RoamAtlasDensity {
  const normalized = density === "sparse" ? "minimal" : density;
  return DENSITIES.has(normalized as RoamAtlasDensity)
    ? normalized as RoamAtlasDensity
    : "balanced";
}

function normalizeAspectRatio(aspectRatio: string): RoamAtlasAspectRatio {
  if (ASPECT_RATIOS.has(aspectRatio as RoamAtlasAspectRatio)) {
    return aspectRatio as RoamAtlasAspectRatio;
  }
  if (String(aspectRatio).includes("3:2")) return "3:2";
  if (String(aspectRatio).includes("2:1")) return "2:1";
  if (String(aspectRatio).includes("4:3")) return "4:3";
  if (String(aspectRatio).includes("1:1")) return "1:1";
  return "3:2";
}
