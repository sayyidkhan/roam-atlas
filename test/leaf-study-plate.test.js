import assert from "node:assert/strict";
import test from "node:test";

import { createLeafStudyTopics } from "../libs/domain/src/leafStudyPlate.ts";
import { containsInternalVisitorCopy } from "../libs/domain/src/visitorCopyPolicy.ts";
import { countryPacks } from "../apps/api/src/data/countryPacks/serverRegistry.ts";

test("published place facts and source titles contain no development commentary", () => {
  for (const pack of Object.values(countryPacks)) {
    for (const source of Object.values(pack.sourceRegistry ?? {})) {
      assert.equal(containsInternalVisitorCopy(source.title ?? ""), false, source.title);
    }
    for (const node of Object.values(pack.nodes)) {
      for (const fact of node.facts ?? []) {
        assert.equal(containsInternalVisitorCopy(fact.text), false, `${node.id}: ${fact.text}`);
      }
    }
  }
  assert.match(countryPacks.singapore.nodes["merlion-park"].facts[0].text, /photo stop/);
});

test("old internal descriptions cannot become study captions", () => {
  const topics = createLeafStudyTopics({
    title: "Merlion Park", childIds: [], facts: [
      { id: "old", text: "Merlion Park is included in the Marina Bay demo path." },
      { id: "current", text: "Merlion Park is a photo stop in the Marina Bay chapter.", confidence: "confirmed" }
    ]
  });
  assert.deepEqual(topics.map((topic) => topic.id), ["current"]);
  assert.equal(topics[0].confidence, "confirmed");
});

test("leaf topics keep a distinct curated fact for each section", () => {
  const topics = createLeafStudyTopics({
    id: "malaysia-kuching-bako-national-park",
    title: "Bako National Park",
    parentId: "malaysia-sarawak-kuching",
    childIds: [],
    facts: [{
      id: "rainforest",
      label: "Rainforest",
      text: "Rainforest is one of Bako's main habitats, with jungle trails running through it.",
      confidence: "confirmed",
      sourceUrl: "https://www.sarawaktourism.com/web/places-to-visit/town-view/kuching/major-attractions/bako-national-park"
    }, {
      id: "beach",
      label: "Beach",
      text: "Beaches are part of Bako's habitats, and scenic treks in the park lead to secluded ones.",
      confidence: "confirmed",
      sourceUrl: "https://www.sarawaktourism.com/web/things-to-do/thing-view/nature/national-parks-wildlife-reserves/bako-national-park"
    }]
  });

  assert.deepEqual(
    topics.map((topic) => topic.label),
    ["Rainforest", "Beach"]
  );
  assert.notEqual(topics[0].text, topics[1].text);
  assert.match(topics[0].text, /jungle trails/);
  assert.match(topics[1].text, /secluded/);
});

test("one shared sentence stays one topic", () => {
  const topics = createLeafStudyTopics({
    title: "Fort Margherita",
    childIds: [],
    tags: ["heritage", "river"],
    facts: [{
      id: "fort-summary",
      text: "Fort Margherita is a historic river-facing Kuching landmark that now houses the Brooke Gallery.",
      confidence: "confirmed",
      sourceUrl: "https://www.sarawaktourism.com/example"
    }]
  });

  assert.equal(topics.length, 1);
  assert.equal(topics[0].label, "Fort Margherita");
  assert.match(topics[0].text, /Brooke Gallery/);
});

test("pages with child places keep the destination rail", () => {
  assert.deepEqual(
    createLeafStudyTopics({
      title: "Kuching",
      childIds: ["waterfront"],
      facts: [{ text: "Kuching has a river waterfront." }]
    }),
    []
  );
});
