export const ENVIRONMENT_PLAN_SCHEMA_VERSION = "environment-plan-v6";
export const ENVIRONMENT_PLAN_PROMPT_VERSION = "environment-plan-v9";

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
    "Inspect the actual image and locate each supplied curated destination's complete visual subject and printed label.",
    `Country: ${countryName}.`,
    `Page title: ${title}.`,
    `Page type: ${pageType}.`,
    `Curated destination candidates: ${candidateJson}`,
    "Return JSON only with this exact shape:",
    `{"version":"${ENVIRONMENT_PLAN_SCHEMA_VERSION}","targets":[{"nodeId":"exact supplied node id","mapNumber":"exact supplied map number or null","visualBounds":{"x":0,"y":0,"width":0.3,"height":0.3},"labelBounds":{"x":0,"y":0,"width":0.2,"height":0.1},"confidence":"high|medium|low","reason":"short visual reason"}],"warnings":["short warning"]}`,
    "Bounds are normalized to the original image: x, y, width, and height must be between 0 and 1.",
    "Return exactly one target for every supplied curated destination candidate, with both visualBounds and labelBounds. Do not omit a candidate, duplicate a candidate, or return a target for any other node.",
    "visualBounds must tightly cover the complete illustrated subject associated with that destination: its landmark group, island, campus, district, habitat, attraction, animal, or diagram subject. Include the subject itself, but exclude unrelated open water, empty sky, nearby destinations, and other numbered subjects.",
    "labelBounds must tightly cover ONLY that destination's printed map-number circle and adjacent printed destination title.",
    "Associate each visual subject with the supplied nodeId by its curated destination title and the visible subject. The curated title and nodeId are authoritative.",
    "Treat any number printed inside the generated artwork as advisory only: generated images may omit, duplicate, or swap printed numbers. Never reject an otherwise clear title/subject match because its printed number differs from the supplied mapNumber.",
    "Use only the exact supplied nodeId values. Never invent, rename, merge, or substitute a destination.",
    "Copy the exact supplied mapNumber into each target when one is supplied, even when the artwork prints a different number. When the supplied mapNumber is null, return null. A missing supplied mapNumber is valid for child destinations and must never prevent mapping that destination.",
    "Keep visualBounds tight and non-overlapping. A normal visualBounds is about 8%-48% of image width and 8%-52% of image height.",
    "Keep labelBounds tight and non-overlapping. A normal labelBounds is about 4%-24% of image width and 4%-12% of image height.",
    "If a supplied candidate cannot be identified reliably, return an empty targets array and explain why in warnings. Do not return a partial target map.",
    "Do not ask for generated code. Do not describe animation implementation."
  ].join("\n");
}
