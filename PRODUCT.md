# WanderSG Product Document

## One-Liner

WanderSG is a travel planner that behaves like an illustrated encyclopedia.
Users wander from Singapore into districts, attractions, zoo zones, animals,
and anatomy plates, then save discoveries into a practical itinerary.

## Product Thesis

Trip planning is usually a search results problem: lists, tabs, bookmarks, and
generic itineraries. WanderSG turns planning into exploration. The user starts
with a visual world, drills into places and living things, learns why they
matter, and converts the discoveries into a route they can actually follow.

The core product rule:

> AI draws the world. Curated data says what is true.

The visual layer can be generated. The factual layer must be grounded in
curated records, official pages, or clearly labeled general knowledge.

## Target User

Primary user for the first version:

- A visitor planning 1 to 3 days in Singapore.
- They want a trip that feels personal, visual, and easy to understand.
- They dislike reading long travel blogs or comparing many tabs.
- They care about practical details: time, budget, route grouping, food nearby,
  and what is worth skipping.

Secondary user:

- A curious learner who wants to explore Singapore like an illustrated atlas,
  especially wildlife, neighborhoods, and cultural zones.

## Product Modes

### Hackathon MVP Mode

Goal: make the product demoable in hours, not months.

Scope:

- Singapore only.
- One illustrated overview scene.
- 4 district or theme scenes.
- 12 to 20 curated points of interest.
- One deep-dive path for Mandai / Singapore Zoo.
- 3 zoo zones and 8 to 12 animals for the deepest demo.
- One itinerary builder that only uses the curated node list.
- Clear labels for confirmed facts, general facts, and unconfirmed detours.

This mode should feel like a generative visual browser, but it should use a
controlled scene graph underneath.

### Long-Term MVP Mode

Goal: keep the same product idea, but make the data and agent workflow durable.

Scope:

- Expand from fixed scenes to a maintained knowledge graph.
- Add source tracking per fact.
- Add image generation jobs with caching and moderation.
- Add user-saved discoveries and editable itineraries.
- Add official-source refresh workflows.
- Add a review queue for unverified or conflicting facts.

## Core Experience

### 1. Start With Intent

The user enters:

- Trip length: 1, 2, or 3 days.
- Budget: low, medium, high.
- Interests: food, skyline, wildlife, culture, hidden gems, family, romantic,
  photography, nature.
- Pace: relaxed, balanced, packed.

### 2. Explore Singapore Visually

The app shows an illustrated Singapore scene. The user can zoom, pan, and click
regions. Each click either:

- Enters a known scene.
- Opens a known point of interest.
- Shows an "unmapped detour" state if the area is not in the curated graph.

The user should feel like they can wander freely, but the system should never
invent factual claims about real places.

### 3. Drill Into a Place

For a place like Marina Bay or Singapore Zoo, the page shows:

- Illustrated scene.
- Short description.
- Why it fits the user's trip.
- Best time to visit.
- Suggested stay duration.
- Budget estimate.
- Transport guidance.
- Nearby food or next stop.
- Pitfalls.
- Photo notes.
- Source and confidence labels.

### 4. Drill Into Wildlife and Anatomy Plates

The standout demo path:

```text
Singapore
  -> Mandai
    -> Singapore Zoo
      -> Wild Africa
        -> Giraffe
          -> Anatomy plate
          -> Behavior
          -> Diet
          -> Conservation status
          -> Visit tip
```

For animals, the product separates:

- Exhibit facts: whether this animal is confirmed in this attraction or zone.
- General biology: anatomy, diet, behavior, habitat, conservation.
- Visit facts: where and when to see it, if known.

If the user searches for something like "blue whale" inside Singapore Zoo, the
product must not pretend it is a live exhibit. It should say:

```text
Blue whale is not confirmed as a live Singapore Zoo exhibit in the current
curated data. You can explore it as a general encyclopedia entry, or see nearby
Mandai experiences instead.
```

### 5. Save Discoveries Into an Itinerary

Every place, zone, animal, or route idea can be saved.

The itinerary builder groups saved discoveries by:

- Geography.
- Opening hours when verified.
- Estimated duration.
- User pace.
- Food breaks.
- Transport friction.

The itinerary should prefer realistic grouping over novelty. For example,
Mandai attractions should usually stay on the same day instead of being split
across far-away city stops.

## MVP Scene Graph

Use a typed scene graph, not freeform generation.

```ts
type NodeType =
  | "country"
  | "district"
  | "attraction"
  | "zone"
  | "animal"
  | "anatomy_plate"
  | "itinerary_item"
  | "detour";

type FactSourceType =
  | "official"
  | "curated"
  | "general_reference"
  | "ai_generated"
  | "unknown";

type FactConfidence =
  | "confirmed"
  | "likely"
  | "general"
  | "unconfirmed";

type AtlasNode = {
  id: string;
  type: NodeType;
  title: string;
  parentId?: string;
  childIds: string[];
  tags: string[];
  scenePrompt?: string;
  imageCacheKey?: string;
  facts: Fact[];
  itineraryHints?: ItineraryHints;
};

type Fact = {
  id: string;
  text: string;
  sourceType: FactSourceType;
  confidence: FactConfidence;
  sourceUrl?: string;
  checkedAt?: string;
};

type ItineraryHints = {
  typicalDurationMinutes?: number;
  bestTimeOfDay?: "morning" | "afternoon" | "evening" | "night";
  budgetLevel?: "low" | "medium" | "high";
  nearbyNodeIds?: string[];
};
```

## MVP Content Map

### Singapore Overview

Suggested first scenes:

- Marina Bay / Civic District.
- Heritage Belt: Chinatown, Kampong Glam, Little India.
- Sentosa / Southern waterfront.
- Nature and wildlife: Mandai, Botanic Gardens, East Coast.

### Points of Interest

Start with 12 to 20 curated POIs. Each POI must have:

- Stable id.
- Title.
- Area.
- Tags.
- Estimated duration.
- Budget level.
- Best time.
- Practical tips.
- Source records.

### Deep Wildlife Path

Start with one high-quality deep path:

- Mandai.
- Singapore Zoo.
- 3 zones.
- 8 to 12 animals.
- 2 to 3 anatomy plates.

The deep path is where WanderSG shows that it is more than a pretty travel map.

## Visual Product Language

The visual style should feel like:

- Illustrated natural history encyclopedia.
- Vintage travel atlas.
- Dynamic scroll painting inspired by "Along the River During the Qingming
  Festival": dense, lived-in, panoramic, and explorable.
- Warm paper texture.
- Ink outlines.
- Soft watercolor shading.
- Numbered callouts for anatomy plates.
- Minimal text baked into generated images.

Text labels should be rendered by the frontend whenever possible. Generated
images often misspell labels or invent details.

## Dynamic Scroll Experience

WanderSG should feel closer to an interactive moving scroll than a normal travel
website.

The target interaction model:

- The user enters a panoramic Singapore scroll, not a static card grid.
- The scene contains many small moments: commuters, food stalls, wildlife,
  skyline landmarks, garden paths, zoo habitats, boats, rain shelters, families,
  and hidden details.
- The user can pan across the world, zoom into dense areas, and click details.
- Clicks create a feeling of being pulled deeper into the painted world.
- Confirmed nodes become factual drill-downs.
- Unmapped details become clearly labeled AI-imagined detours.
- Saved discoveries are collected from the scroll into a practical itinerary.

This should feel like Flipbook in spirit: visual, alive, clickable, and
surprising. It should not depend on a true pixel-stream browser architecture for
the first version. The MVP should simulate that feeling with scene tiles, camera
motion, layered hotspots, generated illustrations, and cached drill-down scenes.

### Scene Structure

Use a multi-layer scroll instead of a single flat image:

- Background: large panoramic Singapore scene.
- Region layer: district and attraction hit zones.
- Detail layer: small interactive moments and POIs.
- Annotation layer: frontend-rendered labels, confidence badges, and callouts.
- Motion layer: subtle ambient animation, camera movement, click ripples, and
  transition effects.

### Interaction Rules

- Pan and zoom should work on the main scroll.
- Clicking a known region should zoom or glide into that region.
- Clicking a known detail should open a node detail or deep-dive scene.
- Clicking an unknown detail should show an unmapped detour choice.
- Generated visuals should never silently change the factual graph.

## Image Generation Strategy

Use `gpt-image-2` as the preferred target image model for WanderSG image
generation. Because image model availability can vary by environment, implement
this through a configurable image provider adapter instead of scattering the
model string through product code. If the runtime cannot access `gpt-image-2`,
the app must fail clearly or use an explicitly configured fallback model.

Use a hybrid strategy.

Pre-generate:

- Singapore overview.
- 4 major district or theme scenes.
- Core deep-dive scenes for the demo path.
- The first panoramic scroll tiles required for a smooth demo.

Generate on demand:

- Personalized scene variants.
- Less common POI scenes.
- Anatomy plate variants.
- Unmapped detour illustrations.
- Additional scroll tiles or close-up scenes after user interaction.

Cache every generated image by:

- Node id.
- Tile id or scene segment id.
- Style version.
- Vibe.
- Locale.
- Data version.
- Prompt version.
- Image model.

Images must not be treated as sources of truth.

## Fact Grounding Strategy

Every factual claim should have one of these labels:

- Confirmed: grounded in official or curated source.
- General: true as general background knowledge, not necessarily specific to
  the attraction.
- Unconfirmed: not found in the curated graph.
- AI imagined: visual or narrative only, not a factual travel claim.

Official and curated sources should be tracked in a source registry. Initial
source categories:

- Singapore Tourism Board / Visit Singapore pages.
- Official attraction pages.
- Mandai / Singapore Zoo pages.
- Official maps and downloadable visitor guides.
- Curated local dataset maintained in this repo.

If a claim affects travel usefulness, such as opening hours, ticketing, transit,
closures, or live animal availability, it should be checked close to display
time or labeled as approximate.

## AI Responsibilities

### Allowed

- Select from known nodes.
- Summarize curated facts.
- Generate scene prompts.
- Generate itinerary drafts from known POIs.
- Explain why a node fits a user's stated interests.
- Create "AI imagined detour" text when clearly labeled.

### Not Allowed

- Invent attractions.
- Invent official opening hours.
- Invent live animal availability.
- Invent exact MRT or travel times unless backed by a source or labeled
  approximate.
- Treat image content as factual evidence.
- Mix unconfirmed detours into the itinerary as confirmed places.

## Itinerary Rules

The planner should:

- Only use curated POI nodes by default.
- Group nearby nodes.
- Respect user pace.
- Include meals and rest breaks.
- Prefer realistic day shapes over maximum item count.
- Explain tradeoffs when skipping a popular place.
- Label approximate timing.

The planner should not:

- Add places that are not in the provided node list.
- Claim exact opening hours without a fresh source.
- Create route plans that bounce across the island unnecessarily.

## MVP Screens

### Home

Input fields:

- Days.
- Budget.
- Interests.
- Pace.

Primary action:

- Generate Wander Map.

### Explorer

Main surface:

- Illustrated scene.
- Zoom and pan.
- Clickable regions.
- Scene breadcrumb.
- Save discovery action.

Side panel:

- Selected node details.
- Fact confidence labels.
- Source links.
- Add to itinerary.

### Deep Dive

For attractions and animals:

- Scene or anatomy plate.
- Facts grouped by category.
- Source and confidence labels.
- Related nodes.
- Save action.

### Itinerary

Shows:

- Day-by-day plan.
- Time blocks.
- Saved discoveries.
- Budget notes.
- Transport notes.
- Warnings for approximate or unverified details.

## Non-Goals For First Version

- Full global travel planner.
- Real-time hotel or flight search.
- Exact route optimization.
- User accounts.
- Payment.
- Full GIS map accuracy.
- Every Singapore attraction.
- Fully arbitrary pixel-level click understanding.

## Success Criteria

Hackathon success:

- A user can generate a Singapore plan.
- A user can click into a visual map.
- A user can drill into Singapore Zoo and an animal anatomy plate.
- A user can save discoveries and produce a practical itinerary.
- The demo clearly shows that AI visuals and factual claims are separate.

Product success:

- Users trust the factual labels.
- Users save multiple discoveries before generating a plan.
- Itineraries feel realistic enough to follow.
- The visual explorer helps users discover places they would not have searched
  for directly.

## Roadmap

### Phase 0: Documentation and Data Contract

- Product document.
- Agent document.
- Initial scene graph schema.
- Initial source registry.

### Phase 1: Static MVP

- React app shell.
- Mock scene graph.
- Illustrated-style UI without live image generation.
- Itinerary builder using curated data only.

### Phase 2: AI-Assisted MVP

- LLM itinerary generation from known nodes.
- Scene prompt generation.
- Image generation with cache.
- Fact label rendering.

### Phase 3: Source-Grounded Product

- Official-source ingestion.
- Source freshness checks.
- Review queue.
- Admin tooling for curated facts.

### Phase 4: Rich Exploration

- More Singapore districts.
- More deep wildlife and culture paths.
- Shareable itineraries.
- Export.
- User collections.
