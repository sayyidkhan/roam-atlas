export const ROAMATLAS_PROMPT_VERSION = "roamatlas-flipbook-v4-country-context";

export const CORE_VISUAL_STYLE = `
Core visual style:
- clean isometric or lightly axonometric hand-drawn illustration
- thin grey ink outlines
- muted pastel colors
- pale blue water
- desaturated greens
- light beige roads and paths
- simple geometric buildings
- minimal soft shading
- low visual noise
- generous spacing
- clear object separation
- calm editorial restraint
- urban planning proposal board restraint
- museum guide / architectural visual encyclopedia feeling
`;

export const GLOBAL_IMAGE_RULES = `
Global image rules:
1. Short readable image text is allowed when it is supplied by the app: page titles, curated node names, short chapter labels, numbers, and one- to three-word callout headings.
2. Do not generate prices, opening hours, route times, official signage, official claims, source citations, marketing copy, or long factual paragraphs.
3. If callout boxes appear, keep the text short and diagram-like. Prefer numbered anchors, short labels, and concise headings.
4. Prefer fewer meaningful objects over many small objects.
5. Prioritize clarity over richness.
6. Prioritize negative space over completeness.
7. The image should suggest click targets, not explain everything at once.
8. Parent pages should be more abstract; child pages can become more specific.
9. Do not treat image content as factual proof.
10. Do not create a crowded tourist map.
11. Encyclopedia-style pages should include visual explanation scaffolding such as callout boxes, fine leader lines, numbered anchors, short readable labels, and small inset diagrams.
12. Frontend overlays remain the source of exact facts and source badges.
13. Compose for a browser viewport: keep all important subjects, labels, callouts, and faces inside the central 16:9 safe area, with simple water, paper, sky, lawn, or path bleed near the outer edges.
14. Do not place key text or landmarks at the extreme image edges.
15. Never render app names, product logos, or old product names such as WanderSG or Wander SG.
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
