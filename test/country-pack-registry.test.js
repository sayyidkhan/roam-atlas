import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCountryPackSource
} from "../apps/api/src/data/countryPacks/serverRegistry.ts";

test("country-pack registry narrows source JSON before compilation", () => {
  const source = parseCountryPackSource(
    JSON.stringify({
      confidence: "unconfirmed",
      countryCode: "TS",
      countrySlug: "test-country",
      overviewSceneId: "test-overview",
      rootNodeId: "test-country",
      title: "Test Country",
      nodes: {
        "test-country": {
          id: "test-country",
          title: "Test Country"
        }
      },
      scenes: {
        "test-overview": {
          rootNodeId: "test-country",
          title: "Test Overview",
          visualContext:
            "Unconfirmed generic visual scaffold without factual claims."
        }
      }
    }),
    "test-country.json"
  );

  assert.equal(source.countrySlug, "test-country");
  assert.equal(source.scenes["test-overview"].rootNodeId, "test-country");
});

test("country-pack registry rejects malformed JSON and incomplete scenes", () => {
  assert.throws(
    () => parseCountryPackSource("{", "broken.json"),
    /Invalid country-pack JSON/
  );
  assert.throws(
    () =>
      parseCountryPackSource(
        JSON.stringify({
          confidence: "unconfirmed",
          countryCode: "TS",
          countrySlug: "test-country",
          overviewSceneId: "test-overview",
          rootNodeId: "test-country",
          title: "Test Country",
          nodes: {
            "test-country": {
              id: "test-country",
              title: "Test Country"
            }
          },
          scenes: {
            "test-overview": {
              rootNodeId: "test-country",
              title: "Test Overview"
            }
          }
        }),
        "incomplete.json"
      ),
    /visualContext must be a non-empty string/
  );
});
