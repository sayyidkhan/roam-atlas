/**
 * @typedef {0 | 1 | 2 | 3 | 4} RoamAtlasZoomLevel
 *
 * @typedef {
 *   | "homepage_overview"
 *   | "region_overview"
 *   | "district_or_attraction"
 *   | "street_or_zone"
 *   | "architectural_detail"
 *   | "natural_history_detail"
 *   | "animal_anatomy_plate"
 *   | "food_anatomy_plate"
 *   | "cultural_object_plate"
 *   | "itinerary_board"
 *   | "ai_detour"
 * } RoamAtlasPageType
 *
 * @typedef {"minimal" | "restrained" | "balanced" | "detailed"} RoamAtlasDensity
 * @typedef {"verified" | "curated" | "general" | "unverified_detour"} RoamAtlasFactMode
 *
 * @typedef {object} RoamAtlasPromptInput
 * @property {string} nodeId
 * @property {string} nodeTitle
 * @property {RoamAtlasPageType} pageType
 * @property {RoamAtlasZoomLevel} zoomLevel
 * @property {string} visualContext
 * @property {string=} userVibe
 * @property {string=} parentNodeTitle
 * @property {string=} countryName
 * @property {RoamAtlasDensity=} density
 * @property {RoamAtlasFactMode=} factMode
 * @property {"16:9" | "2:1" | "4:3" | "1:1"=} aspectRatio
 * @property {string[]=} knownChildNodeTitles
 *
 * @typedef {object} RoamAtlasPromptOutput
 * @property {string} prompt
 * @property {string} promptVersion
 * @property {RoamAtlasPageType} pageType
 * @property {RoamAtlasZoomLevel} zoomLevel
 * @property {string[]} recommendedNegativePromptTerms
 */

export {};
