import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createExaPlaceImageProvider } from "../apps/api/src/features/placeImages/exaPlaceImageProvider.ts";
import {
  getMappedPlaceImageSuggestionContext,
  normalizePlaceImagePromptSuggestions
} from "../apps/api/src/features/placeImages/placeImageSuggestionPolicy.ts";
import {
  PLACE_IMAGE_FACT_BOUNDARY,
  hasUsablePlaceImageDimensions,
  normalizePlaceImageClaimUrl
} from "../apps/api/src/features/placeImages/placeImageMediaPolicy.ts";
import {
  toPlaceImageHistoryItem
} from "../apps/api/src/features/placeImages/placeImageHistoryPolicy.ts";
import { createPlaceImageClaimRegistry } from "../apps/api/src/features/placeImages/placeImageClaimRegistry.ts";
import { createPlaceImageHistoryService } from "../apps/api/src/features/placeImages/placeImageHistoryService.ts";
import { createPlaceImageRepository } from "../apps/api/src/features/placeImages/placeImageRepository.ts";
import { createPlaceImageService } from "../apps/api/src/features/placeImages/placeImageService.ts";
import { createPlaceImageSuggestionProvider } from "../apps/api/src/features/placeImages/placeImageSuggestionProvider.ts";

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

test("place-image media claims ignore tracking parameters without merging paths", () => {
  assert.equal(
    normalizePlaceImageClaimUrl(
      "https://Images.Example.test/Marina.jpg?utm_source=search#preview"
    ),
    "https://images.example.test/marina.jpg"
  );
  assert.notEqual(
    normalizePlaceImageClaimUrl("https://images.example.test/marina.jpg"),
    normalizePlaceImageClaimUrl("https://images.example.test/gardens.jpg")
  );
});

test("place-image history projection does not turn archived media into facts", () => {
  assert.deepEqual(
    toPlaceImageHistoryItem({
      id: "photo-1",
      imageUrl: "/runtime-cache/singapore/place-images/photo-1.webp",
      active: 0,
      feedback: "More gardens",
      fetchedAt: "2026-07-28T00:00:00.000Z",
      archivedAt: "2026-07-28T01:00:00.000Z",
      factBoundary: PLACE_IMAGE_FACT_BOUNDARY
    }),
    {
      id: "photo-1",
      imageUrl: "/runtime-cache/singapore/place-images/photo-1.webp",
      active: false,
      feedback: "More gardens",
      fetchedAt: "2026-07-28T00:00:00.000Z",
      archivedAt: "2026-07-28T01:00:00.000Z"
    }
  );
});

test("place-image claim registry rejects cross-place reuse without treating media as evidence", async () => {
  const registry = createPlaceImageClaimRegistry({
    repository: {
      async listStoredRecords() {
        return [
          {
            place: "Gardens by the Bay",
            remoteImageUrl:
              "https://images.example.test/shared.jpg",
            selectionVersion: "test-v1"
          }
        ];
      }
    },
    selectionVersion: "test-v1"
  });
  const paths = {
    countryCacheRoot: "/tmp/singapore",
    countrySlug: "singapore",
    imageUrlForExtension: () => "",
    metadataPath: "/tmp/singapore/place.json",
    placeSlug: "marina-bay"
  };

  assert.equal(
    await registry.isClaimedByAnotherPlace(
      paths,
      "Marina Bay",
      "https://images.example.test/shared.jpg"
    ),
    true
  );
  assert.equal(
    await registry.isClaimedByAnotherPlace(
      paths,
      "Gardens by the Bay",
      "https://images.example.test/shared.jpg"
    ),
    false
  );
});

test("place-image history service restores a saved photo through typed claim and cache boundaries", async () => {
  const cleared = [];
  const reserved = [];
  let settled = 0;
  const paths = {
    countryCacheRoot: "/tmp/singapore",
    countrySlug: "singapore",
    imageUrlForExtension: () => "",
    metadataPath: "/tmp/singapore/place.json",
    placeSlug: "marina-bay"
  };
  const service = createPlaceImageHistoryService({
    clearRuntimeMemory(countrySlug, place) {
      cleared.push({ countrySlug, place });
    },
    async readStoredRecord() {
      return null;
    },
    repository: {
      async deleteActive() {
        throw new Error("not used");
      },
      async deleteHistoryEntry() {},
      pathsFor() {
        return paths;
      },
      async readHistory() {
        return [];
      },
      async selectHistoryEntry() {
        return {
          previousRecord: {
            place: "Marina Bay",
            remoteImageUrl:
              "https://images.example.test/previous.jpg"
          },
          record: {
            place: "Marina Bay",
            imageUrl:
              "/runtime-cache/singapore/place-images/marina.jpg",
            remoteImageUrl:
              "https://images.example.test/marina.jpg"
          }
        };
      }
    },
    reserveClaim(countrySlug, place, claimKey) {
      reserved.push({ countrySlug, place, claimKey });
    },
    async settlePlaceRequest() {
      settled += 1;
    }
  });

  const result = await service.selectHistoryEntry(
    { slug: "singapore", name: "Singapore" },
    "Marina Bay",
    "saved-photo"
  );

  assert.equal(settled, 1);
  assert.equal(cleared.length, 1);
  assert.equal(reserved.length, 1);
  assert.equal(result.record.id, "current");
  assert.equal(result.record.active, true);
  assert.equal(
    result.record.imageUrl,
    "/runtime-cache/singapore/place-images/marina.jpg"
  );
});

test("place-image repository archives and restores cached media without leaving its country root", async (context) => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "roamatlas-place-images-"));
  context.after(() => rm(cacheRoot, { recursive: true, force: true }));
  const getImagePathFromUrl = (imageUrl) => {
    const prefix = "/runtime-cache/";
    return imageUrl.startsWith(prefix)
      ? path.join(cacheRoot, imageUrl.slice(prefix.length))
      : null;
  };
  const repository = createPlaceImageRepository({
    cacheRoot,
    getImagePathFromUrl,
    selectionVersion: "test-v1",
    logger: { warn() {} }
  });
  const paths = repository.pathsFor("singapore", "Marina Bay");
  const imageBytes = Buffer.from("cached reference photo");

  await repository.writeImage(paths, ".jpg", imageBytes);
  await repository.writeMetadata(paths, {
    countrySlug: "singapore",
    imageUrl: paths.imageUrlForExtension(".jpg"),
    place: "Marina Bay",
    remoteImageUrl: "https://images.example.test/marina.jpg",
    selectionVersion: "test-v1",
    factBoundary: PLACE_IMAGE_FACT_BOUNDARY
  });

  const removed = await repository.removePlace(paths, {
    preserveHistory: true
  });
  assert.equal(removed.archived?.place, "Marina Bay");
  assert.equal((await repository.readHistory(paths)).length, 1);
  assert.equal(await repository.readStoredRecord(paths), null);

  const restored = await repository.selectHistoryEntry(
    paths,
    String(removed.archived.id)
  );
  assert.equal(restored.record.place, "Marina Bay");
  assert.equal((await repository.readHistory(paths)).length, 0);
  assert.deepEqual(
    (await repository.readCachedImage(String(restored.record.imageUrl)))?.bytes,
    imageBytes
  );

  await repository.deleteActive(paths);
  assert.equal(await repository.readStoredRecord(paths), null);
  assert.equal(
    await repository.readCachedImage(
      "/runtime-cache/../outside/place-image.jpg"
    ),
    null
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
