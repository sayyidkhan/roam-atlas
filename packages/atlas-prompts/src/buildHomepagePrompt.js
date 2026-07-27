import {
  GLOBAL_IMAGE_RULES,
  CORE_VISUAL_STYLE,
  NEGATIVE_STYLE_TERMS,
  ROAMATLAS_PROMPT_VERSION
} from "./roamAtlasPromptStyle.js";
import {
  getPromptCountryName,
  getPromptWholeAreaPhrase
} from "./promptContext.js";

export function buildHomepagePrompt(input) {
  const countryName = getPromptCountryName(input);
  const wholeAreaPhrase = getPromptWholeAreaPhrase(countryName);
  const anchors =
    input.knownChildNodeTitles && input.knownChildNodeTitles.length > 0
      ? input.knownChildNodeTitles.slice(0, 7).join(", ")
      : "capital or city core, heritage district, waterfront or coast, nature area, food or local life, transport gateway";

  const prompt = `
Create a restrained illustrated overview page for ${countryName}.

Page type: homepage_overview
Role: a calm visual table of contents, not a full-detail city map.
Supplied anchor regions: ${anchors}

Composition:
- Show only 5 to 7 major anchor clusters, each a compact visual island.
- Keep the page airy, calm, and readable.
- Use water, parks, soft background space, or simplified landforms as negative space.
- Keep at least 35% of the image visually open.
- Do not fully render ${wholeAreaPhrase}.
- Do not draw dense road networks across the whole scene.
- Use no more than 15 to 20 important forms, one skyline cluster, and two urban clusters.
- Simplify roads, shoreline, vegetation, infrastructure, boats, and people.

Labels and anchors:
- Readable image text is allowed only for the supplied anchor names and country title "${countryName}".
- Optional subtle numbered anchors or short one- to three-word headings may support exploration.
- No facts, prices, hours, routes, slogans, legend, or long captions.

${CORE_VISUAL_STYLE}

${GLOBAL_IMAGE_RULES}

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}.

Aspect ratio: ${input.aspectRatio ?? "3:2"}.
`.trim();

  return {
    prompt,
    promptVersion: ROAMATLAS_PROMPT_VERSION,
    pageType: "homepage_overview",
    zoomLevel: 0,
    recommendedNegativePromptTerms: NEGATIVE_STYLE_TERMS
  };
}
