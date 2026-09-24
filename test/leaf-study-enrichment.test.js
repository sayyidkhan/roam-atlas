import assert from "node:assert/strict";
import test from "node:test";

import { buildLeafStudyPrompt } from "../libs/prompts/src/buildLeafStudyPrompt.ts";
import { normalizeLeafStudyNotes } from "../apps/api/src/features/explorer/leafStudyEnrichmentPolicy.ts";
import { createOpenAILeafStudyEnricher } from "../apps/api/src/features/explorer/openAILeafStudyEnricher.ts";

const topics = [{
  id: "rainforest",
  text: "Rainforest is one of Bako's main habitats, with jungle trails running through it."
}, {
  id: "beach",
  text: "Beaches are part of Bako's habitats, and scenic treks in the park lead to secluded ones."
}];

test("leaf study prompt asks for distinct notes without new travel claims", () => {
  const prompt = buildLeafStudyPrompt({
    countryName: "Malaysia",
    placeTitle: "Bako National Park",
    topics: topics.map((topic) => ({
      ...topic,
      label: topic.id,
      sourceUrl: "https://www.sarawaktourism.com/example"
    }))
  });

  assert.match(prompt, /Do not start a note with the pattern/);
  assert.match(prompt, /opening hours, prices, tickets/);
  assert.match(prompt, /rainforest/);
  assert.match(prompt, /Bako National Park/);
});

test("leaf study enrichment drops repeated text and unsupported claims", () => {
  const notes = normalizeLeafStudyNotes(topics, {
    notes: [
      {
        id: "rainforest",
        text: "Under the canopy, Bako's jungle trails pass through dim, humid forest where the light breaks into small patches."
      },
      {
        id: "beach",
        text: "Beaches are part of Bako's habitats, and scenic treks in the park lead to secluded ones."
      },
      {
        id: "beach",
        text: "The beach is open daily from 8:00 and tickets cost RM 10 for a 2 km walk."
      },
      {
        id: "invented",
        text: "A hidden lagoon west of the park has a private pier and a café."
      }
    ]
  });

  assert.deepEqual(notes.map((note) => note.id), ["rainforest"]);
});

test("leaf study enricher uses the curated node and records usage", async () => {
  const recorded = [];
  const enrich = createOpenAILeafStudyEnricher({
    apiKey: "test-key",
    model: "gpt-5.6-terra",
    serviceTier: "fast",
    recordUsage: (input) => recorded.push(input),
    getCountryPack: () => ({
      title: "Malaysia",
      nodes: {
        bako: {
          id: "bako",
          title: "Bako National Park",
          childIds: [],
          facts: topics.map((topic) => ({
            ...topic,
            label: topic.id,
            confidence: "confirmed",
            sourceUrl: "https://www.sarawaktourism.com/example"
          }))
        }
      }
    }),
    fetchFn: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.temperature, undefined);
      assert.match(body.input[0].content[0].text, /Bako National Park/);
      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            notes: [{
              id: "rainforest",
              text: "Under the canopy, Bako's jungle trails pass through dim, humid forest where the light breaks into small patches."
            }, {
              id: "beach",
              text: "The sand sits at the end of a trek, a quiet shoreline rather than a built-up bay."
            }]
          }),
          usage: { input_tokens: 20, output_tokens: 40 }
        })
      };
    }
  });

  const notes = await enrich({ countrySlug: "malaysia", nodeId: "bako" });
  assert.equal(notes.length, 2);
  assert.equal(recorded[0].feature, "leaf_study");
  const cached = await enrich({ countrySlug: "malaysia", nodeId: "bako" });
  assert.equal(cached.length, 2);
  assert.equal(recorded.length, 1);
});
