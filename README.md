# WanderSG

WanderSG is a travel planner that behaves like an illustrated encyclopedia.

Users can wander from Singapore into attractions, zones, animals, and anatomy
plates, then save discoveries into a practical itinerary. The visual layer is
AI-generated, while factual claims are grounded in curated and official data.

## Product Idea

- Explore Singapore through linked encyclopedia-style entries.
- Move between places, zones, wildlife, and detailed visual plates.
- Save discoveries into an itinerary that is useful for a real trip.
- Separate AI-generated illustrations from verified factual content.

## Project Docs

- [PRODUCT.md](PRODUCT.md) is the product source of truth.
- [AGENTS.md](AGENTS.md) is the operating guide for coding, research, image,
  fact-check, and itinerary agents.

## Local Secrets

Never commit API keys. `.env` and `.env.*` are gitignored.

For local image generation, create a private `.env` from `.env.example` or pass
environment variables directly when starting the dev server:

```bash
FAL_KEY="..." npm run dev
```

Nano banana 2 through fal is the default image provider:

```bash
FAL_KEY="..." WANDERSG_IMAGE_PROVIDER=fal WANDERSG_IMAGE_MODEL=fal-ai/nano-banana-2 npm run dev
```

If a key is pasted into chat, rotate it after testing.

## Runtime Image Cache

Click-generated flipbook jobs and images are runtime artifacts. By default, the
dev server stores them outside the repo at the OS temp path
`wandersg-runtime-cache` and serves them through `/runtime-cache/...`.

Set `WANDERSG_RUNTIME_CACHE_DIR` to point at another private local directory.
For production, keep job metadata in Redis and image files in object storage; do
not commit generated runtime images to the codebase.
