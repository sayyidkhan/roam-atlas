# RoamAtlas Product Document

## One-Liner

RoamAtlas is a travel planner that behaves like an illustrated encyclopedia.
Users roam from Singapore into districts, attractions, zoo zones, animals,
and anatomy plates, then save discoveries into a practical itinerary.

## Product Thesis

Trip planning is usually a search results problem: lists, tabs, bookmarks, and
generic itineraries. RoamAtlas turns planning into exploration. The user starts
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

### Flipbook Prompt Depth

RoamAtlas uses separate image prompt builders by page depth:

- `homepage_overview` is sparse and acts as a visual table of contents.
- Region pages are focused chapter pages for one Singapore area.
- Deep pages are visual study plates: cutaways, exploded views, museum-style
  interpretation diagrams, or natural-history plates.
- Generated images may include short readable titles, curated node names,
  numbered anchors, callout labels, leader lines, and inset diagrams.
- Generated images must not contain invented official facts, prices, opening
  hours, route times, exact routes, source citations, or long captions.
- Exact factual content and source badges remain curated data, even when the
  generated image contains short guide labels.

### 1. Choose a Destination, Then Add Intent

Horizon Atlas 2 is the selected RoamAtlas homepage at `/`, without the design
comparison toolbar. Explicit `?landing=` links retain the comparison previews.
Cinematic Travel is an earlier landing direction. It keeps
photography, one destination heading, an entry action, and a small Cobe globe
within a single screen. Postcard Desk ranks second and Immersive Atlas third;
both remain available through the comparison switcher. The original gold-globe
landing is restored as the fourth option, Original (`?landing=original`), for comparison.
Horizon Atlas (`?landing=horizon`) is the fifth direction, built on the original
dark atlas stage and its expandable photo-card country shelf. The left column
shows the selected country name and Explore action; the large gold Cobe globe
keeps country labels, four-direction controls, continent filtering, and animated
selection. Selecting a shelf card previews the country in the hero and globe;
its Open action enters the atlas. The shelf search respects the continent filter
and can clear it to show all 195 countries. The shelf has continent filter chips
with country counts, using the same selection as the globe in both directions.
Horizon Atlas 2 (`?landing=horizon2`) is a separate sixth comparison option.
It keeps the backdrop and original shelf, places Destinations in a single header,
keeps continent filtering inside Destinations, shows four flag labels, and groups rotation
controls beneath the globe. Horizontal arrows navigate east on right and west
on left. Its hero has a rounded Explore action and a Browse all countries
button that toggles the shelf open and closed, plus a continent label,
and a country-code pill. It has no separate filter bar or country-count link
above the globe. Its top-left editorial intro carries the brand tagline,
“Follow your curiosity,” a two-line “A whole world. Yours to explore.” headline,
and two lines of supporting copy. A divider separates this introduction from
the smaller selected-country heading and actions. Both Horizon versions include Surprise me, which previews a
random catalog country other than the current one, updates its backdrop and
globe, and clears a continent filter if the new country falls outside it.
Country backdrops retain the previous image until the next photograph has
loaded and decoded, then crossfade for 850 ms. Rapid selections ignore stale
image requests. The country heading has a subtle entrance transition; reduced
motion disables both effects.
An Encyclopedia action beside Surprise me retrieves the selected country’s
Wikipedia introduction on demand in a country-profile modal. The modal pairs
a reference-photo cover with a cream reading panel; its close control and
source action remain fixed while the article scrolls. Mobile stacks the cover
above the article. Entries have a source link,
retrieval date, and CC BY-SA attribution, and are labeled general reference
rather than reviewed travel advice. Requests are cached for a day and time out
after 12 seconds, with retry and direct-source fallback.

Only one filter set is visible: the globe controls when the shelf is closed,
and the shelf controls when it is open or expanded.

Clicking Explore or a country card’s Open action shows a skippable cinematic
arrival before entering the registered atlas or country setup. It uses the
selected country’s bundled photograph, country name, code, and continent,
with a slow camera ease and title reveal lasting 3.4 seconds. Back returns to
the landing page; reduced-motion preferences skip the animation. Preview
selection, Surprise me, and explicit Customize actions do not play the intro.

All 195 countries live in a right-side destination drawer, opened from the
header or the selected country beneath the globe. Search stays fixed while its photo grid scrolls. The drawer
fills the screen on mobile and closes after a country is selected. Selection
updates the hero, globe pin, and globe caption together; entering the atlas remains an explicit action. Reopening the drawer scrolls its selected card into view. Search starts a fresh filter, and clearing it returns to the selected country.
Escape and the close button dismiss the drawer without changing the destination,
and focus returns to the control that opened it. Singapore is optional.

The globe uses approximate sourced positions with fixed scale and manual
rotation, country names on pointer hover, and direct pin selection. Browse globe
opens a larger navigator with six continent filters and six named countries nearest
the centre of the visible hemisphere. Country labels are 44px minimum click targets
placed in separate slots on the globe, with leader lines to their approximate
positions. Choices settle after rotation; labels cannot be selected mid-flight.
Continent selection filters all markers, hit targets, labels, and the searchable
country drawer. A count and View all action expose the complete matching catalog,
including countries outside the current hemisphere. Clearing the filter restores
all 195 countries. Grouping follows mledoze region/subregion data, with Central
America and the Caribbean included in North America; transcontinental countries
follow the source's single grouping. Four directional buttons and keyboard arrows
rotate or tilt the globe, with vertical movement clamped near the poles.
A selected-country card shows the catalog photo, name, code, atlas availability,
and an explicit entry action. Photography remains a preview, never fact evidence.
Dragging updates the labeled choices when released. Country and
region changes rotate along the shortest path over 850 ms, with fixed scale;
reduced-motion preferences skip the transition. Dragging interrupts a flight.
The navigator links to the complete country drawer and keeps the hero in sync. The landing omits promotional copy and footer metadata; reference-photo context and coordinate attribution live in the drawer. It has no automatic spin or scroll zoom. If WebGL is unavailable,
country search and selection remain usable through the drawer. Reference photos
and imagined illustrations never serve as factual travel evidence.

Existing registered atlases open directly. Other countries open setup for a
starter atlas, with unverified content labeled accordingly. A source-reviewed
badge requires both source-controlled registration and confirmed confidence.

When configuring their trip, the user enters:

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

The user should feel like they can roam freely, but the system should never
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

The deep path is where RoamAtlas shows that it is more than a pretty travel map.

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

RoamAtlas should feel closer to an interactive moving scroll than a normal travel
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

## Flipbook Page Interaction Model

RoamAtlas follows an image-is-the-UI interaction model inspired by
flipbook.page and openflipbook.

Each exploration state is represented by one generated illustrated page. The
user can click anywhere on the image. The system sends the current image, click
coordinates, and scene metadata to a click resolver. In production, that resolver
may use a vision-language model to return a short phrase describing what the
user clicked.

That phrase is then matched against RoamAtlas' curated Singapore scene graph.

If matched:

- Transition into the verified node.
- Generate or load the next illustrated page.
- Show source-backed facts in UI overlays.
- Let the user save the verified node for itinerary planning.

If not matched:

- Create an AI-imagined detour.
- Label it as unverified.
- Do not use it as confirmed itinerary data.

The VLM can describe pixels. It cannot create travel facts. The curated graph is
the authority.

For speed, generated pages should precompute a small set of likely click regions
in the background. Most taps should resolve from these cached candidates before
falling back to a live VLM resolve. Future implementations may use progressive
rendering, where a fast draft image appears before the final high-quality image
replaces it.

## Adaption Labs Design Reference

Adaption Labs should be treated as a product design and interaction reference
for RoamAtlas, not as the core image-generation backend.

Use it to guide:

- Human-factors review of the dynamic scroll: where users look, where they get
  lost, how they recover, and how much visual density they can handle.
- Prototype critique for the Qingming-scroll interaction model: pan, zoom,
  click, drill-down, return, save discovery, and generate itinerary.
- UX validation for the hardest product transition: moving from playful visual
  exploration into trusted factual planning.
- Design language refinement so the product feels like an explorable illustrated
  encyclopedia, not a normal map app with decorative images.

Why it fits RoamAtlas:

- RoamAtlas is about adaptation between user, product, and environment. The user
  is learning a city through a living visual interface, then turning that
  exploration into decisions.
- The product has high cognitive load: places, animals, routes, facts, sources,
  and AI-generated visuals all compete for attention.
- The biggest design risk is not whether the image looks good. It is whether the
  user understands what is real, what is explorable, and what can become part of
  their itinerary.

If implementation requires paid Adaption Labs credits, account access, or export
limits, the agent must ask the user before using them.

## Image Generation Strategy

Use the pinned `gpt-image-2.5-flare-2026-09-08` snapshot as the preferred
target image model for RoamAtlas image generation. Because image model
availability can vary by environment, implement this through a configurable
image provider adapter instead of scattering the model string through product
code. If the runtime cannot access the preferred model, the app must fail
clearly or use an explicitly configured fallback model.

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

- Generate RoamAtlas Map.

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
