export type RoamAtlasZoomLevel =
  | 0
  | 1
  | 2
  | 3
  | 4;

export type RoamAtlasPageType =
  | "homepage_overview"
  | "region_overview"
  | "district_or_attraction"
  | "street_or_zone"
  | "architectural_detail"
  | "natural_history_detail"
  | "animal_anatomy_plate"
  | "food_anatomy_plate"
  | "cultural_object_plate"
  | "itinerary_board"
  | "ai_detour";

export type RoamAtlasDensity =
  | "minimal"
  | "restrained"
  | "balanced"
  | "detailed";

export type RoamAtlasFactMode =
  | "verified"
  | "curated"
  | "general"
  | "unverified_detour";

export type RoamAtlasAspectRatio =
  | "3:2"
  | "16:9"
  | "2:1"
  | "4:3"
  | "1:1";

export type RoamAtlasPromptInput = {
  aspectRatio?: RoamAtlasAspectRatio;
  countryName?: string;
  density?: RoamAtlasDensity;
  factMode?: RoamAtlasFactMode;
  knownCalloutLabels?: string[];
  knownChildNodeTitles?: string[];
  nodeId: string;
  nodeTitle: string;
  pageType: RoamAtlasPageType;
  parentNodeTitle?: string | null;
  userVibe?: string;
  visualContext: string;
  zoomLevel: RoamAtlasZoomLevel;
};

export type RoamAtlasPromptOutput = {
  pageType: RoamAtlasPageType;
  prompt: string;
  promptVersion: string;
  recommendedNegativePromptTerms: string[];
  zoomLevel: RoamAtlasZoomLevel;
};

export type RoamAtlasImagePromptRequest = {
  aspectRatio?: string;
  countryName?: string;
  density?: string;
  knownCalloutLabels?: string[];
  knownChildNodeTitles?: string[];
  nodeId?: string;
  nodeTitle: string;
  pageType?: string;
  parentNodeTitle?: string | null;
  visualContext: string;
  zoomLevel?: number;
};

export type PromptNode = {
  id?: string;
  type?: string;
};
