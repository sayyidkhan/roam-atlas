import {
  GLOBAL_IMAGE_RULES,
  CORE_VISUAL_STYLE,
  NEGATIVE_STYLE_TERMS,
  ROAMATLAS_PROMPT_VERSION
} from "./roamAtlasPromptStyle.js";
import { getPromptCountryName } from "./promptContext.js";

function getDetailTreatment(pageType) {
  switch (pageType) {
    case "animal_anatomy_plate":
      return `
Use a restrained natural history encyclopedia plate.
Show one animal subject clearly with clean anatomy-like visual structure, habitat context, optional small inset diagrams, and blank callout anchors.
Do not show gore. Readable labels may be used only for short supplied headings or body-part/category labels.`;
    case "food_anatomy_plate":
      return `
Use a restrained food encyclopedia plate.
Show one dish or hawker food concept as a clean visual breakdown with ingredients, serving context, optional small inset diagrams, and blank callout anchors.
Do not add menu text, prices, or unsupported claims. Short ingredient/category labels are allowed.`;
    case "architectural_detail":
      return `
Use a clean architectural detail plate.
Show one structure or building feature as a cutaway, sectional, exploded view, or focused axonometric study with blank callout anchors.`;
    case "natural_history_detail":
      return `
Use a natural history / habitat interpretation plate.
Show one ecosystem, habitat, garden layer, plant structure, animal zone, or landscape system as a calm educational diagram.`;
    case "cultural_object_plate":
      return `
Use a museum-style cultural object plate.
Show one cultural object, facade element, street detail, craft, or neighborhood feature as a restrained study page.`;
    default:
      return `
Use a restrained illustrated encyclopedia plate.
Show one main subject with optional inset diagrams, blank callout panels, fine leader lines, and generous spacing.`;
  }
}

export function buildEncyclopediaPrompt(input) {
  const detailTreatment = getDetailTreatment(input.pageType);
  const countryName = getPromptCountryName(input, { fallbackToNodeTitle: false });
  const countrySuffix = countryName === "selected country" ? "" : ` in ${countryName}`;

  const prompt = `
Create a restrained illustrated encyclopedia plate for ${input.nodeTitle}${countrySuffix}.

Page type: ${input.pageType}
Zoom level: ${input.zoomLevel}
Density: ${input.density ?? "restrained"}
Subject: ${input.visualContext}
Continuity: ${input.parentNodeTitle ? `preserve subtle style continuity with ${input.parentNodeTitle}` : countryName === "selected country" ? "the established calm visual language" : `the calm ${countryName} visual language`}

Encyclopedia treatment:
${detailTreatment}

Composition:
- One main subject only.
- Use generous margins and a clean cutaway, exploded view, sectional view, or focused study composition.
- Optional small inset diagrams, numbered anchors, fine leader lines, and blank callout panels are allowed.
- Readable image text is allowed only for supplied titles or one- to three-word category labels.
- Do not create a busy scientific poster, text-heavy infographic, or city-wide background.
- Include only the minimum context needed to understand the subject.

Visual explanation:
- Explain through visual structure: blank callout panels, numbered anchor dots, leader lines, inset diagrams, exploded components, or cutaway layers.
- Exact facts and source-backed claims belong to frontend overlays.
- No long factual captions, prices, hours, route details, or recommendations.

${CORE_VISUAL_STYLE}

${GLOBAL_IMAGE_RULES}

No prices. No hours. No route times. No source citations or factual captions.

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}, busy scientific poster, dense callouts, long readable captions, textbook page full of words, photorealistic rendering.

Aspect ratio: ${input.aspectRatio ?? "3:2"}.
`.trim();

  return {
    prompt,
    promptVersion: ROAMATLAS_PROMPT_VERSION,
    pageType: input.pageType,
    zoomLevel: input.zoomLevel,
    recommendedNegativePromptTerms: [
      ...NEGATIVE_STYLE_TERMS,
      "busy scientific poster",
      "dense captions",
      "readable annotations"
    ]
  };
}
