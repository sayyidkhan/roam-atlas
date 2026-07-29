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
| Workspace | npm workspaces | Independent applications and reusable libraries |
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
libs/
  contracts/                   typed shared Zod API contracts
  data/                        browser-safe shared catalog/config data
  domain/                      pure product and guardrail policy
  prompts/                     prompt construction from structured inputs
public/                        web-owned static artwork fixtures/assets
test/                          cross-workspace tests and local browser fixtures
```

There is intentionally no root `src/` directory and no combined dev server.
The repository root orchestrates workspaces and quality gates only.

The root TypeScript configuration is a solution file. Workspace-level
`tsconfig.json` files define project references and emit declarations only into
ignored `dist/types/` artifacts. Library manifests expose explicit
subpaths; wildcard source exports are prohibited.

## Dependency Direction

```text
apps/web ─┐
          ├──> libs/*
apps/api ─┘

apps/web -- HTTP --> apps/api
```

- `apps/web` must not import `apps/api`, Node built-ins, provider adapters, or
  server configuration.
- `apps/api` must not import `apps/web`, React, DOM code, or Vite internals.
- `libs/*` must not import either deployable application.
- Shared libraries must not hide environment access or filesystem writes.
- Browser/API communication goes through feature clients and Zod contracts,
  never source-level cross-imports.
- API feature routes own their endpoint paths. `main.ts` only constructs
  dependencies and registers features.

The web and API may both import shared libraries. A library may depend on
another library when the dependency is explicit in its workspace
manifest.

`atlas-contracts` is TypeScript-only. Consumers retain stable `.js` ESM
specifier names through explicit package-export mappings; those exports resolve
to typed source targets and expose inferred Zod request/response types.

`atlas-data` is also TypeScript-only. Its explicit package exports preserve the
existing `.js` ESM specifiers while resolving to typed country catalog and
experience-config implementations. Deployable apps consume those shared types
without importing package internals.

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

The API `placeImages` feature is TypeScript-only. Its HTTP, provider,
orchestration, selection, persistence, claim, and history modules preserve the
non-factual reference-media boundary while narrowing external JSON at adapter
edges. The HTTP facade only registers routes and composes separate media,
prompt-suggestion, and saved-history handlers; it does not own their workflow
logic.

The API `countryDraft` feature is TypeScript-only too. Exa and OpenAI adapters,
generation orchestration, curated-pack policy, runtime persistence, HTTP
transport, and feature composition share the domain draft contracts. Generated
candidates remain unconfirmed, while source-controlled packs only accept
append-only candidates until a human review updates curated source data. Its
HTTP facade composes independent read, GenAI-influence, and human-review
handlers around a typed request context.

The API data boundary is TypeScript-only. Country-pack compilation, legacy
scene-graph projections, default artwork-page planning, and the runtime artwork
registry expose typed records; feature code does not import untyped data
modules.

The API `artwork` feature is TypeScript-only. HTTP validation, guarded job
creation, cache reuse, atomic persistence, queue scheduling, worker execution,
and environment-plan coordination retain separate owners. Runtime JSON is
narrowed at the repository boundary and generated images remain visual-only.

The API `explorer` feature is TypeScript-only. Click request parsing, HTTP
orchestration, semantic-region persistence, deterministic curated matching,
OpenAI VLM adapters, environment planning, and PNG click annotation retain
separate typed owners. Provider JSON and cached understanding files are
validated at their boundaries. The HTTP handler composes these owners and does
not implement image-provider or persistence mechanics.

The complete `apps/api/src` tree is TypeScript-only. Architecture tests reject
new `.js` or `.jsx` source so backend features cannot silently regress to
unchecked runtime modules.

## Data and AI Boundaries

- `atlas-domain` owns deterministic guardrails, matching, planning, and scene
  policy. Its source tree is strict TypeScript behind stable `.js` package
  specifiers and has no runtime infrastructure dependencies. Factual
  guardrails, itinerary policy, route resolution, and
  next-artwork destination selection are typed too. Deterministic flipbook
  resolution now publishes the canonical typed node, scene, hotspot, click,
  page, and result contracts consumed by the browser; missing scenes become
  unconfirmed detours instead of runtime failures. Page orchestration,
  click-region/fallback matching, and shared contracts are separate cohesive
  modules behind the same stable package export. Scene hit testing, hotspot
  actions, curated phrase matching, image-click resolution, and page planning
  are also strict TypeScript. Loading progress, country-draft review, and
  non-factual place-image selection now publish typed contracts too. The React
  lifecycle and API place-image service no longer need unsafe domain casts.
  Country-draft policy is exposed through a typed facade and split into prompt,
  grounding, text-safety, normalization, pack-projection, review, and
  shared-type modules.
- `atlas-contracts` owns externally visible schemas. Client and server must not
  duplicate an API shape independently.
- `atlas-data` owns browser-safe country catalog and experience defaults.
  Neither deployable app should duplicate those records or read through package
  internals.
- Source-controlled country packs under `apps/api/src/data/countryPacks/` are
  curated factual input. Their strict TypeScript compiler owns source shapes,
  tile geometry, continuity prompts, ambient bounds, and deterministic cache
  keys. A typed server registry validates parsed JSON records and required
  scene fields before compilation. Runtime starter maps are review artifacts
  only.
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

`applicationRuntime.ts` is the thin public runtime facade. It exports only the
start and route operations consumed by React. `applicationRuntimeComposition.ts`
is the dependency-composition root; it may wire features but must not absorb
their rendering, transport, lifecycle coordination, configuration, or stateless
policy. Country setup, artwork runtime, explorer runtime, and explorer
presentation each have feature-owned composition modules. The root uses
explicit lifecycle, view, page-transition, and publisher bridges for staged
construction; hidden mutable callback placeholders and broad type casts are
prohibited. Runtime clients, computed configuration, and shared
lifecycle/ref-count coordination have dedicated application modules.
Importing it must not start the application. `ApplicationRuntimeHost.tsx` owns
startup and teardown through React lifecycle, and every browser-wide event
adapter or delegated explorer listener must return a disposable cleanup.
`ApplicationRuntimeHost.tsx` also owns pathname observation through React
Router's `useLocation`; the runtime receives an explicit pathname and must not
install a second application-level `popstate` router.
`applicationLifecycleController.ts` composes bootstrap and route coordination
only. Country/config/place activation belongs to
`applicationNavigationController.ts`; generated artwork/environment cleanup
belongs to `applicationGeneratedStateController.ts`. Unknown nodes remain an
explicit unconfirmed route notice owned by navigation.
`browserRuntime.ts` owns browser-only URL, request, and timeout adapters. It
cannot own presentation DOM or feature feedback state.

Cross-feature browser concerns have explicit adapters: `notifications` owns
transient application messages, `experience` owns image-quality persistence,
and `runtimeCache` owns country-scoped artifact deletion. Country setup must
consume these interfaces rather than recreating document, storage, or cache
behavior.

Artwork prefetch keeps scene/target selection, background job polling, and
decode-before-cache promotion in separate feature modules. A stale request
epoch must be rejected before prefetched generated imagery is promoted into
the visual cache; that cache remains visual state and never becomes a factual
source.

Interactive artwork keeps HTTP job creation separate from pending-page/retry
transitions. Poll response handling delegates timer ownership, timeout policy,
attempt accounting, and provider-status copying to a dedicated poll-state
module. All paths share one monotonically increasing attempt id source so stale
responses cannot complete a newer request.

Explorer navigation keeps DOM click adaptation, abortable request identity,
click/overlay workflow coordination, page materialization/result application,
and stateless page policy in separate modules. A `vlm_guard` result must render
an unresolved detour and must not update the canonical browser route.

Explorer environment planning keeps plan acquisition/retry separate from
page-specific plan promotion and visual-cache synchronization. Promotion must
match the active environment epoch, page id, and node id before updating state.

The API environment-plan policy is TypeScript-owned and split into server
contracts, pure normalization, and envelope orchestration. It accepts only
curated child node ids, constrains visual and label bounds, rejects unsafe
ambient placements, and emits an explicit decorative-only fact boundary.

The API semantic-region policy is TypeScript-owned. Learned click regions may
cache a curated node match or an unmapped phrase, while unresolved VLM output
must remain a `vlm_guard` detour and cannot become verified navigation.

Artwork job-processing policy is TypeScript-owned. It owns deterministic asset
identity, interactive/prefetch priority, retry timing, flush exclusion, and
transient generation-error classification outside the server composition root.
Provider-capacity selection, interactive reserved slots, queue ordering, and
stale-lease recovery live beside it in the typed artwork feature rather than
in a generic API `domain` bucket.
Runtime artwork country resolution and deterministic asset-version extraction
also have a typed feature owner. Legacy cache-directory names cannot be
misread as country slugs.

Artwork job creation is a small orchestration service. Country-scoped flush
coordination and active-creation tracking live in a typed creation guard;
existing ready images, metadata reuse, environment-plan rehydration, and
in-flight priority promotion live in a typed reuse service. New pending-job
creation does not own either lifecycle.

Image-generation policy and OpenAI transport are separate strict TypeScript
boundaries. `domain/imageGenerationPolicy.ts` owns model aliases, output
normalization, timeout policy, and the visual-only system prompt.
`platform/openai/openAiImageProvider.ts` owns HTTP, streaming event parsing,
request cancellation, fallback-provider retry, and provider error metadata.
The artwork feature adapter supplies runtime configuration without absorbing
either policy or transport.

`artworkJobService.js` owns scheduling only: startup, scans, stale-lease
recovery, eligibility, and provider-capacity selection. The strict TypeScript
`artworkJobWorker.ts` owns provider execution, partial/final artifact
persistence, bounded retry, cancellation, factual-boundary metadata, and
post-generation environment and click-understanding work.

Place-image policy is TypeScript-owned and split by responsibility. Suggestion
grounding accepts only the mapped place and curated child names; media policy
owns image claim identity, raster-dimension checks, and the explicit
non-factual reference-photo boundary; history policy owns archive projection
and retention limits. The typed resolver service delegates cross-place media
claims to `placeImageClaimRegistry.ts` and saved/current photo mutations to
`placeImageHistoryService.ts`; it no longer owns those independent lifecycles.
The strict TypeScript repository owns traversal-safe cache paths, metadata,
binary artifacts, and history manifests. Untrusted JSON is narrowed before it
can enter the resolver contract. Services import these owners directly instead
of relying on a catch-all policy file.

Country-card Wikimedia selection is TypeScript-owned. Article thumbnails,
Commons search results, URLs, MIME values, and titles cross an explicit
untrusted payload shape before exclusion, relevance, and deterministic ranking
policy runs.

`AppToast.tsx` owns notification markup and direct dismissal.
`appToastController.ts` owns only replacement and expiry timing through the
typed `appToastBridge.ts`; it must not inject notification HTML or bind
document-level click handlers.

The country setup shell is React-owned. Until its draft command store is fully
migrated, `countrySetupBridge.ts` is the only allowed state handoff from the
compatibility runtime; imperative code must not replace the React shell DOM.
React shell controls call `countrySetupActionController.ts` through typed
commands. Draft mutations, tool actions, reset actions, and submitted GenAI
instructions use the typed `countryDraftViewController.ts` contract. Purely
presentational state, including the selected draft tab, selected GenAI target,
and whether the country action guide or draft tool menu is expanded, belongs
to the owning React component. It must not cross `countrySetupBridge.ts` or be
stored in the application compatibility state.

`CountryDraftSurface.tsx` owns draft lifecycle states and the unconfirmed
starter-map boundary. `CountryDraftToolbar.tsx` owns ready-state navigation and
tools. `CountryDraftReview.tsx` owns source-review guidance and the explicit
confirmation-artifact workflow. `CountryDraftEditDialog.tsx` owns scoped GenAI
instructions, message rendering, and dialog focus.
`useCountryDraftEditTarget.ts` owns target selection and invalidates it when
the selected candidate leaves the current draft, so domain mutations do not
depend on modal state.
`CountryDraftTree.tsx` is composition-only.
`CountryDraftRegionItem.tsx` and `CountryDraftThemeItem.tsx` own top-level row
presentation; `CountryDraftChildNodes.tsx` owns recursive child curation;
`CountryDraftTreeControls.tsx` owns shared row controls;
`useCountryDraftDrag.ts` owns top-level reorder gestures; and
`countryDraftTreePolicy.ts` owns source-URL, descendant-review, and drop-class
policy. No country-draft compatibility HTML or delegated shell event adapter is
permitted.

`CountryDraftReferencePhoto.tsx` owns its image load, progress, retry, failure,
and duplicate states. Duplicate tracking is scoped by
`draftReferencePhotoRegistry.tsx`, and timing/retry policy lives under
`APP_CONFIG.placeImages.loadLifecycle`. Country setup must not query or mutate
React-rendered thumbnail elements after render.

`countryDraftController.ts` is composition-only. Checked-in/stored draft
loading belongs to `countryDraftLifecycleController.ts`; local reorder, delete,
rename, and persistence belong to `countryDraftMutationController.ts`; scoped
AI instructions belong to `countryDraftInfluenceController.ts`; explicit
approval and confirmation belong to `countryDraftReviewController.ts`.
`countryDraftTypes.ts` is the feature contract shared by clients, controllers,
and React surfaces. Runtime candidates must never replace the reconstructed
source-controlled tree.

`DraftPhotoLightbox.tsx` and `DraftPhotoFeedbackForm.tsx` own reference-photo
review, history navigation, feedback entry, prompt suggestions, focus, and
dialog dismissal. `draftPhotoLightboxController.ts` owns only asynchronous
reset, selection, deletion, feedback, and optional-history workflows; it
publishes typed state through `draftPhotoLightboxBridge.ts` and must not create
elements, inject HTML, or query presentation DOM. Reference photos remain
visual review aids and are always labelled as unverified travel data.

`ExplorerDetailSheet.tsx` owns curated fact and unverified-detour presentation.
`explorerDetailController.ts` may publish typed detail state, but explorer
controllers must not inject factual detail HTML or bind delegated detail
controls.

`ExplorerViewport.tsx` owns explorer visibility, the scene HUD, breadcrumb,
busy state, and country/back navigation controls. Compatibility navigation may
publish typed chrome state through `explorerChromeBridge.ts`; it must not query
those controls or mutate viewport presentation classes directly.
`ExplorerDestinationNavigation.tsx` owns illustration loading guidance,
destination readiness cards, and the fixed region rail. Stateless target
ordering, hotspot-to-click geometry, and readiness labels live in
`explorerDestinationPolicy.ts`.

`ExplorerSceneStage.tsx` owns the stage container, generated artwork, preview
state, tile fallbacks, pending status, responsive artwork bounds, and
deterministic target buttons. `explorerScenePolicy.ts` maps structured scene
and environment-plan data into typed tile and target models. Explorer
orchestration may publish those models, but it must not create or replace scene
DOM.

`ExplorerEnvironmentLayers.tsx` owns code-rendered ambient particles.
`explorerEnvironmentLayerPolicy.ts` owns safe fallback selection, normalized
bounds, deterministic particle placement, and supported-kind normalization.
Ambient components are always `aria-hidden` and cannot render facts, labels,
navigation, source claims, or click commands.

`ExplorerNavigationFeedback.tsx` owns structured loading progress and transient
status presentation. `explorerFeedbackController.ts` publishes that state and
owns stale-timer invalidation. `explorerPageTransitionController.ts` owns
pending-job cleanup, history, URL activation, and ready-page transitions.

`explorerController.ts` is a typed feature composition adapter only.
`explorerSceneOrchestrator.ts` derives scene, destination, environment, and
artwork presentation models; `explorerImagePreloader.ts` owns browser image
decode caching. Click-coordinate conversion belongs to
`explorerPageClickAdapter.ts`, abort and stale-response handling belongs to
`explorerNavigationRequestController.ts`, and cached-page materialization
belongs to `explorerNavigationPagePolicy.ts`.

`artworkController.ts` is also composition-only. Interactive request/retry
commands belong to `artworkInteractiveController.ts`; polling transport and
budgets belong to `artworkPollingController.ts`; attempt visibility, terminal
failure, and timer cleanup belong to `artworkLifecycleController.ts`; final
image decode and cache promotion belong to `artworkCompletionController.ts`;
partial-preview decode belongs to `artworkPartialController.ts`. Speculative
generation remains isolated in `artworkPrefetchController.ts`.

Internal URL changes notify React Router with a synthetic `popstate`.
`ApplicationRuntimeHost.tsx` observes the resulting pathname and invokes the
typed route lifecycle. Async country-pack resolution uses request identity so a
stale route cannot overwrite a newer navigation. The delegated explorer-canvas
listener is installed only while the React runtime host is mounted and is
removed during teardown.

Browser-wide tunable policy lives in `apps/web/src/config/appConfig.ts`.
Secrets, server paths, and provider credentials must never enter it.

`apps/web/src/styles.css` is an import manifest. Global CSS is limited to
tokens, document defaults, and accessibility primitives. Feature styles stay
beside the feature that renders them; React-owned styles should use CSS Modules.

Country runtime-cache progress is not application state. A feature-owned
country-scoped external store publishes loading, success, and failure snapshots
directly to the React setup surface. The cache controller owns deletion
coordination; `ApplicationState` does not retain transient cache notices.

Country starter-map workflow state is feature-owned as well. Loading,
unconfirmed draft data, influence messages, approval/confirmation progress, and
stored-artifact checks live in `countryDraftStore.ts`. React subscribes to the
selected country through `useCountryDraftState.ts` and derives display state
during render. `ApplicationState` no longer owns draft maps or stored-draft
check sets; generated drafts remain unconfirmed review artifacts.

Reference-photo cache-busting state is feature-owned. Country refresh tokens,
place refresh tokens, and reviewer search feedback live in
`placeImageSessionStore.ts`; they no longer widen `ApplicationState`. The
store only affects decorative image requests and never verifies or changes
curated travel facts.

## Backend Rules

`apps/api/src/main.ts` is the dependency-composition and process-lifecycle
entry. It must not implement route bodies, persistence algorithms, provider
transport, or domain policy.

Feature HTTP handlers accept Fetch requests where needed and return native
responses. Platform modules adapt HTTP, environment, filesystem, media, and
OpenAI mechanics without containing travel policy.

Shared HTTP platform primitives are TypeScript-owned. They centralize native
Fetch responses, MIME lookup, safe response headers, and bounded JSON parsing.
Malformed and oversized JSON bodies surface typed HTTP errors with stable 400
and 413 status codes.

Backend non-secret defaults and environment overrides live in the typed
`config/roamAtlasConfig.ts` boundary. Provider model names, image output
settings, server binding, and the allowed configurable quality values must not
be scattered through route or provider implementations.

OpenAI Responses API text extraction and JSON parsing live in the typed
`platform/openai/responseParsing.ts` adapter. It accepts only known response
shapes and returns object-bounded JSON; arrays, primitives, and malformed model
output cannot cross into feature workflows as valid payloads.

Runtime artifact path resolution is TypeScript-owned in
`platform/runtime/runtimeCacheFiles.ts`. Repository and cache paths are checked
against their configured roots, legacy job paths are normalized centrally,
and malformed or traversal-encoded URLs fail closed.

Local dotenv-style loading is TypeScript-owned in
`platform/env/loadLocalEnv.ts`. It never overwrites process-supplied values,
preserves explicit blank test overrides, and ignores malformed environment
variable names.

Reference-media request mechanics are TypeScript-owned in
`platform/media/mediaFetch.ts`. Wikimedia metadata and image downloads share
one user agent, bounded request timeouts, and a constrained set of persisted
image extensions. No JavaScript adapters remain under `platform/`.

Runtime artifacts are served only through the traversal-safe typed
`runtimeCache/runtimeArtifactHttpHandler.ts`. Missing artifacts return a normal
404, malformed encoded paths return 400, and neither condition prevents
factual content or itinerary behavior.

Runtime-cache identity, repositories, destructive operations, and HTTP routes
are TypeScript-owned. `domain/runtimeCache.ts` defines deterministic artifact
paths and image-variant keys; the feature service coordinates cancellation and
cleanup through a typed repository without importing filesystem mechanics.

Country-card reference media is TypeScript-owned under
`features/countryImages/`. Search topics, Wikimedia transport, selection,
local persistence, service fallback order, and Hono delivery share explicit
feature contracts. These images remain decorative visual context and are never
accepted as sources for travel facts.

Country-pack catalog and experience-config routes are strict TypeScript read
boundaries. The catalog handler accepts only the compiled country-pack
registry, and the experience handler accepts only browser-safe, non-secret
runtime configuration before registering with Hono.

## Testing Rules

Every structural migration must preserve unit, component, contract, and build
gates. Playwright uses local artwork fixtures and mocked image/VLM responses;
it must never contact OpenAI or another external provider.

Architecture tests enforce workspace commands, entry-point separation, and the
absence of cross-application imports. ESLint enforces the same dependency
direction during normal development. GitHub Actions runs all quality gates,
with provider credentials blank during Playwright. See
[TESTING.md](TESTING.md) and [MAINTAINABILITY.md](MAINTAINABILITY.md).

## Outstanding Platform Migration

The application split is complete. Remaining production platform work is:

1. Replace local review/job metadata with PostgreSQL and Drizzle.
2. Replace generated binary storage with S3-compatible object storage.
3. Replace the in-process image queue with a durable queue.
4. Add production observability and deployment-specific health checks.

These are adapter migrations inside the API boundary, not frontend migration
work and not reasons to merge the two applications again.
