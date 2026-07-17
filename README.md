# RoamAtlas

RoamAtlas is a travel planner that behaves like an illustrated encyclopedia.

Users can roam from Singapore into attractions, zones, animals, and anatomy
plates, then save discoveries into a practical itinerary. The visual layer is
AI-generated, while factual claims are grounded in curated and official data.

## Product Idea

- Explore Singapore through linked encyclopedia-style entries.
- Move between places, zones, wildlife, and detailed visual plates.
- Save discoveries into an itinerary that is useful for a real trip.
- Separate AI-generated illustrations from verified factual content.

## Project Docs

- [PRODUCT.md](docs/PRODUCT.md) is the product source of truth.
- [AGENTS.md](AGENTS.md) is the operating guide for coding, research, image,
  fact-check, and itinerary agents.

## Country Packs and Routes

The app supports world-level country routing, but explorer behavior is loaded
from registered country packs. Singapore is the first verified pack; Malaysia is
registered as a starter country pack with unconfirmed facts.

Current route shape:

```text
/                         country landing
/:countrySlug             mapped country overview, or redirect to config if unmapped
/:countrySlug/config      country config, available for mapped and unmapped countries
/:countrySlug/place/:id   mapped place or region from that country's pack
```

Country pack registry:

```text
src/data/countryPacks/
  index.js
  malaysia.js
  singapore.js
```

Unmapped countries can have routes and shells, but they must not invent verified
POIs, opening hours, itinerary items, or factual claims until a country pack
exists. Starter country packs may be registered, but their facts must stay
`ai_generated` and `unconfirmed` until source review.

## OpenAI Setup

RoamAtlas uses OpenAI only. Do not add parallel provider keys unless the product
direction changes.

Never commit API keys. `.env` and `.env.*` are gitignored. For local generation,
create a private `.env` from `.env.example` and add the one secret the app uses:

```bash
OPENAI_API_KEY="..."
```

Non-secret model defaults live in `src/config/roamAtlasConfig.js`.

- Text, VLM, and environment models must stay on GPT-5-family or newer models.
- Interactive image generation uses `gpt-image-2` with a compressed JPEG
  profile and a streamed partial preview. The country config screen offers
  Low, Medium, and High output; High is the recommended and default tier.
- Do not add model env overrides for normal local development; edit the config
  file when the project default should change.

Run locally with:

```bash
OPENAI_API_KEY="..." npm run dev
```

If a key is pasted into chat, rotate it after testing.

## Runtime Image Cache

Click-generated flipbook jobs and images are runtime artifacts. By default, the
dev server stores them outside the repo at the OS temp path
`roamatlas-runtime-cache` and serves them through `/runtime-cache/...`.

Runtime artifacts are grouped by country slug:

```text
roamatlas-runtime-cache/
  singapore/
    starter-map/
    image-jobs/
    flipbook/
    understanding/
  malaysia/
    starter-map/
    country-pack-draft/
```

For example, Singapore-generated pages are served from
`/runtime-cache/singapore/flipbook/...`.
Generated filenames include an asset-version hash derived from the prompt,
model, output profile, prompt version, style version, and data version. This
keeps immutable browser caches safe when any generation input changes.

Image jobs can move through `pending_codex_image_generation`,
`processing_openai_image`, `partial_ready`, `ready`, or `failed`. The final
image is published as soon as it is written and decoded; optional ambient-layer
analysis runs afterward and never blocks the factual page or itinerary UI.
Interactive jobs have reserved provider capacity. By default, the app queues
up to ten direct children when a parent opens and the provider can draw up to
ten images concurrently; tune `ROAMATLAS_PREFETCH_DESTINATION_LIMIT` and
`ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY` together when changing that experience.
Unconfirmed country starter maps are stored per country at
`/runtime-cache/{countrySlug}/starter-map/country.json`.
For registered country packs such as Singapore, that starter-map file is a
runtime snapshot of the curated pack, not an AI-generated draft.
When an AI starter map is confirmed for curation, the dev server writes
`/runtime-cache/{countrySlug}/starter-map/confirmation.json` and
`/runtime-cache/{countrySlug}/country-pack-draft/country.json`. These files are
review artifacts; they do not register a live country pack until source-backed
data is moved into `src/data/countryPacks/`.

Malaysia currently ships as an actual country pack at `/malaysia`; its starter
facts stay `ai_generated` and `unconfirmed` until replaced with source-backed
facts.

Set `ROAMATLAS_RUNTIME_CACHE_DIR` to point at another private local directory.
Set `ROAMATLAS_IMAGE_QUALITY` to `low`, `medium`, or `high` to override the
server default; a browser's saved country-config selection takes precedence for
its generation requests. Quality is part of the image cache identity, so assets
from different tiers are never mixed.
For production, keep job metadata in Redis and image files in object storage; do
not commit generated runtime images to the codebase.
