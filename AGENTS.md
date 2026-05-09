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
