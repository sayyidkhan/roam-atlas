import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCountryImageService } from "../src/features/countryImages/countryImageService.js";
import { handleCountryImageHttpRequest } from "../src/features/countryImages/countryImageHttpHandler.js";
import { createCountryImageRepository } from "../src/features/countryImages/countryImageRepository.js";
import {
  selectCountryArticleImage,
  selectCountrySearchImage
} from "../src/features/countryImages/countryImageSelection.js";
import {
  getPlaceWikipediaArticleCandidates,
  resolvePlaceWikipediaImage
} from "../src/features/placeImages/wikipediaPlaceImageProvider.js";

const singapore = {
  code: "SG",
  name: "Singapore",
  slug: "singapore"
};

test("country-image service prefers a local decorative card without provider traffic", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "roamatlas-country-card-")
  );
  const publicDirectory = path.join(temporaryRoot, "country-cards");
  await mkdir(publicDirectory, { recursive: true });
  await writeFile(
    path.join(publicDirectory, "singapore.jpg"),
    Buffer.from("fixture")
  );

  let providerCalled = false;
  try {
    const service = createCountryImageService({
      repository: createCountryImageRepository({
        publicDirectory,
        publicUrlPrefix: "/public/country-cards"
      }),
      fetchFn: async () => {
        providerCalled = true;
        throw new Error("local fixture should prevent provider traffic");
      }
    });
    const response = await handleCountryImageHttpRequest({
      url: new URL(
        "http://localhost/api/country-image?countrySlug=singapore&v=test-version"
      ),
      getCountryBySlug: (slug) =>
        slug === "singapore" ? singapore : null,
      resolveImage: service.resolveImage,
      isLocalImageUrl: service.isLocalImageUrl
    });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("Location"),
      "/public/country-cards/singapore.jpg?v=test-version"
    );
    assert.equal(response.headers.get("X-RoamAtlas-Image-Source"), "local-country-card");
    assert.equal(providerCalled, false);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("country-image selection rejects flags and prefers relevant place artwork", () => {
  const selected = selectCountrySearchImage(
    [
      {
        title: "File:Flag of Singapore.svg",
        imageinfo: [
          {
            mime: "image/svg+xml",
            thumburl: "https://upload.wikimedia.org/flag.svg"
          }
        ]
      },
      {
        title: "File:Singapore Marina Bay skyline.jpg",
        imageinfo: [
          {
            mime: "image/jpeg",
            thumburl: "https://upload.wikimedia.org/marina-bay.jpg"
          }
        ]
      }
    ],
    "Singapore Marina Bay",
    "Singapore"
  );

  assert.equal(
    selected.imageUrl,
    "https://upload.wikimedia.org/marina-bay.jpg"
  );
});

test("country article selection only accepts Wikimedia visual media", () => {
  const selected = selectCountryArticleImage(
    [
      {
        title: "Marina Bay Sands",
        thumbnail: { source: "https://example.com/untrusted.jpg" }
      },
      {
        title: "Gardens by the Bay",
        thumbnail: {
          source: "https://upload.wikimedia.org/gardens-by-the-bay.jpg"
        }
      }
    ],
    ["Marina Bay Sands", "Gardens by the Bay"],
    "Singapore"
  );

  assert.equal(selected.pageTitle, "Gardens by the Bay");
});

test("place Wikipedia fallback is injected and remains non-factual media", async () => {
  const result = await resolvePlaceWikipediaImage(
    singapore,
    "Marina Bay Sands",
    {
      fetchFn: async () => ({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        async json() {
          return {
            query: {
              pages: {
                1: {
                  title: "Marina Bay Sands",
                  thumbnail: {
                    source: "https://upload.wikimedia.org/marina-bay-sands.jpg"
                  }
                }
              }
            }
          };
        }
      })
    }
  );

  assert.equal(
    result.query,
    "wikipedia article reference-photo fallback"
  );
  assert.match(result.sourceUrl, /wikipedia\.org\/wiki\/Marina_Bay_Sands/);
  assert.deepEqual(
    getPlaceWikipediaArticleCandidates(
      singapore,
      "Marina Bay Sands",
      "Gardens by the Bay"
    ).slice(0, 2),
    ["Marina Bay Sands", "Marina Bay Sands, Singapore"]
  );
});
