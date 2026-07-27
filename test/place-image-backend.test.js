import assert from "node:assert/strict";
import test from "node:test";

import { createExaPlaceImageProvider } from "../src/features/placeImages/exaPlaceImageProvider.js";
import {
  PLACE_IMAGE_FACT_BOUNDARY,
  getMappedPlaceImageSuggestionContext,
  hasUsablePlaceImageDimensions,
  normalizePlaceImagePromptSuggestions
} from "../src/features/placeImages/placeImagePolicy.js";
import { createPlaceImageService } from "../src/features/placeImages/placeImageService.js";
import { createPlaceImageSuggestionProvider } from "../src/features/placeImages/placeImageSuggestionProvider.js";

test("Exa place-image provider uses injected transport and deduplicates usable media", async () => {
  const requests = [];
  const provider = createExaPlaceImageProvider({
    apiKey: "test-key",
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        results: [{
          url: "https://example.test/article",
          image: "https://images.example.test/marina-bay.jpg",
          extras: {
            imageLinks: [
              "https://images.example.test/marina-bay.jpg",
              "https://images.example.test/logo.svg"
            ]
          }
        }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    },
    logger: { warn() {} }
  });

  const candidates = await provider.search({
    place: "Marina Bay",
    countryName: "Singapore",
    countrySlug: "singapore",
    context: "",
    kind: "district",
    tags: [],
    strategy: "district",
    queries: ["Marina Bay Singapore reference photograph"]
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.exa.ai/search");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].imageUrl, "https://images.example.test/marina-bay.jpg");
});

test("place-image prompt policy only accepts supplied mapped location names", () => {
  const country = { slug: "singapore", name: "Singapore" };
  const getCountryPack = () => ({
    nodes: {
      marina: {
        id: "marina",
        title: "Marina Bay",
        type: "district",
        childIds: ["gardens"]
      },
      gardens: { id: "gardens", title: "Gardens by the Bay" }
    }
  });

  assert.deepEqual(
    getMappedPlaceImageSuggestionContext(country, "Marina Bay", getCountryPack),
    {
      title: "Marina Bay",
      kind: "district",
      children: ["Gardens by the Bay"]
    }
  );
  assert.deepEqual(
    normalizePlaceImagePromptSuggestions(
      [
        "Show Gardens by the Bay from the waterfront",
        "Show an invented secret island",
        "short"
      ],
      { place: "Marina Bay", context: ["Gardens by the Bay"] }
    ),
    ["Show Gardens by the Bay from the waterfront"]
  );
});

test("place-image suggestion provider falls back without making an API request", async () => {
  let fetchCalls = 0;
  const provider = createPlaceImageSuggestionProvider({
    apiKey: "",
    model: "test-model",
    extractText: () => "",
    parseJson: () => ({}),
    fetchFn: async () => {
      fetchCalls += 1;
      throw new Error("must not be called");
    }
  });

  const result = await provider.suggest(
    { name: "Singapore" },
    { place: "Marina Bay", context: ["Gardens by the Bay"] }
  );

  assert.equal(fetchCalls, 0);
  assert.equal(result.source, "curated-fallback");
  assert.match(result.suggestions[0], /Gardens by the Bay/);
});

test("place-image service persists downloaded media through its repository boundary", async () => {
  const writes = [];
  const repository = createMemoryRepository(writes);
  const service = createPlaceImageService({
    repository,
    exaProvider: {
      available: true,
      async search() {
        return [{
          imageUrl: "https://images.example.test/marina.jpg",
          sourceUrl: "https://example.test/marina",
          query: "Marina Bay Singapore",
          score: 12
        }];
      }
    },
    wikipediaProvider: async () => null,
    suggestionProvider: { suggest: async () => ({ suggestions: [], source: "test" }) },
    getCountryPack: () => ({ nodes: {} }),
    selectionVersion: "test-v1",
    fetchFn: async () => new Response(createPngHeaderBuffer(320, 200), {
      status: 200,
      headers: { "Content-Type": "image/png" }
    })
  });

  const record = await service.resolveImage(
    { slug: "singapore", name: "Singapore" },
    "Marina Bay",
    { kind: "district" }
  );

  assert.equal(writes.length, 2);
  assert.equal(writes[0].type, "image");
  assert.equal(writes[1].type, "metadata");
  assert.equal(record.imageUrl, "/runtime-cache/singapore/place-images/marina-bay.png");
  assert.equal(record.factBoundary, PLACE_IMAGE_FACT_BOUNDARY);
  assert.equal(record.selectionVersion, "test-v1");
});

test("place-image dimensions reject badge-sized raster assets", () => {
  assert.equal(
    hasUsablePlaceImageDimensions(createPngHeaderBuffer(120, 120), "image/png"),
    false
  );
  assert.equal(
    hasUsablePlaceImageDimensions(createPngHeaderBuffer(640, 360), "image/png"),
    true
  );
});

function createMemoryRepository(writes) {
  return {
    pathsFor(countrySlug) {
      return {
        countrySlug,
        placeSlug: "marina-bay",
        countryCacheRoot: `/tmp/${countrySlug}`,
        metadataPath: `/tmp/${countrySlug}/place-images/marina-bay.json`,
        imageUrlForExtension: (extension) =>
          `/runtime-cache/${countrySlug}/place-images/marina-bay${extension}`
      };
    },
    async readStoredRecord() {
      return null;
    },
    async listStoredRecords() {
      return [];
    },
    async writeImage(_paths, extension, bytes) {
      writes.push({ type: "image", extension, bytes });
    },
    async writeMetadata(_paths, record) {
      writes.push({ type: "metadata", record });
    }
  };
}

function createPngHeaderBuffer(width, height) {
  const buffer = Buffer.alloc(4096);
  buffer.writeUInt8(0x89, 0);
  buffer.write("PNG", 1, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}
