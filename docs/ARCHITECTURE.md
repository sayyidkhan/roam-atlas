# RoamAtlas Architecture

## Status

This document records the architecture in use. It is the compatibility baseline
for future refactoring; it is not a proposal for a rewrite.

## Non-Negotiable Invariant

> AI generates the visual layer. Curated data is the only authority for travel facts.

Generated images, VLM descriptions, reference-photo results, and unreviewed
starter maps cannot become verified facts or confirmed itinerary items without
an explicit curated-data change.

## Current Stack

| Concern | Current choice | Responsibility |
| --- | --- | --- |
| Runtime | Node.js 22.18+ | API runtime, type stripping, and build tooling |
| Workspace | npm workspaces | Independent applications and shared packages |
| Web | React 19, TypeScript, Vite 8, React Router 7 | Browser composition and static production build |
| Remote state | TanStack Query 5 | Browser cache, polling, mutations, and invalidation |
| API | Hono 4 on Node.js | Feature-owned HTTP routes |
| Contracts | Zod 4 | Runtime request and response validation |
| Current persistence | Source-controlled packs and API-owned runtime files | Curated facts, generated media, jobs, and review artifacts |
| AI | Provider adapters | Image generation and visual description only |
| Tests | Node test runner, Vitest, Playwright | Unit, component, contract, and browser coverage |

PostgreSQL with Drizzle, object storage, and a durable job queue remain planned
production persistence upgrades. They should replace adapters inside
`apps/api`; they do not require another repository reorganization.

Do not introduce microservices, Redis, authentication, payments, or WebGL until
a concrete product requirement justifies them.

## Repository Shape

```text
apps/
  web/                         deployable React/Vite application
    index.html
    vite.config.js
    src/
      app/                     React composition and browser runtime adapters
      config/                  browser-safe application policy
      features/                UI, clients, controllers, and local styles
      styles/                  global tokens, defaults, and accessibility
  api/                         deployable Hono application
    src/
      main.ts                  dependency composition and process lifecycle
      config/                  server and provider policy
      data/                    API-owned scene data and curated country packs
      features/                routes, services, policies, repositories
      platform/                HTTP, environment, media, runtime, OpenAI adapters
      server/                  Hono error boundary and route composition
packages/
  atlas-contracts/             shared Zod API contracts
  atlas-data/                  browser-safe shared catalog/config data
  atlas-domain/                pure product and guardrail policy
  atlas-prompts/               prompt construction from structured inputs
public/                        web-owned static artwork fixtures/assets
test/                          cross-workspace tests and local browser fixtures
```

There is intentionally no root `src/` directory and no combined dev server.
The repository root orchestrates workspaces and quality gates only.

## Dependency Direction

```text
apps/web ─┐
          ├──> packages/*
apps/api ─┘

apps/web -- HTTP --> apps/api
```

- `apps/web` must not import `apps/api`, Node built-ins, provider adapters, or
  server configuration.
- `apps/api` must not import `apps/web`, React, DOM code, or Vite internals.
- `packages/*` must not import either deployable application.
- Shared packages must not hide environment access or filesystem writes.
- Browser/API communication goes through feature clients and Zod contracts,
  never source-level cross-imports.
- API feature routes own their endpoint paths. `main.ts` only constructs
  dependencies and registers features.

The web and API may both import shared packages. Shared packages may depend on
another shared package when the dependency is explicit in its workspace
manifest.

## Deployment Boundary

The frontend and backend deploy independently:

```text
browser
  -> static web deployment
       /country-cards/*        bundled decorative assets
  -> reverse proxy
       /api/*                  Hono API
       /runtime-cache/*        API-owned generated artifacts
```

The recommended production topology keeps one public origin and routes
`/api/*` plus `/runtime-cache/*` to the API. All other application routes use
the web deployment's SPA fallback. The API never serves `index.html`, React
source, or the Vite build.

The two deployments do not share a writable filesystem:

- Bundled country-card artwork belongs to `apps/web` through `public/`.
- Dynamically fetched or generated artwork belongs to the API runtime cache.
- API production persistence can later move to Postgres and object storage
  without changing frontend deployment.

See [DEPLOYMENT.md](DEPLOYMENT.md) for commands, artifacts, and routing.

## Feature Boundaries

Both applications organize by product feature:

- `artwork`: image jobs, provider configuration, visual loading state.
- `countryCatalog`: country-pack discovery and the visual catalog.
- `countryDraft`: unconfirmed starter-map generation and review.
- `countrySetup`: configuration shell and navigation.
- `countryImages`: API fallback for decorative country-card media.
- `experience`: public browser-safe runtime configuration.
- `explorer`: click resolution, visual navigation, environment layers.
- `placeImages`: non-factual reference media and feedback.
- `runtimeCache`: generated artifact delivery and country-scoped cleanup.

Keep transport, persistence, provider integration, and pure policy separate
inside a feature when doing so reduces retrieval scope. Do not create generic
`helpers`, `utils`, `common`, or another catch-all entry point.

## Data and AI Boundaries

- `atlas-domain` owns deterministic guardrails, matching, planning, and scene
  policy. Continue migrating it toward strict TypeScript without adding runtime
  infrastructure dependencies.
- `atlas-contracts` owns externally visible schemas. Client and server must not
  duplicate an API shape independently.
- Source-controlled country packs under `apps/api/src/data/countryPacks/` are
  curated factual input. Runtime starter maps are review artifacts only.
- `atlas-prompts` describes structured inputs but cannot create authoritative
  facts.
- Provider output must pass deterministic matching and confidence policy before
  it can affect navigation.
- The factual UI renders structured data, confidence, and sources. It never
  extracts claims from generated image metadata.

## Frontend Rules

`apps/web/src/app/` owns composition, providers, route mounting, and browser
adapters. Feature workflows remain under `features/` and communicate through
explicit clients/controllers.

`applicationRuntime.ts` is the typed composition root. It may wire features but
must not absorb their rendering, transport, or stateless policy.
`browserRuntime.ts` owns browser-only adapters and feedback contracts.

Browser-wide tunable policy lives in `apps/web/src/config/appConfig.js`.
Secrets, server paths, and provider credentials must never enter it.

`apps/web/src/styles.css` is an import manifest. Global CSS is limited to
tokens, document defaults, and accessibility primitives. Feature styles stay
beside the feature that renders them; React-owned styles should use CSS Modules.

## Backend Rules

`apps/api/src/main.ts` is the dependency-composition and process-lifecycle
entry. It must not implement route bodies, persistence algorithms, provider
transport, or domain policy.

Feature HTTP handlers accept Fetch requests where needed and return native
responses. Platform modules adapt HTTP, environment, filesystem, media, and
OpenAI mechanics without containing travel policy.

Runtime artifacts are served only through the traversal-safe
`runtimeCache/runtimeArtifactHttpHandler.js`. Missing artifacts return a normal
404 and never prevent factual content or itinerary behavior.

## Testing Rules

Every structural migration must preserve unit, component, contract, and build
gates. Playwright uses local artwork fixtures and mocked image/VLM responses;
it must never contact OpenAI or another external provider.

Architecture tests enforce workspace commands, entry-point separation, and the
absence of cross-application imports. See [TESTING.md](TESTING.md).

## Outstanding Platform Migration

The application split is complete. Remaining production platform work is:

1. Replace local review/job metadata with PostgreSQL and Drizzle.
2. Replace generated binary storage with S3-compatible object storage.
3. Replace the in-process image queue with a durable queue.
4. Add production observability and deployment-specific health checks.

These are adapter migrations inside the API boundary, not frontend migration
work and not reasons to merge the two applications again.
