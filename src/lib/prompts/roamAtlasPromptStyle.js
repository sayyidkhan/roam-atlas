export const ROAMATLAS_PROMPT_VERSION = "roamatlas-flipbook-v6-fast-focus";

export const CORE_VISUAL_STYLE = `
Core visual style:
- clean isometric or lightly axonometric hand-drawn illustration
- thin grey ink outlines
- muted pastel colors, pale blue water, desaturated greens, light beige paths
- simple geometric forms with minimal soft shading
- generous spacing
- clear object separation
- calm urban planning proposal board restraint
- museum guide / architectural visual encyclopedia feeling
`;

export const GLOBAL_IMAGE_RULES = `
Global image rules:
1. Short readable image text is allowed when it is supplied by the app: page titles, curated node names, short chapter labels, numbers, and one- to three-word callout headings.
2. Do not generate prices, opening hours, route times, official signage, official claims, source citations, marketing copy, or long factual paragraphs.
3. Prefer fewer meaningful objects, strong negative space, and obvious click targets.
4. Do not treat image content as factual proof. Frontend overlays own exact facts and source badges.
5. For study plates, use blank callout boxes, leader lines, numbered anchors, or small inset diagrams; never factual image captions.
6. Keep all important subjects and supplied labels inside the central 3:2 safe area. Use simple visual bleed at the edges.
7. Never render app names, product logos, old product names, or brand-like decorative titles.
`;

export const NEGATIVE_STYLE_TERMS = [
  "crowded travel atlas",
  "dense tourist map",
  "busy panoramic city poster",
  "colorful tourism brochure",
  "children's book map",
  "fantasy city",
  "comic book style",
  "vintage postcard",
  "text-heavy infographic",
  "dense labels",
  "long readable paragraphs",
  "fake readable facts",
  "official signage",
  "too many roads",
  "too many boats",
  "too many trees",
  "too many people",
  "over-detailed city blocks",
  "dramatic lighting",
  "saturated colors",
  "chaotic Qingming scroll"
];
