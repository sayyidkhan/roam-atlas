/**
 * @typedef {0 | 1 | 2 | 3 | 4} WanderZoomLevel
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
 * } WanderPageType
 *
 * @typedef {"minimal" | "restrained" | "balanced" | "detailed"} WanderDensity
 * @typedef {"verified" | "curated" | "general" | "unverified_detour"} WanderFactMode
 *
 * @typedef {object} WanderPromptInput
 * @property {string} nodeId
 * @property {string} nodeTitle
 * @property {WanderPageType} pageType
 * @property {WanderZoomLevel} zoomLevel
 * @property {string} visualContext
 * @property {string=} userVibe
 * @property {string=} parentNodeTitle
 * @property {WanderDensity=} density
 * @property {WanderFactMode=} factMode
 * @property {"16:9" | "2:1" | "4:3" | "1:1"=} aspectRatio
 * @property {string[]=} knownChildNodeTitles
 *
 * @typedef {object} WanderPromptOutput
 * @property {string} prompt
 * @property {string} promptVersion
 * @property {WanderPageType} pageType
 * @property {WanderZoomLevel} zoomLevel
 * @property {string[]} recommendedNegativePromptTerms
 */

export {};
