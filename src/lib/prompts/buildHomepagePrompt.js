import {
  GLOBAL_IMAGE_RULES,
  CORE_VISUAL_STYLE,
  NEGATIVE_STYLE_TERMS,
  WANDERSG_PROMPT_VERSION
} from "./wandersgPromptStyle.js";

export function buildHomepagePrompt(input) {
  const anchors =
    input.knownChildNodeTitles && input.knownChildNodeTitles.length > 0
      ? input.knownChildNodeTitles.slice(0, 7).join(", ")
      : "Marina Bay / Gardens, Heritage shophouse district, Civic district, Sentosa / southern coast, Mandai / wildlife, East Coast or local life";

  const prompt = `
Create the WanderSG homepage as a restrained illustrated overview page for Singapore.

Page type:
homepage_overview

Purpose:
This is the entry page of an interactive AI flipbook-like exploration experience.
It should feel like a calm visual table of contents, not a full-detail city map.
It should introduce Singapore as a small set of explorable themed anchor regions.

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
- Do not fully render the entire island.
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
Readable image text is allowed only for short curated anchor labels and the page title. No logo. No legend. No prices. No hours. No route times. No official claims. Frontend overlays render exact facts and source badges.

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}.

Aspect ratio:
${input.aspectRatio ?? "16:9"}.
`.trim();

  return {
    prompt,
    promptVersion: WANDERSG_PROMPT_VERSION,
    pageType: "homepage_overview",
    zoomLevel: 0,
    recommendedNegativePromptTerms: NEGATIVE_STYLE_TERMS
  };
}
