import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCountryDraftGenerator } from "../apps/api/src/features/countryDraft/countryDraftGenerator.ts";
import { createCountryDraftRepository } from "../apps/api/src/features/countryDraft/countryDraftRepository.ts";
import {
  EXA_MIN_SNIPPET_TEXT_LENGTH,
  createExaCountryGroundingProvider
} from "../apps/api/src/features/countryDraft/exaCountryGroundingProvider.ts";
import { createOpenAICountryDraftProvider } from "../apps/api/src/features/countryDraft/openAICountryDraftProvider.ts";

const country = {
  code: "SG",
  slug: "singapore",
  name: "Singapore"
};

test("country grounding provider uses injected transport and filters thin snippets", async () => {
  const requests = [];
  const provider = createExaCountryGroundingProvider({
    apiKey: "test-key",
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        results: [
          {
            title: "Official guide",
            url: "https://www.visitsingapore.com/guide",
            text: "a".repeat(EXA_MIN_SNIPPET_TEXT_LENGTH)
          },
          {
            title: "Thin result",
            url: "https://example.test/thin",
            text: "too short"
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    },
    logger: { warn() {} }
  });

  const snippets = await provider.search(country);

  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, "https://api.exa.ai/search");
  assert.equal(snippets.length, 1);
  assert.equal(snippets[0].title, "Official guide");
  const bodies = requests.map((request) =>
    JSON.parse(request.options.body)
  );
  assert.ok(
    bodies.every(
      (body) =>
        body.type === "auto" &&
        !Object.hasOwn(body, "includeDomains")
    )
  );
  assert.match(
    bodies[0].query,
    /official tourism itineraries destination guides/
  );
  assert.match(bodies[1].query, /official tourism attractions/);
  assert.match(bodies[2].query, /official public transport/);
});

test("country draft generator does not call providers without an OpenAI key", async () => {
  let groundingCalls = 0;
  const generate = createCountryDraftGenerator({
    groundingProvider: {
      async search() {
        groundingCalls += 1;
        return [];
      }
    },
    draftProvider: {
      isConfigured: false,
      model: "test-model",
      async generate() {
        throw new Error("must not be called");
      }
    }
  });

  const draft = await generate(country);

  assert.equal(groundingCalls, 0);
  assert.equal(draft.generationStatus, "provider_missing");
  assert.equal(draft.confidence, "unconfirmed");
});

test("OpenAI country draft provider uses only its injected transport", async () => {
  const requests = [];
  const provider = createOpenAICountryDraftProvider({
    apiKey: "test-key",
    model: "test-model",
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ regions: [], themes: [] })
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const result = await provider.generate("Create an unconfirmed starter map.");

  assert.equal(result.status, "ready");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
  assert.equal(
    JSON.parse(requests[0].options.body).input[0].content[0].text,
    "Create an unconfirmed starter map."
  );
});

test("country draft generator keeps mocked provider output unconfirmed", async () => {
  const generate = createCountryDraftGenerator({
    groundingProvider: { search: async () => [] },
    draftProvider: {
      isConfigured: true,
      model: "test-model",
      async generate() {
        return {
          status: "ready",
          payload: {
            regions: [{
              name: "Central Area",
              description: "Candidate area for source review",
              children: []
            }],
            themes: []
          }
        };
      }
    }
  });

  const draft = await generate(country);

  assert.equal(draft.generationStatus, "ready");
  assert.equal(draft.model, "test-model");
  assert.equal(draft.confidence, "unconfirmed");
  assert.equal(draft.regions[0].confidence, "unconfirmed");
});

test("country draft repository persists only country-scoped runtime artifacts", async (t) => {
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "roamatlas-draft-test-"));
  t.after(() => rm(cacheRoot, { recursive: true, force: true }));
  const repository = createCountryDraftRepository({ cacheRoot });
  const draft = {
    countrySlug: country.slug,
    mode: "ai_generated",
    regions: [],
    themes: []
  };

  const paths = await repository.write(country, draft);
  await repository.writePromotion({
    country,
    confirmation: { status: "confirmed_for_curation" },
    countryPackDraft: { countrySlug: country.slug }
  });

  const stored = await repository.read(country);
  assert.deepEqual(stored.draft, draft);
  assert.equal(stored.storageKind, "runtime-starter-map");
  assert.match(stored.factBoundary, /unconfirmed/);
  assert.deepEqual(
    JSON.parse(await readFile(paths.starterMapConfirmationPath, "utf8")),
    { status: "confirmed_for_curation" }
  );
  assert.ok(paths.starterMapPath.startsWith(cacheRoot));
});
