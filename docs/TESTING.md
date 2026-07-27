# RoamAtlas Testing Policy

## Provider Isolation

Automated tests must not call the live OpenAI API, Exa, Wikimedia, Wikipedia,
or any other external network service.

`OPENAI_API_KEY` and `EXA_API_KEY` must be absent from every test process. A
test that attempts to use either provider is a failure, not a skipped test.

## Test Layers

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Node test runner plus Vitest during migration | Pure policies, prompts, queue rules, cache keys, geometry |
| Component | Vitest and React Testing Library | React shells, feature components, accessibility, interaction |
| Contract | Vitest | Zod API schemas and client/server fixtures (`npm run test:contract`) |
| Browser | Playwright | User journeys using local API and image fixtures |

## Playwright Fixture Rules

Playwright routes every app API request to deterministic local fixtures.
Fixtures cover these artwork job states:

- `pending_codex_image_generation`
- `processing_openai_image`
- `partial_ready`
- `ready`
- `failed`

Use small local PNG, JPEG, or WebP files for artwork and partial previews. Do
not store live generated images as assertions of factual truth. Fixture image
content is decorative only; all asserted detail text, source links, confidence
labels, and itinerary outputs must come from curated test data.

The browser suite must include fixture outcomes for:

- a confirmed hotspot and curated drill-down;
- an ambiguous visual description that offers curated choices;
- an unmatched click becoming an explicitly unconfirmed detour;
- a missing or failed artwork job that leaves node facts and itinerary actions
  usable;
- saved curated discoveries producing only approximate itinerary entries.

## Network Lockdown

The Playwright context must abort every request not targeting the local app or
a declared fixture. Add a global assertion that records unexpected outbound
requests and fails the test after each scenario.

If a legacy component references a remote thumbnail, declare and fulfill it
with a local fixture inside the test. Do not allow the browser to retrieve it.

Provider adapters are unit-tested with mocked `fetch` or mocked SDK clients.
They must have separate fixtures for streamed partial images, final images,
timeouts, retryable failures, and permanent failures.

## Required Gates

Before merging a migration change, run:

```text
typecheck
lint
unit tests
contract tests
Playwright browser tests with network lockdown
production build
```

The existing Node test suite remains the baseline until equivalent Vitest and
Playwright coverage has been added; do not delete a legacy test merely because
the code moves files.

Run React component and typed feature-policy tests with `npm run test:react`.
`npm run lint` runs both ESLint and the CSS quality gate. Use
`npm run lint:css` when iterating on styles alone.
