# WanderSG Engineering Review

Date: 2026-05-09
Skill: gstack plan-eng-review
Mode: implementation lock-in before first code slice

## Product Boundary

WanderSG's core invariant is non-negotiable:

> AI can generate the visual layer. AI cannot invent factual travel claims.

This means the first implementation must make the factual graph the authority.
Images, prompts, and visual placeholders can make the product feel alive, but
all labels, drill-down text, itinerary items, and confidence badges must come
from structured curated data.

## Main-Branch Reference Update

After reading `main:AGENTS.md` and `main:docs/PRODUCT.md`, this plan now includes the
Design Agent and Adaption Labs design-reference constraints.

Adaption Labs is a design critique lens for this repo, not the image backend.
For this demo branch, that means:

- Make click targets obvious without making the scroll feel like a normal map.
- Keep recovery paths visible: scene list, overview return, and breadcrumb.
- Make the trust boundary visible: facts, source type, confidence, and source
  links sit outside the illustration layer.
- Review the full loop: pan, click, drill down, save, build itinerary.
- Do not use paid Adaption Labs credits, account access, or exports without
  explicit user approval.

## Openflipbook Architecture Update

The interaction model should move from visible fixed hotspots to
image-is-the-UI:

```text
generated page
  -> click anywhere
  -> click resolver describes the clicked region
  -> curated node matcher accepts, disambiguates, or rejects
  -> load/generate next page or show unmapped detour
```

This borrows the openflipbook loop without inheriting its factual risk. The VLM
is allowed to describe pixels, not to decide travel truth. The curated
Singapore graph remains the only source of verified nodes.

The first local implementation uses deterministic precomputed click regions
from `ScrollScene.hotspots`. The production adapter can later replace the
description step with a VLM while preserving the matcher contract.

## Recommended First Slice

Build Phase 1 as a dependency-light static MVP:

- Static scene graph with Singapore overview, four theme scenes, and the zoo
  deep path.
- Curated node records with facts, source type, confidence, and URLs when
  available.
- Tile-based scroll contracts and deterministic cache keys.
- Deterministic hotspot hit testing before any AI routing.
- Saved discovery state in the browser.
- Itinerary generation from saved curated nodes only.
- Unmapped search and click fallback that is clearly labeled unconfirmed.

Do not start with accounts, a database, real image generation, or full routing.
Those would add infrastructure before the product proves the explorer loop.

## Architecture

Use four layers:

1. `src/data`: curated scene graph, sources, scenes, tiles, hotspots.
2. `src/domain`: pure functions for guardrails, hit testing, cache keys,
   node selection, saved discovery validation, and itinerary creation.
3. `src/ui`: browser rendering that consumes data and domain functions.
4. `index.html` and `src/styles.css`: static shell.

The important product risk is hallucination, not rendering difficulty. Put tests
around the domain layer first.

## Data Contracts

Keep the contracts close to `docs/PRODUCT.md` and `AGENTS.md`:

- `AtlasNode`: typed node with child ids, tags, facts, and itinerary hints.
- `Fact`: text, source type, confidence, source URL, checked-at timestamp.
- `ScrollScene`: coordinate space, tile grid, tiles, hotspots, ambient layers,
  camera presets, style version, and data version.
- `SceneTile`: status, prompt, continuity prompt, deterministic cache key, and
  image model.
- `Hotspot`: deterministic geometry, confidence, and action.

Use JSDoc typedefs in the first slice so the repo can run without installing a
build pipeline. Move to TypeScript when the React/Vite shell is introduced.

## Edge Cases To Test Now

- Planner rejects ids that are not curated nodes.
- Planner does not include animal or anatomy nodes as normal POI stops unless
  they are nested under their confirmed attraction context.
- Unknown searches return an unmapped detour instead of a fake node.
- Animal exhibit claims require confirmed data.
- Generated image records are never accepted as fact sources.
- Tile cache keys change when scene id, tile id, style version, data version,
  prompt version, or image model changes.
- Click conversion maps viewport coordinates into scene coordinates.
- Overlapping hotspots choose the highest `zIndex`.
- Scene transitions preserve the selected known node.
- Missing tiles still leave hotspots and facts usable.

## Implementation Decisions

- Use Node's built-in test runner for TDD. No install step is needed.
- Use static HTML/CSS/JS for the first app shell. It is less fancy than React,
  but it gets the product loop running immediately and keeps tests fast.
- Represent images as paper-texture placeholders in Phase 1. The image provider
  adapter exists now, but throws clearly until configured.
- Use official or curated source URLs beside facts. Keep long source text out of
  the repo.
- Render labels in the frontend. Never bake factual labels into images.

## Review Verdict

Approved for first implementation with one constraint: every user-facing fact
must be traceable to the curated graph, and every unknown path must become an
unmapped detour. This is the whole product. If that boundary slips, the pretty
map becomes a travel hallucination machine.
