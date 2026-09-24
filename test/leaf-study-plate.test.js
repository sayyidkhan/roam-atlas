import assert from "node:assert/strict";
import test from "node:test";

import { createLeafStudyTopics } from "../libs/domain/src/leafStudyPlate.ts";

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
