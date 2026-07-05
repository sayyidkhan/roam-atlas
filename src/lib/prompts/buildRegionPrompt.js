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

export function buildRegionPrompt(input) {
  const countryName = getPromptCountryName(input);
  const wholeAreaPhrase = getPromptWholeAreaPhrase(countryName);
  const childHints =
    input.knownChildNodeTitles && input.knownChildNodeTitles.length > 0
      ? `Potential visible click targets, shown subtly as visual forms only: ${input.knownChildNodeTitles.slice(0, 8).join(", ")}.`
      : "Show a few subtle visible click targets as architectural, landscape, food, wildlife, waterfront, or cultural forms.";

  const prompt = `
Create a restrained region page for ${input.nodeTitle} in ${countryName}.

Page type:
region_overview

Zoom level:
${input.zoomLevel}

Purpose:
This page is one step deeper than the homepage.
It should feel like the user has turned to a focused chapter in an illustrated ${countryName} exploration book.
Show one region clearly, not the whole city.

Scene:
${input.visualContext}

Parent context:
${input.parentNodeTitle ? `This page comes from ${input.parentNodeTitle}. Maintain subtle visual continuity with the parent page.` : `Maintain continuity with the ${countryName} overview style.`}

Composition:
- Focus on one region only.
- Keep the scene spacious and readable.
- Use medium-low density unless the caller explicitly asks for more.
- Use water, paths, plazas, lawns, roads, or quiet background areas as negative space.
- Keep major objects separated.
- Show only the most meaningful landmarks, paths, buildings, or landscape elements.
- Do not fill every empty space.
- Do not render a complete tourist map.
- Do not show ${wholeAreaPhrase}.
- Keep visual density restrained.

Clickability:
${childHints}
The image itself should include short readable labels for these clickable subjects when their names are supplied by the app.
Use small labels, numbered callouts, and short chapter headings inside the generated image.
Do not rely on frontend text overlays to explain the page.

Visual explanation:
- Include a few guide-board shapes, callout panels, fine leader lines, numbered anchor dots, and short readable labels where they help the image feel like a flipbook encyclopedia page.
- The visual explanation should help users understand what kinds of things are in the scene.
- Keep labels short. Do not write long paragraphs or unsupported facts.

Visual feeling:
- clean regional chapter page
- architectural planning illustration
- museum guide map
- calm ${countryName} district study

${CORE_VISUAL_STYLE}

${GLOBAL_IMAGE_RULES}

Labels:
Readable image text is allowed for page title, curated node names, short chapter headings, and one- to three-word callout labels. Do not render any product logo or app name as a logo or title. No official signage. No prices. No hours. No route times. No source citations. No long factual captions.

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}.

Aspect ratio:
${input.aspectRatio ?? "16:9"}.
`.trim();

  return {
    prompt,
    promptVersion: ROAMATLAS_PROMPT_VERSION,
    pageType: input.pageType,
    zoomLevel: input.zoomLevel,
    recommendedNegativePromptTerms: NEGATIVE_STYLE_TERMS
  };
}
