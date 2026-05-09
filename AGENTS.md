# WanderSG Agent Guide

This file is the operating manual for AI agents working on WanderSG.

WanderSG has a hard product boundary:

> AI can generate the visual layer. AI cannot invent factual travel claims.

Every agent should preserve that boundary.

## Project Goal

Build a travel planner that behaves like an illustrated encyclopedia.

Users can:

- Explore Singapore visually.
- Drill into districts, attractions, zoo zones, animals, and anatomy plates.
- Save discoveries.
- Generate practical itineraries.

The product should feel imaginative, but the facts must be grounded.

## Agent Roles

### Product Agent

Owns:

- Product scope.
- MVP boundaries.
- User stories.
- Acceptance criteria.
- Tradeoffs between hackathon scope and long-term product scope.

Rules:

- Keep the MVP narrow.
- Prefer a complete small path over a shallow giant map.
- Protect the core thesis: visual encyclopedia plus practical itinerary.
- Do not expand scope without naming the user value.

### Design Agent

Owns:

- Adaption Labs-informed design critique.
- Human-factors review.
- Interaction prototype feedback.
- Visual density and wayfinding checks.
- UX handoff notes for coding agents.

Rules:

- Treat Adaption Labs as a design reference and validation layer, not as the
  primary image-generation backend.
- Use the Adaption Labs lens when judging whether the dynamic scroll is usable:
  where users look first, how they know what is clickable, how they recover from
  getting lost, and whether they understand what is factual.
- Review the full exploration loop: pan, zoom, click, drill down, return, save
  discovery, and generate itinerary.
- Protect the product from becoming a pretty but confusing demo. If the visual
  scroll hides facts, sources, or itinerary actions, call that out.
- If a task needs paid Adaption Labs credits, account access, exports, or
  external workspace actions, ask the user before using them. The user has
  credits and can approve usage.

### Research Agent

Owns:

- Official source discovery.
- Source registry updates.
- Fact extraction.
- Freshness checks.
- Conflict detection.

Rules:

- Prefer official sources first.
- Store the source URL beside each fact.
- Label anything not verified as approximate or unconfirmed.
- Never treat generated images as evidence.
- Do not copy long copyrighted text into the repo. Summarize briefly and link.

Suggested source priority:

1. Official attraction pages.
2. Singapore Tourism Board / Visit Singapore.
3. Official maps and visitor guides.
4. Official operator pages, such as Mandai for wildlife attractions.
5. Curated local repo data.
6. General references for biology or background context.

### Fact-Check Agent

Owns:

- Verifying claims before they reach user-facing text.
- Confidence labels.
- Staleness warnings.
- Hallucination prevention.

Rules:

- If a claim affects a real trip, verify it or mark it approximate.
- Live animal availability, opening hours, closures, and ticketing are
  freshness-sensitive.
- If a user asks for an unsupported node, produce an unmapped or encyclopedia
  response instead of pretending it exists in the attraction.
- If sources conflict, show the safer claim and flag the conflict for review.

### Image Agent

Owns:

- `gpt-image-2` image generation through the configured image provider.
- Scene prompts.
- Style consistency.
- Image generation.
- Image caching.
- Visual safety.
- Dynamic scroll scene continuity.

Rules:

- Use `gpt-image-2` as the preferred target model for image generation. If the
  runtime does not support it, use only an explicitly configured fallback and
  surface that fallback in logs or metadata.
- Keep the image model behind a provider adapter. Do not scatter raw model names
  through UI components or product logic.
- Generate images from node facts, not the other way around.
- Avoid embedding important text in images.
- Use frontend-rendered labels for names, callouts, and factual notes.
- Cache images with prompt, data version, scene id, tile id, and image model.
- Never use the image output as proof that a place, animal, route, or feature
  exists.
- Preserve visual continuity between adjacent scroll tiles when generating a
  Qingming-scroll style scene.

Default visual language:

- Illustrated travel atlas.
- Natural history encyclopedia.
- Dynamic Qingming-scroll inspired panorama.
- Warm ivory paper.
- Ink outlines.
- Soft watercolor.
- Numbered callouts.
- Calm, detailed, readable scenes.
- Dense lived-in micro-scenes that reward zooming and clicking.

### Itinerary Agent

Owns:

- Day planning.
- POI selection.
- Route grouping.
- Budget and time estimates.
- Saved discovery conversion.

Rules:

- Only plan from provided curated nodes unless the UI explicitly enters AI
  detour mode.
- Group nearby places.
- Respect pace and trip length.
- Add meals and rest.
- Label approximate timing.
- Do not invent exact opening hours or exact transit time.
- Explain why a recommended node fits the user's interests.

### Coding Agent

Owns:

- Implementation.
- Tests.
- Data contracts.
- UI behavior.
- Integration between scene graph, facts, images, and itinerary.

Rules:

- Read `PRODUCT.md` before major changes.
- Keep AI calls behind typed interfaces.
- Keep curated data separate from generated content.
- Implement the visual world as tile-based dynamic scroll architecture, not as
  a single giant image and not as true real-time pixel rendering.
- Add tests for planner constraints and hallucination guardrails.
- Do not hardcode machine-specific paths.
- Keep the first product slice small and demoable.

## Data Model Principles

Use a scene graph. Do not let the app become loose strings passed between
prompts.

Required node concepts:

- `country`
- `district`
- `attraction`
- `zone`
- `animal`
- `anatomy_plate`
- `itinerary_item`
- `detour`

Required fact concepts:

- Text.
- Source type.
- Confidence.
- Source URL when available.
- Checked-at timestamp when relevant.

Required confidence labels:

- `confirmed`: backed by official or curated source.
- `likely`: plausible but not fully verified.
- `general`: background knowledge, not specific to the attraction.
- `unconfirmed`: not present in curated sources.

## Tile-Based Dynamic Scroll Architecture

Use option 2 for the visual system: a tile-based dynamic scroll.

This means WanderSG should feel like an interactive Qingming-style long scroll,
but the product should be built from generated scene tiles, deterministic
hotspots, camera motion, and cached drill-down scenes. Do not build a true
Flipbook-style real-time pixel browser for the first product slice.

### Why This Architecture

Tile-based dynamic scroll gives the product the right feeling without losing
control of facts.

Compared with true real-time pixel rendering:

- It is faster because most images are pre-generated or cached.
- It is cheaper because each click does not regenerate an entire screen.
- It is more consistent because adjacent tiles can share prompts, anchors, and
  style versions.
- It is safer because clicks resolve to known scene graph nodes before factual
  text is shown.
- It is easier to test because hotspots, facts, and itinerary items are data.

### Core Model

Represent every explorable visual world as a `ScrollScene`.

```ts
type ScrollScene = {
  id: string;
  title: string;
  rootNodeId: string;
  coordinateSpace: {
    width: number;
    height: number;
    unit: "virtual_px";
  };
  tileGrid: {
    columns: number;
    rows: number;
    tileWidth: number;
    tileHeight: number;
    overlapPx: number;
  };
  tiles: SceneTile[];
  hotspots: Hotspot[];
  ambientLayers: AmbientLayer[];
  cameraPresets: CameraPreset[];
  styleVersion: string;
  dataVersion: string;
};

type SceneTile = {
  id: string;
  sceneId: string;
  row: number;
  column: number;
  bounds: Rect;
  imageUrl?: string;
  status: "missing" | "queued" | "generating" | "ready" | "failed";
  prompt: string;
  continuityPrompt: string;
  cacheKey: string;
  imageModel: string;
  generatedAt?: string;
};

type Hotspot = {
  id: string;
  sceneId: string;
  nodeId?: string;
  kind: "region" | "poi" | "detail" | "animal" | "detour";
  shape: Rect | Polygon;
  zIndex: number;
  label?: string;
  confidence: "confirmed" | "general" | "unconfirmed" | "ai_imagined";
  action:
    | { type: "enter_scene"; sceneId: string }
    | { type: "open_node"; nodeId: string }
    | { type: "show_detour"; detourId: string };
};

type AmbientLayer = {
  id: string;
  kind: "water" | "cloud" | "light" | "crowd" | "foliage" | "traffic";
  bounds: Rect;
  intensity: "subtle" | "medium";
};

type CameraPreset = {
  id: string;
  label: string;
  targetBounds: Rect;
  zoom: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Polygon = {
  points: Array<{ x: number; y: number }>;
};
```

### Scene Hierarchy

The first implementation should use a small set of scenes:

```text
singapore-overview
  -> marina-bay-scroll
  -> heritage-belt-scroll
  -> sentosa-south-scroll
  -> nature-wildlife-scroll
       -> mandai-scroll
          -> singapore-zoo-scroll
             -> wild-africa-scroll
                -> giraffe-anatomy-plate
```

Each scene owns its own coordinate space, tiles, hotspots, and camera presets.
Do not try to make one infinite global coordinate system in the first version.

### Tile Generation Flow

The image agent should generate tiles through a queue.

```text
Scene plan
  -> tile prompts
  -> gpt-image-2 provider adapter
  -> image artifact storage
  -> tile cache record
  -> frontend loads ready tiles
```

Every tile generation job must include:

- `sceneId`
- `tileId`
- `row`
- `column`
- `bounds`
- `styleVersion`
- `dataVersion`
- `promptVersion`
- `imageModel`
- `basePrompt`
- `continuityPrompt`
- Neighbor context for left, right, top, and bottom tiles when available.

### Cache Key

Cache keys must be deterministic.

```text
scene:{sceneId}:tile:{tileId}:style:{styleVersion}:data:{dataVersion}:prompt:{promptVersion}:model:{imageModel}
```

Changing factual data, prompt template, style direction, or image model should
produce a new cache key. Do not overwrite old generated images without keeping
metadata that explains the change.

### Continuity Rules

Adjacent tiles must feel like one scroll, not separate postcards.

For each tile prompt, include:

- Shared global scene description.
- Tile position in the larger scroll.
- Neighbor summaries.
- Edge continuity notes.
- Persistent anchors, such as river direction, skyline location, path direction,
  forest edge, zoo habitat boundary, or MRT line.

Continuity prompt template:

```text
This tile is part of a larger panoramic Singapore scroll.
Scene: {{SCENE_TITLE}}
Tile position: row {{ROW}}, column {{COLUMN}} of {{ROWS}} x {{COLUMNS}}.

Global anchors:
{{GLOBAL_ANCHORS}}

Left edge should connect to:
{{LEFT_NEIGHBOR_SUMMARY}}

Right edge should connect to:
{{RIGHT_NEIGHBOR_SUMMARY}}

Top edge should connect to:
{{TOP_NEIGHBOR_SUMMARY}}

Bottom edge should connect to:
{{BOTTOM_NEIGHBOR_SUMMARY}}

Keep the same paper texture, line weight, lighting, perspective, and density.
Do not add readable labels, fake signs, ticket prices, opening hours, or official
logos.
```

### Frontend Rendering Layers

Render the scroll as layered UI:

```text
Viewport camera
  -> tile image layer
  -> ambient motion layer
  -> hotspot hit-test layer
  -> factual label layer
  -> selection and ripple layer
  -> side panel / drill-down overlay
```

Recommended implementation path:

- Use CSS transforms or a canvas stage for camera pan and zoom.
- Use DOM or SVG overlays for hotspots and labels in the first version.
- Use polygon hit testing for irregular regions.
- Use lazy loading for tiles near the viewport.
- Use prefetching for adjacent tiles and likely drill-down scenes.
- Use Framer Motion or equivalent transition primitives for camera glide,
  click ripple, fade, and zoom-through effects.

The frontend should treat images as visual background only. Factual labels,
badges, callouts, source links, itinerary actions, and animal names should come
from structured data.

### Click Resolution

Click handling must be deterministic before using AI.

```text
User click in viewport coordinates
  -> convert to scene coordinates
  -> find topmost hotspot containing point
  -> if known node: open node or enter scene
  -> if ambiguous: show a choice menu
  -> if no hotspot: show unmapped detour option
```

Only use an LLM for ambiguous clicks after providing the candidate hotspot list.
The LLM may choose from candidates, return ambiguous, or return unmapped. It may
not invent a new real node.

### Motion Design

The scroll should feel alive, but motion must not compromise readability.

Allowed:

- Slow water shimmer.
- Soft cloud drift.
- Slight foliage movement.
- Lantern or city light glow.
- Small crowd loops as overlay sprites.
- Camera glide between scenes.
- Click ripple and zoom-through transition.

Avoid:

- Constant full-screen motion.
- Animation baked into factual labels.
- Motion that changes the meaning of a place.
- AI-generated text inside moving image content.

### Fallback Behavior

If a tile is missing:

- Show a paper-texture placeholder with the scene title.
- Keep hotspots usable if their geometry is already known.
- Queue generation if allowed.
- Show "illustration pending" rather than hiding factual content.

If tile generation fails:

- Keep the factual node accessible.
- Surface retry metadata for developers.
- Do not block itinerary generation.

### Testing Requirements

Test that:

- Viewport clicks convert correctly into scene coordinates.
- Hotspot priority works with overlapping shapes.
- Unknown clicks produce unmapped detours.
- Tile cache keys change when model, prompt, style, or data version changes.
- Generated images are never used as fact sources.
- Scene transitions preserve the selected node.
- Missing tiles do not break itinerary or fact display.

## Prompting Rules

### Node Selection Prompt Rule

When asking an LLM to choose a destination, provide the known node list and
force selection from that list.

Template:

```text
You are choosing the next WanderSG node.

You may only choose one of these known node ids:
{{KNOWN_NODE_IDS}}

User intent:
{{USER_INTENT}}

Current node:
{{CURRENT_NODE}}

Return JSON only:
{
  "nodeId": "one known id or null",
  "status": "matched" | "ambiguous" | "unmapped",
  "reason": "short explanation"
}

Do not invent places, animals, opening hours, routes, or official facts.
```

### Itinerary Prompt Rule

The itinerary agent may only use supplied POIs.

Template:

```text
You are creating a Singapore itinerary from curated WanderSG nodes.

Rules:
- Use only the provided nodes.
- Group nearby nodes.
- Respect the user's pace.
- Mark timing as approximate.
- Do not invent opening hours.
- Do not add places outside the node list.

User preferences:
{{PREFERENCES}}

Available nodes:
{{NODES_JSON}}

Saved discoveries:
{{SAVED_NODE_IDS}}

Return JSON only using this shape:
{
  "days": [
    {
      "day": 1,
      "theme": "...",
      "items": [
        {
          "nodeId": "...",
          "startTime": "approximate HH:MM",
          "durationMinutes": 90,
          "reason": "...",
          "notes": ["..."]
        }
      ],
      "warnings": ["..."]
    }
  ]
}
```

### Image Prompt Rule

Image prompts should describe style and visible scene, not factual labels.

Template:

```text
Draw a panoramic illustrated travel-atlas scene of {{NODE_TITLE}} in Singapore.
The experience should feel like an interactive modern Qingming scroll: dense
micro-scenes, lived-in details, readable paths, warm ivory paper texture, clean
ink outlines, soft watercolor shading, natural history encyclopedia precision,
and calm editorial composition.

Include visible context:
{{VISUAL_CONTEXT}}

Continuity constraints:
{{SCENE_CONTINUITY}}

Do not include long readable text. Do not invent signage, opening hours,
official logos, animal names, ticket prices, or exact route labels.
```

### Unmapped Detour Rule

If the user clicks or searches for something outside the curated graph:

```text
This is not mapped in WanderSG's verified data yet.
You can explore it as an AI-imagined detour, but it will not be treated as a
confirmed travel fact until reviewed.
```

## Guardrails

### Never Invent

- Opening hours.
- Ticket prices.
- Closures.
- Exact transport times.
- Live animal availability.
- Official attraction relationships.
- Source citations.

### Always Label

- Approximate timings.
- General animal biology.
- AI-imagined detours.
- Unverified user-suggested places.
- Cached images generated from older data.

### Escalate For Human Review

- Conflicting official sources.
- Stale opening hours.
- Claims about safety, accessibility, or medical needs.
- Claims about animals currently on display.
- Any source that looks scraped from an unofficial aggregator.

## Implementation Priorities

### First Slice

Build:

- Static scene graph.
- Singapore overview.
- 4 district scenes.
- 12 to 20 POIs.
- Singapore Zoo deep path.
- Save discovery.
- Generate itinerary from selected nodes.
- Fact confidence labels.

Skip:

- Accounts.
- Payments.
- Full database.
- Multi-city support.
- Real map routing.
- Arbitrary pixel-level AI grounding.

### Test Priorities

Test that:

- Planner only uses provided nodes.
- Unknown searches become unmapped detours.
- Animal exhibit claims require confirmed data.
- Generated images are not used as fact sources.
- Saved discoveries flow into itinerary output.
- Approximate fields are labeled.

## Definition of Done

A change is done when:

- It preserves the visual/factual separation.
- It works for the demo path.
- It does not invent unsupported claims.
- It has updated docs or data contracts if behavior changed.
- It has focused tests for risky logic.
