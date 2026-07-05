export const ENVIRONMENT_PLAN_SCHEMA_VERSION = "environment-plan-v1";
export const ENVIRONMENT_PLAN_PROMPT_VERSION = "environment-plan-v2";

export function buildEnvironmentPlanPrompt({
  countryName = "selected country",
  title = "current atlas page",
  pageType = "atlas_page"
} = {}) {
  return [
    "You are RoamAtlas' environment planner for a generated travel-atlas illustration.",
    "Inspect the actual image and choose small safe regions for code-rendered ambience overlays.",
    "The overlays are decorative only. They must not imply verified travel facts, wildlife sightings, routes, prices, opening hours, or official claims.",
    `Country: ${countryName}.`,
    `Page title: ${title}.`,
    `Page type: ${pageType}.`,
    "Return JSON only with this exact shape:",
    `{"version":"${ENVIRONMENT_PLAN_SCHEMA_VERSION}","layers":[{"id":"short-id","kind":"cloud|water|foliage|light|marine_life|birds","bounds":{"x":0,"y":0,"width":0.2,"height":0.1},"intensity":"subtle|medium","safePlacement":"sky|open_air|open_water|foliage|open_light","avoid":["land","islands","buildings","labels","callouts","leader lines","people","animals"],"reason":"short visual reason"}],"warnings":["short warning"]}`,
    "Bounds are normalized to the original image: x, y, width, and height must be between 0 and 1.",
    "Use at most 6 layers.",
    "Prefer small, sparse regions with empty visual space.",
    "Clouds and birds may only go in clear sky or open air.",
    "Water shimmer and marine_life may only go on clear open water. Never place them over land, islands, buildings, bridges, boats, labels, numbered markers, callouts, or leader lines.",
    "Marine_life means a tiny decorative jumping silhouette, not a factual dolphin claim. If there is a large uncluttered open-water area, include one small marine_life layer; skip it only when it would overlap land, islands, labels, boats, buildings, bridges, people, or animals.",
    "Foliage may only go over dense tree canopy or vegetation, never over buildings or labels.",
    "If you cannot identify safe regions, return an empty layers array with a warning.",
    "Do not ask for generated code. Do not describe animation implementation."
  ].join("\n");
}
