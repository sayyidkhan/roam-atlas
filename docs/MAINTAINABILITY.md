# RoamAtlas Maintainability Roadmap

This roadmap converts the architecture rules into small, reversible
checkpoints. Refactoring must preserve the visual/factual boundary and the
mock-only browser test policy.

## Completed Foundation

- Web, API, and shared libraries are independent npm workspaces.
- TypeScript project references encode workspace build order.
- Shared libraries expose explicit subpaths instead of wildcard internals.
- ESLint rejects web-to-API, API-to-web, and package-to-app imports.
- Contracts and shared catalog/config JavaScript run with `checkJs`.
- GitHub Actions runs type, lint, unit, React, contract, API, build, and
  mocked-provider browser gates.
- Dependabot groups routine npm and GitHub Actions updates.
- Country-draft loading, local mutations/persistence, scoped AI influence, and
  explicit source review are separate typed controllers behind a 140-line
  composition adapter. Their shared contract lives in `countryDraftTypes.ts`.
- React owns the reference-photo dialog, saved-history navigation, feedback
  form, prompt suggestions, focus, and Escape handling. Typed `placeImages`
  controllers retain only search, reset, selection, deletion, and optional
  history workflows. The former 495-line DOM controller no longer creates
  elements, injects HTML, or binds presentation selectors.
- Browser element lookup and initial runtime state have typed application
  modules instead of living in the runtime composition file. React Router owns
  pathname observation; there is no parallel global shell-event router.
- Cross-route state transitions, route dispatch, and top-level view rendering
  are isolated in typed application modules.
- React owns compatibility-runtime startup, teardown, and pathname observation.
  Browser bootstrap/route coordination, country navigation activation, and
  generated-state cleanup have separate typed owners.
- The runtime entry is a thin public facade. Dependency wiring, feature HTTP
  clients, computed runtime configuration, and shared start/route/ref-count
  lifecycle each have dedicated typed application modules.
- The dependency-composition root is now about 230 lines and delegates country
  setup, artwork runtime, explorer runtime, and explorer presentation wiring to
  feature-owned composition modules. Explicit lifecycle, view, page-transition,
  and publisher bridges replace temporal-dead-zone callbacks; architecture
  tests prevent low-level controllers and broad `as never`/`as unknown` casts
  from returning to the root.
- The `/` country catalog is fully React-owned; the compatibility runtime no
  longer ships or binds a duplicate country-landing DOM.
- Speculative artwork prefetch policy, background requests, polling,
  invalidation, and cache promotion are isolated from interactive artwork
  generation in typed feature modules.
- Speculative prefetch is further divided into scene/target orchestration,
  background request startup, polling/timer lifecycle, decode-before-cache
  promotion, and shared contracts.
  Stale request epochs remain mandatory before generated visuals enter a cache.
- Interactive artwork requests, retry, polling transport, shared attempt
  lifecycle, final decode/cache promotion, and partial-preview decoding have
  separate typed feature owners.
- Interactive artwork is now a small composition module over HTTP job creation
  and page pending/retry transitions. Poll response handling is separate from
  interval, timeout, attempt-count, and status-copy bookkeeping.
- Explorer environment-plan retry, stale-plan recovery, promotion, cache
  updates, and country-scoped invalidation are isolated in a typed controller.
- Environment-plan acquisition/retry is separate from exact-page promotion and
  visual-cache reference updates. Promotion checks both the request epoch and
  expected page/node identity before applying a response.
- Explorer coordinate conversion, curated-target matching, abortable navigation,
  and unverified-detour handling are isolated in a typed controller.
- Explorer input coordination, abortable request identity, page
  materialization/result application, and shared navigation contracts have
  separate typed owners. The unresolved VLM guard remains an explicit tested
  branch that cannot update the canonical route.
- Explorer scene DOM, tile fallbacks, target overlays, image aspect handling,
  and resize synchronization are isolated in a typed view module.
- React owns explorer factual detail and explicitly labelled detour rendering.
  Detail visibility and expand/collapse/close commands use a typed bridge; the
  legacy `innerHTML` detail renderer and delegated detail events are deleted.
- React owns explorer visibility, HUD content, country/back navigation, and
  busy state. The application element registry now retains only the visual
  stage mount for explorer compatibility code.
- React owns destination readiness cards, illustration loading guidance, retry
  and setup actions, horizontal rail controls, and direct destination
  navigation. Stateless ordering and hotspot geometry are isolated in typed
  policy, and the 326-line legacy DOM renderer is deleted.
- Internal route notifications no longer masquerade as browser Back events.
  Explorer history now survives a destination transition and the React Back
  command restores the prior page.
- React owns the complete explorer stage: generated artwork and previews, tile
  fallbacks, pending state, responsive image bounds, and deterministic curated
  target buttons. The 411-line scene DOM renderer is deleted; geometry and
  generated-tile selection are typed stateless policy.
- Decorative ambient particles are typed React primitives backed by stateless
  selection, bounds, duration, and deterministic-placement policy. The
  383-line imperative renderer is deleted, and architecture tests prevent
  ambience from gaining factual or navigation authority.
- React owns structured explorer loading progress and transient status.
  Feedback timing is feature-owned, ready-page/history transitions are isolated,
  and `browserRuntime.ts` is presentation-free.
- Explorer click coordinates, interactive-element filtering, abortable request
  identity, stale-response invalidation, cached-page materialization, and
  request error policy are separately retrievable typed modules.
- Deterministic flipbook click resolution is strict TypeScript behind the
  stable `flipbookPage.js` package export. Browser nodes, scenes, clicks, and
  pages consume that canonical domain contract, while a missing current scene
  degrades to an explicitly unconfirmed detour instead of throwing or
  fabricating a mapped destination. The public page orchestrator, click-region
  policy, and shared contracts are separate sub-300-line modules, so consumers
  can retrieve the data shape without loading matching and fallback geometry.
- The deterministic navigation dependencies beneath that facade are strict
  TypeScript too: scene hit testing, hotspot action resolution, curated phrase
  matching, image-click resolution, and next-page planning no longer leak
  inferred JavaScript `any` values into the browser or API.
- The explorer composition adapter is TypeScript. Scene-model orchestration and
  browser image decode caching are independent feature modules, so composition
  no longer contains scene rendering policy or preload lifecycle code.
- Country-scoped runtime deletion is isolated in a typed `runtimeCache`
  controller that preserves starter-map review state during visual-only resets.
- Country runtime-cache progress has moved out of `ApplicationState` into a
  feature-owned country-scoped store. React subscribes directly, so reset
  notices and disabled action state no longer require compatibility renders.
- Application toasts and image-quality browser persistence are typed adapters
  outside country setup.
- React owns application-toast markup and dismissal. The notification
  controller retains only replacement and expiry timing; the document-level
  delegated toast listener and HTML injection have been removed.
- Country setup composition, delegated DOM events, drag payload parsing, and
  compatibility scroll preservation are now TypeScript modules.
- React owns the country setup hero, actions, image-quality controls, cache
  status, and draft host. The compatibility runtime publishes typed state
  through a narrow bridge instead of replacing the shell with `innerHTML`.
- The country action-guide disclosure, draft section tab, draft three-dot menu,
  and GenAI dialog target are local React state. Presentational selection and
  disclosure state must not be added to the application-wide compatibility
  store or routed through runtime commands.
- The complete country-draft workflow state has left `ApplicationState`.
  Loading, draft snapshots, messages, review progress, and stored-draft checks
  live in a country-scoped feature store. React subscribes directly and
  projects the typed workflow snapshot into empty/loading/failed/ready views.
- Reference-photo refresh tokens and reviewer search feedback have left
  `ApplicationState`. A typed place-image session store owns decorative-photo
  cache busting without acquiring factual authority.
- React invokes typed setup commands directly for navigation, map creation,
  visual reset, image quality, draft tabs, starter-map tools,
  metadata/photo resets, and the top-level GenAI trigger. Delegated DOM events
  are now limited to interactions emitted by the legacy draft-tree subtree.
- React owns draft empty, loading, failed, and ready lifecycle states, the
  ready-state header, summary, tabs, tool menu, and factual/unconfirmed
  messaging.
- React owns the source-review checklist and confirmation-artifact workflow.
  Confirmation remains an explicit review step and never turns generated
  content into verified facts.
- React owns the GenAI edit dialog, selected edit target, scoped message log,
  focus lifecycle, and close behavior. Candidate validation and message
  filtering are pure TypeScript policy; only the submitted draft mutation
  crosses into a typed command.
- React owns the complete nested draft tree, metadata chips, curation,
  candidate editing/deletion, GenAI triggers, reorder gestures, and reference
  photo controls. The legacy HTML renderers and delegated country-shell event
  controller have been deleted.
- The former 598-line `CountryDraftTree.tsx` is now a small composition
  boundary. Region rows, theme rows, recursive child curation, shared controls,
  drag coordination, and stateless tree policy are independently retrievable
  feature modules.
- React reference-photo components own thumbnail progress, retry, failure, and
  duplicate detection. The 207-line post-render DOM hydrator and its
  country-setup bridge callback have been deleted; timing and retry limits now
  live in app config.
- The remaining ready-tree renderer is TypeScript-only and rejects missing
  draft data; it can no longer become a second lifecycle-state owner.
- Draft presentation commands and view state live in
  `countryDraftViewController.ts`; the React toolbar and its contract are
  separately retrievable from `CountryDraftToolbar.tsx` and
  `countryDraftViewModel.ts`.

## Frontend Migration Checkpoints

Refactor one feature at a time. Do not split files solely by line count.

### 1. Country Setup

The original 1,154-line controller has been replaced by a typed composition
controller. React now renders the complete setup experience and invokes typed
review, drag, approval, image, and GenAI commands directly. The compatibility
bridge has been replaced by `countrySetupStore.ts`, a feature-owned Zustand
store. Continue toward:

```text
countrySetup/
  CountrySetupPage.tsx
  useCountryExperience.ts
  countryExperienceState.ts
  countryExperienceCommands.ts
  components/
```

Keep network calls in feature clients and derive display state during render.
Image-quality persistence, runtime reset coordination, notifications, and
scroll preservation already have independent typed adapters. React Router now
owns an explicit route table and passes explicit pathnames into the
compatibility runtime. Country setup disclosure state is already local to its
React owner. The remaining compatibility responsibility is command
orchestration around the feature-owned stores while they replace the
application-wide state object.

The country catalog registry is the first React-owned server-state path on
TanStack Query. It uses the existing feature client/registry boundary and no
longer maintains a manual effect counter solely to force rerenders.

### 2. Artwork

The original controller has been reduced from 1,033 lines to a small
composition adapter. Speculative prefetch, interactive requests, polling
transport, attempt/failure lifecycle, final decode/cache promotion, and
partial-preview decoding are separate typed modules. Prefetch target selection,
background request/poll lifecycle, and decode-before-cache promotion are also
separate owners; the public prefetch controller is now a small composition
surface. Interactive artwork similarly composes request creation and
pending/retry transitions while poll state owns timer and timeout bookkeeping.
The next React migration can replace these adapters with TanStack Query hooks
and stable query keys after artwork job state moves out of the shared
application state. Until then, the existing poll controller remains the single
owner; adding a parallel query poller would create conflicting timers and
completion side effects.
On the API side, artwork queue policy, creation guards, reuse policy, runtime
context, and the provider worker are strict TypeScript. The worker owns the
single-job partial/final artifact, retry, cancellation, and visual-only fact
boundary lifecycle; the scheduler must not absorb those responsibilities.

### 3. Explorer

The original 987-line JavaScript controller is now a roughly 220-line typed
composition adapter. Environment plans, deterministic click/navigation, request
identity, cached-page materialization, scene-model orchestration, image
preloading, factual detail, loading feedback, and all explorer presentation
surfaces have named feature owners. Click/overlay coordination is separate from
page materialization, deterministic immediate matching, remote request payloads,
and result application. Environment acquisition/retry is likewise separate from
page-specific target-plan promotion and cache synchronization. The remaining
compatibility responsibility is wiring the application store to those typed
feature contracts.
Curated matching remains mandatory before any VLM result affects navigation.

### 4. Application Runtime

`applicationRuntime.ts` is now a small public facade over a roughly 230-line
typed dependency-composition root and an independently tested runtime
lifecycle. Bootstrap/route
coordination, country navigation activation, generated-state cleanup, state
transitions, top-level view rendering, notifications, preferences, feature
clients, computed configuration, runtime-cache coordination, country setup,
artwork orchestration, and explorer presentation have named typed owners.
Explicit bridges make the few staged construction dependencies visible and
fail fast if used before attachment. The composition root contains wiring only;
it must not regain feature rendering, transport, lifecycle, or stateless
policy.
`ApplicationRuntimeHost.tsx` explicitly starts and disposes that adapter through
React lifecycle; importing the runtime no longer bootstraps the app as a hidden
side effect. The host also observes `useLocation()` and applies explicit
pathnames through an explicit route table; the former global `popstate`
controller has been removed. Continue moving command orchestration onto
feature-owned React stores; the adapter must not regain feature rendering,
transport, polling, or stateless policy.

## Type Migration Order

1. Contracts and shared catalog/config.
2. Domain guardrails and itinerary policy.
3. API feature policies and services.
4. React hooks and state.
5. Browser DOM and provider adapters.

Enable `checkJs` or convert to TypeScript per cohesive package/feature. Never
silence a migration with broad `any` types.

The frontend source tree is now TypeScript/TSX-only. Feature HTTP clients remain
separate, the application config and country-pack registry are typed, and the
artwork composition adapter derives its contract from its typed collaborators.
Architecture tests prevent JavaScript source from silently returning.

The shared `atlas-contracts` package is also TypeScript-only. Its public
`.js` export specifiers remain stable for Node ESM consumers, while package
exports resolve them to typed Zod schema implementations with inferred request
and response types.

The shared `atlas-data` package is TypeScript-only as well. It exposes typed
country catalog records and experience configuration through explicit package
exports, while retaining stable `.js` ESM specifiers for existing consumers.
Architecture tests prevent JavaScript source or wildcard package internals from
returning.

The shared `atlas-prompts` source tree is TypeScript-only. Typed prompt inputs,
page and zoom inference, normalization, and prompt outputs replace JSDoc
contracts and remove the API compiler's compatibility cast. Public `.js`
specifier names remain stable through explicit package exports that resolve to
the TypeScript implementations; architecture tests prevent JavaScript prompt
sources from returning.

The `atlas-domain` source tree is now TypeScript-only. Its typed policy and
navigation boundaries ensure generated imagery cannot become factual evidence,
unconfirmed facts remain visible as unconfirmed, itineraries accept only
curated district or attraction nodes, route resolution is generic over the
country-pack shape, next-artwork selection validates unknown runtime data at
its boundary, and flipbook click resolution shares one typed scene/page
contract with the browser. Stable `.js` package specifiers resolve to typed
implementations. Country-draft review, loading progress, and reference-photo
selection now have explicit boundary types, and the place-image service no
longer casts an inferred JavaScript profile through `unknown`. The React
runtime no longer casts route or flipbook resolvers through `unknown`/`never`;
architecture tests prevent JavaScript source from returning to the package.

Country-draft domain policy no longer lives in one large file. The stable
`countryDraft.js` package export resolves to a small TypeScript facade, while
prompt construction, grounding eligibility, forbidden travel-detail filtering,
untrusted payload normalization, curated-pack projection, and shared draft
types have cohesive owners. Consumers continue importing the public facade;
deployable apps must not reach into the internal policy modules.

The API country-draft feature is TypeScript-only as well. Exa results, OpenAI
response JSON, runtime files, and HTTP bodies are narrowed at their adapter
boundaries. Generator, review, curated-pack append-only policy, persistence,
transport, and composition retain separate owners, so changes to one workflow
do not require retrieving the full backend. The former 700-line HTTP handler
is now a small composition facade over read, influence, and review workflows;
shared request loading and country lookup live in a typed HTTP context.

The API `data` tree is TypeScript-only. Default artwork-page construction
publishes an explicit page contract, legacy scene-graph searches narrow unknown
inputs, and the empty runtime artwork registry has a typed media shape. This
keeps static data projections from becoming an untyped dependency shared by
artwork and explorer workflows.

The API artwork feature is TypeScript-only. Its repository exposes typed job
records and atomic artifact writes; creation, reuse, queue selection, worker
execution, and environment analysis remain distinct modules. Invalid runtime
JSON can no longer flow through these workflows as an assumed object.

The API source tree is now TypeScript-only. The explorer feature completed the
last migration slice: request parsing, HTTP orchestration, semantic-region
persistence, VLM/environment provider adapters, and PNG click annotation have
explicit contracts. The click HTTP workflow is split from its request parser
and dependency types, keeping provider and persistence mechanics outside the
transport module. Curated candidate/envelope orchestration and decorative-layer
normalization preserve the explicit non-factual ambience boundary.

Semantic click-region policy is TypeScript-owned too. Cached regions have typed
normalized coordinates, matched-node identity, confidence metadata, and an
explicit unresolved `vlm_guard` result. Provider phrases still cannot create a
verified node outside the curated pack.

Artwork job-processing policy is TypeScript-owned. Asset-version inputs,
interactive-versus-prefetch priority, retry eligibility, flush exclusion, and
transient provider failures now cross a typed boundary before job services act.
Queue ordering, provider capacity, reserved interactive slots, and stale
processing leases are typed artwork policy too; the generic
`domain/imageJobQueue.js` module has been removed.
Country identity and asset-version extraction for runtime artwork now cross a
typed context boundary, including explicit rejection of legacy cache-directory
names as country slugs.

The former 451-line artwork job creation service is now a roughly 200-line
orchestrator. A typed creation guard owns country-flush exclusion and active
creation waits, while a typed reuse service owns ready-image reuse,
metadata-backed recovery, environment-plan rehydration, and priority promotion.
Generated image responses keep the visual-only, non-factual boundary in every
path.

The artwork scheduler has also been reduced from 454 to about 175 lines.
Repository scans, stale-lease recovery, and capacity selection remain in the
scheduler; a cohesive worker owns one job's provider call, partial and final
artifacts, cancellation, retry state, metadata, environment queueing, and
understanding refresh. Focused worker tests cover success, partial output,
visual-only metadata, and transient retry behavior.

The former catch-all image-provider module is removed. Strict TypeScript image
policy owns defaults, aliases, output normalization, and timeout selection;
the OpenAI platform adapter owns HTTP, streaming events, cancellation, fallback
retry, and provider errors. The typed artwork adapter only binds runtime
configuration to those boundaries. Provider tests mock `fetch` and never call a
live image API.

The place-image feature is TypeScript-only. Prompt grounding, binary media
validation, claim identity, archive projection, Exa and Wikipedia payload
normalization, suggestion-provider fallback, HTTP transport, and feature
composition each have explicit boundaries. Country claim identity and
saved/current history mutations have separate typed services. The resolver
coordinates search, download validation, persistence, and cache reset without
absorbing those lifecycles. The persistence repository keeps cache-path
functions, metadata records, history manifests, and binary reads explicit,
while provider JSON is narrowed from `unknown` before use. Reference photos
remain non-factual visual material. The HTTP facade delegates media delivery,
prompt suggestions, and saved-photo history to separate workflow handlers
instead of collecting every endpoint in one file.

Shared place-image selection is a small stable facade. Hardcoded regional
capital and landmark-query records live in a named configuration module;
profile/query construction and deterministic candidate ranking have separate
policy owners and share explicit boundary types.

Frontend CSS is grouped through feature-owned import manifests. Country-draft
tree, tool/menu, edit-modal, thumbnail, and lightbox rules are independently
retrievable, while explorer environment presentation is separated from motion
keyframes. The root stylesheet remains composition-only.

Country-image selection is TypeScript-owned. Untrusted Wikimedia article and
Commons payload fields are normalized before URL allow-listing, exclusion
patterns, relevance scoring, or deterministic ranking. Architecture tests
prevent the JavaScript policy from returning.

Country-pack compilation is TypeScript-owned. Source-controlled JSON and
worldwide starter scaffolds cross an explicit source contract before the
compiler derives scene dimensions, tiles, prompts, hotspots, ambient bounds,
camera presets, and cache keys. The compiler remains one cohesive
source-to-scene transformation instead of being split by line count. The
server registry is typed too and rejects malformed JSON, missing node
identifiers, and incomplete scene descriptions before compilation.

API HTTP platform primitives are TypeScript-owned. Native Fetch responses,
MIME lookup, safe response headers, and bounded JSON request parsing share one
typed adapter boundary; malformed and oversized bodies retain explicit 400 and
413 failures.

Backend application config is TypeScript-owned. Non-secret model, image, and
server defaults have one typed contract, while environment overrides are
normalized at that boundary.

OpenAI response parsing is TypeScript-owned. Responses API variants are safely
narrowed from `unknown`, and JSON parsing accepts only object payloads before
feature-specific normalization.

Runtime artifact path safety is TypeScript-owned. All cache repositories reuse
one root-containment policy, and malformed or encoded traversal paths resolve
to `null` instead of throwing or escaping their configured root.

Local environment loading is TypeScript-owned. Process-supplied values and
intentional blank test credentials retain precedence, while malformed dotenv
keys are ignored at the platform boundary.

Reference-media fetch mechanics are TypeScript-owned. Metadata and download
requests use centralized user-agent and timeout policy, while cached file
extensions are constrained by trusted content types or parsed URL paths. The
API platform directory contains no JavaScript source files.

Runtime-cache policy and coordination are TypeScript-owned. Deterministic
artifact identities live in the domain boundary, filesystem deletion stays in
the feature repository, and the service coordinates in-flight cancellation
without widening the API composition root. Malformed encoded artifact paths
fail with a bounded 400 response.

Country-card reference media is feature-owned and TypeScript-only. Its topic
registry moved out of the generic API data folder, Wikimedia payloads are
narrowed from `unknown`, unsupported MIME types are not persisted under false
extensions, and decorative image metadata remains outside factual country-pack
data.

The public country-pack catalog and browser-safe experience-config HTTP
handlers are TypeScript-owned. Hono registration, compiled pack registries,
and the non-secret experience shape now cross explicit typed read boundaries.

## Test Ownership

- Pure feature tests should move beside their feature.
- Package consumers should import explicit package exports.
- Root `test/` should retain architecture, contract, integration, and browser
  journeys.
- Playwright must use local artwork and mocked provider responses.

## Later Platform Work

PostgreSQL, object storage, and a durable job queue are API adapter migrations.
They should follow product validation and must not reopen frontend/backend
coupling.
