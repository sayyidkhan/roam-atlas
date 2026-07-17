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
  const countryName = getPromptCountryName(input, { fallbackToNodeTitle: false });
  const countrySuffix = countryName === "selected country" ? "" : ` in ${countryName}`;
  const wholeAreaPhrase = getPromptWholeAreaPhrase(countryName);
  const childHints =
    input.knownChildNodeTitles && input.knownChildNodeTitles.length > 0
      ? input.knownChildNodeTitles.slice(0, 8).join(", ")
      : "none supplied; use only the main subject";
  const calloutLabels = normalizeCalloutLabels(input.knownCalloutLabels);
  const calloutDirection = calloutLabels.length > 0
    ? [
        `- Numbered callout headings: ${calloutLabels.map((label, index) => `${index + 1}. ${label}`).join("; ")}.`,
        "- Render each supplied heading exactly once inside its matching numbered callout panel.",
        "- Do not leave a supplied numbered callout panel blank. Do not add extra callout headings."
      ].join("\n")
    : "- No callout headings were supplied. Do not draw numbered anchors or empty callout panels.";
  const density = input.density ?? "restrained";

  const prompt = `
Create a restrained region page for ${input.nodeTitle}${countrySuffix}.

Page type: ${input.pageType}
Zoom level: ${input.zoomLevel}
Density: ${density}
Subject: ${input.visualContext}
Continuity: ${input.parentNodeTitle ? `subtle style continuity with ${input.parentNodeTitle}` : countryName === "selected country" ? "the established calm overview style" : `the calm ${countryName} overview style`}

Composition:
- Focus on one region only, not the whole city.
- Apply ${density} density with separated major objects and generous negative space.
- Show only the most meaningful subject, paths, buildings, or landscape forms.
- Do not show ${wholeAreaPhrase}.

Clickability:
- Curated child subjects: ${childHints}.
- The image itself should include short readable labels only for supplied names.
- Use separated visual forms to show what is clickable.
${calloutDirection}
- Exact facts, recommendations, and source badges belong to frontend overlays.

${CORE_VISUAL_STYLE}

${GLOBAL_IMAGE_RULES}

No prices. No hours. No route times. No source citations or factual captions.

Avoid:
${NEGATIVE_STYLE_TERMS.join(", ")}.

Aspect ratio: ${input.aspectRatio ?? "3:2"}.
`.trim();

  return {
    prompt,
    promptVersion: ROAMATLAS_PROMPT_VERSION,
    pageType: input.pageType,
    zoomLevel: input.zoomLevel,
    recommendedNegativePromptTerms: NEGATIVE_STYLE_TERMS
  };
}

function normalizeCalloutLabels(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((label) => String(label ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);
}
