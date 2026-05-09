import {
  GLOBAL_IMAGE_RULES,
  CORE_VISUAL_STYLE,
  NEGATIVE_STYLE_TERMS,
  WANDERSG_PROMPT_VERSION
} from "./wandersgPromptStyle.js";

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

  const prompt = `
Create a restrained illustrated encyclopedia plate for ${input.nodeTitle} in Singapore.

Page type:
${input.pageType}

Zoom level:
${input.zoomLevel}

Purpose:
This page is a deep flipbook drill-down page.
It should feel like the user has turned from a map into an illustrated encyclopedia.
It should no longer feel like a city overview.
It should focus on one subject and explain it visually through composition.

Scene / subject:
${input.visualContext}

Parent context:
${input.parentNodeTitle ? `This page is reached from ${input.parentNodeTitle}. Preserve subtle stylistic continuity, but shift into a more focused study-plate layout.` : "Preserve WanderSG's calm restrained visual language."}

Encyclopedia treatment:
${detailTreatment}

Composition:
- One main subject only.
- Use generous margins and breathing room.
- Use clean cutaway, exploded view, sectional view, or focused study composition when appropriate.
- Optional small inset diagrams are allowed.
- Optional circular numbered callout anchors are allowed.
- Optional fine leader lines are allowed.
- Optional caption boxes are allowed.
- Keep callout text short: one to three words, numbered anchors, supplied titles, or category labels only.
- Do not create a busy scientific poster.
- Do not create a text-heavy infographic.
- Do not include a city-wide background.
- Include only the minimum context needed to understand the subject.

Visual explanation:
- Make the page feel educational through structure: blank callout panels, numbered anchor dots, leader lines, small inset diagrams, exploded components, or cutaway layers.
- The viewer should understand that the image is explaining the subject through readable labels and visual structure.
- Use short image text like chapter labels, category labels, and supplied subject names.
- Do not write long factual captions, source-backed claims, prices, hours, or route details.

Visual feeling:
- illustrated encyclopedia plate
- museum interpretation diagram
- architectural study drawing
- natural history plate
- calm, precise, spacious, educational

${CORE_VISUAL_STYLE}

Additional style for detail pages:
- light paper-like background
- clean margins
- centered subject
- restrained diagrammatic layout
- fine grey leader lines if needed
- subtle inset panels
- low visual clutter

${GLOBAL_IMAGE_RULES}

Labels:
Readable image text is allowed for page title, supplied subject names, numbered anchors, short category labels, and one- to three-word callout headings. No logo. No official signage. No prices. No hours. No route times. No source citations. No long factual captions. Frontend overlays render exact source-backed facts only when needed.

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}, busy scientific poster, dense callouts, long readable captions, textbook page full of words, photorealistic rendering.

Aspect ratio:
${input.aspectRatio ?? "16:9"}.
`.trim();

  return {
    prompt,
    promptVersion: WANDERSG_PROMPT_VERSION,
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
