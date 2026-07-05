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

Page type:
homepage_overview

Purpose:
This is the entry page of an interactive AI flipbook-like exploration experience for ${countryName}.
It should feel like a calm visual table of contents, not a full-detail city map.
It should introduce ${countryName} as a small set of explorable themed anchor regions.

Anchor regions:
${anchors}

Composition:
- Use a simplified overview composition.
- Show only 5 to 7 major anchor clusters maximum.
- Each anchor region should read as a compact visual island of meaning.
- Keep the page airy, calm, elegant, and highly readable.
- Use large water bodies, open parks, soft background space, or simplified landforms as negative space.
- Keep at least 35% of the image visually open.
- Do not fill every empty area.
- Do not fully render ${wholeAreaPhrase}.
- Do not draw dense road networks across the whole scene.
- Do not draw every neighborhood.
- Do not make a complete tourism poster.

Homepage density:
- Minimal to restrained density only.
- No more than 15 to 20 important landmark forms total.
- No more than one compact skyline cluster.
- No more than two compact urban clusters.
- Fewer roads.
- Fewer trees.
- Fewer boats.
- Fewer people.
- Simplified shoreline.
- Simplified vegetation masses.
- Simplified infrastructure.

Visual explanation:
- Suggest what can be explored through distinct visual clusters.
- Add short readable image text for the supplied anchor names only, such as ${anchors}.
- Use small guide-board shapes, subtle numbered anchors, or short one- to three-word callout headings if they help the page feel like an illustrated encyclopedia entry.
- Do not add facts, prices, hours, routes, slogans, or long captions.

Visual feeling:
- a calm illustrated exploration book entry page
- a museum map table of contents
- a clean architectural atlas opening page
- quiet, spacious, precise, inviting

${CORE_VISUAL_STYLE}

${GLOBAL_IMAGE_RULES}

Labels:
Readable image text is allowed only for short curated anchor labels and the country title "${countryName}". Do not invent any product logo, app name, brand word, old brand name, or decorative title. No legend. No prices. No hours. No route times. No official claims. Frontend overlays render exact facts and source badges.

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}.

Aspect ratio:
${input.aspectRatio ?? "16:9"}.
`.trim();

  return {
    prompt,
    promptVersion: ROAMATLAS_PROMPT_VERSION,
    pageType: "homepage_overview",
    zoomLevel: 0,
    recommendedNegativePromptTerms: NEGATIVE_STYLE_TERMS
  };
}
