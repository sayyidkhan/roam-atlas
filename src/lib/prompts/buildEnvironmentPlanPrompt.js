export const ENVIRONMENT_PLAN_SCHEMA_VERSION = "environment-plan-v2";
export const ENVIRONMENT_PLAN_PROMPT_VERSION = "environment-plan-v3";

export function buildEnvironmentPlanPrompt({
  countryName = "selected country",
  title = "current atlas page",
  pageType = "atlas_page",
  targetCandidates = []
} = {}) {
  const candidateJson = JSON.stringify(
    targetCandidates.map(({ nodeId, title: candidateTitle, mapNumber }) => ({
      nodeId,
      title: candidateTitle,
      mapNumber: mapNumber ?? null
    }))
  );
  return [
    "You are RoamAtlas' environment planner for a generated travel-atlas illustration.",
    "Inspect the actual image, locate the supplied curated destinations, and choose small safe regions for code-rendered ambience overlays.",
    "The overlays are decorative only. They must not imply verified travel facts, wildlife sightings, routes, prices, opening hours, or official claims.",
    `Country: ${countryName}.`,
    `Page title: ${title}.`,
    `Page type: ${pageType}.`,
    `Curated destination candidates: ${candidateJson}`,
    "Return JSON only with this exact shape:",
    `{"version":"${ENVIRONMENT_PLAN_SCHEMA_VERSION}","targets":[{"nodeId":"exact supplied node id","bounds":{"x":0,"y":0,"width":0.2,"height":0.1},"confidence":"high|medium|low","reason":"short visual reason"}],"layers":[{"id":"short-id","kind":"cloud|water|foliage|light|marine_life|birds","bounds":{"x":0,"y":0,"width":0.2,"height":0.1},"intensity":"subtle|medium","safePlacement":"sky|open_air|open_water|foliage|open_light","avoid":["land","islands","buildings","labels","callouts","leader lines","people","animals"],"reason":"short visual reason"}],"warnings":["short warning"]}`,
    "Bounds are normalized to the original image: x, y, width, and height must be between 0 and 1.",
    "For each visibly identifiable destination candidate, return one target covering its illustrated landmark cluster and nearby numbered/name label.",
    "Use only the exact supplied nodeId values. Never invent, rename, merge, or substitute a destination.",
    "Keep target bounds tight and non-overlapping. Do not let a target cover a neighboring destination.",
    "The nearby printed map number and title are strong evidence. Prefer those over a visual guess based on landmark appearance.",
    "Omit a candidate when it cannot be identified reliably in the image.",
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
