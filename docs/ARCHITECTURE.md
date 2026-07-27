# RoamAtlas Architecture

## Status

This document defines the target architecture for the incremental migration from
the current vanilla JavaScript application. It is a decision record, not a
license for a rewrite. Existing factual guardrails and passing behaviour remain
the compatibility baseline.

## Non-Negotiable Invariant

> AI generates the visual layer. Curated data is the only authority for travel facts.

Generated image output, VLM descriptions, reference-photo search results, and
unreviewed starter-map candidates must never become verified facts or confirmed
itinerary items without an explicit curated-data change.

## Current Migration Pressure

The existing domain modules and source-controlled country packs already
separate policy from data well. The primary migration targets are the large UI,
server, and stylesheet entry points, which currently make unrelated features
costly to retrieve and change safely.

## Target Stack

| Concern | Target | Responsibility |
| --- | --- | --- |
| Runtime | Active Node.js LTS | Server and build runtime |
| Workspace | pnpm workspaces | Isolate deployable applications and shared packages |
| Web | React, TypeScript, Vite, React Router | Visual explorer and configuration UI |
| Remote state | TanStack Query | API caching, polling, mutations, and invalidation |
| API | Hono on Node.js | Small feature-scoped HTTP routes |
| Contracts | Zod | Runtime request/response validation and inferred types |
| Persistence | PostgreSQL and Drizzle | Curated-review records, saved discoveries, jobs, metadata |
| Artifacts | S3-compatible object storage | Generated artwork and reference-photo binaries |
| Background work | Persistent Postgres-backed queue | Image generation and environment-plan jobs |
| AI | OpenAI SDK behind adapters | Image generation and visual description only |
| Tests | Vitest and Playwright | Unit/contract and browser journey coverage |

Do not introduce microservices, Redis, authentication, payment systems, or a
WebGL rendering engine until a concrete product requirement requires them.

## Target Repository Shape

```text
apps/
  web/src/features/
    country-catalog/
    country-setup/
    explorer/
    artwork/
    itinerary/
  api/src/features/
    artwork/
    click-resolution/
    country-packs/
    country-setup/
    place-media/
    itinerary/
  api/src/platform/
    http/
    storage/
    jobs/
    openai/
packages/
  atlas-domain/
  atlas-contracts/
  atlas-prompts/
  country-packs/
```

Each feature owns its UI or route, contracts, application service, and tests.
`platform` modules adapt external systems only and must not contain travel
policy. Avoid generic `helpers`, `utils`, or `common` directories.

## Boundary Rules

- `atlas-domain` is pure TypeScript and has no browser, HTTP, database, or AI
  SDK imports.
- `atlas-contracts` owns externally visible request/response schemas. A client
  and server must not duplicate an API shape independently.
- `country-packs` are source-controlled curated facts. Runtime starter maps
  are review artifacts and cannot replace them.
- `atlas-prompts` may describe curated inputs but cannot create factual claims.
- AI adapters return typed visual descriptions or artifacts. Their callers must
  pass results through the curated node matcher before displaying facts.
- The factual UI renders only structured node facts and their confidence/source
  metadata; it never reads claims from generated image metadata.

## Migration Order

1. Preserve today’s behavior with contract tests and browser fixtures.
2. Introduce TypeScript and Vite while the current server remains the API.
3. Extract frontend features from the existing browser entry point.
4. Extract API features from the current server entry point behind shared Zod
   contracts.
5. Replace runtime-local persistence with PostgreSQL, object storage, and a
   persistent job queue.
6. Add production observability and deployment-specific adapters.

The current baseline includes a React 19 composition root, React Router,
TanStack Query, Vite, strict TypeScript checking, React-aware ESLint, Zod
validation for artwork and country-pack APIs, Vitest component/contract tests,
and Playwright fixture isolation. The React runtime composes feature-owned
country, explorer, artwork, and browser-feedback controllers; the former
`src/ui/app.js` monolith and temporary legacy bridge have been removed. Hono,
PostgreSQL, and Drizzle remain deliberate later migrations, introduced only
when their feature boundary is ready.

### Current Feature Boundaries

The transitional vanilla UI and Node server remain in place, but these features
already own their public HTTP clients and/or handlers:

- `artwork`: validated artwork request handler.
- `countryCatalog`: country-pack client, registry contract, and API handler.
- `countryDraft`: browser client, server guardrail handler, and a complete starter-map panel composed from focused chat, review-status, metadata, and non-factual reference-photo views.
- `countrySetup`: country configuration shell view and DOM event controller.
- `explorer`: detail panel, destination-navigation view, environment renderer,
  click-resolution handler, and explorer client.
- `experience`: public browser-safe runtime configuration endpoint/client.
- `placeImages`: reference-photo browser client and factual-boundary API handler.
- `runtimeCache`: country-scoped cleanup endpoint/client.

Browser-wide tunable policy lives in `src/config/appConfig.js`: storage keys,
quality choices, polling and retry budgets, version gates, input limits, and
notification timing. Feature modules consume that policy; provider secrets and
machine-specific values must never enter browser configuration.

### CSS Ownership

`src/styles.css` is an import manifest, not a component stylesheet. Global CSS
is limited to design tokens, document defaults, and accessibility primitives in
`src/styles/`. Feature selectors live beside the feature that renders them.

React-owned UI uses `*.module.css`. During the incremental migration, a module
may expose a documented `:global(...)` alias only when the same selector is
still consumed by a legacy DOM renderer. Delete that alias when the legacy
renderer is removed.

Country setup, country draft, artwork, and explorer styles are split by
cohesive UI responsibility. Responsive rules stay beside their owning feature.
Do not recreate a cross-feature stylesheet organized by generic categories such
as buttons, cards, forms, or animations.

Stylelint is the CSS quality gate. New CSS Modules must keep selector
specificity within the configured limit; existing global feature CSS retains
its established cascade until that feature is migrated to React.

`src/app/` owns composition, providers, route mounting, and browser adapters.
Feature workflows belong to their domain directories and communicate through
explicit controller interfaces. Pure transformations belong in typed feature
policy modules and must remain independent of browser state.

`src/app/applicationRuntime.ts` is the typed composition root and must not
absorb feature workflows. Browser-only adapters and feedback contracts live in
`src/app/browserRuntime.ts`. Keep transport in the owning feature client and
keep runtime adapters out of travel policy modules.

No migration step may weaken the unmapped-detour fallback, curated-node-only
itinerary rule, fact confidence labels, or missing-artwork accessibility.

## Completion Criteria

The migration is complete only when the feature-first structure is in use,
production state is durable, all AI integrations are adapter-backed, browser
tests use mocked providers, and the visual/factual separation is proven by
unit, contract, and browser tests.
