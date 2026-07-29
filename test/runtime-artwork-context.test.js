import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuntimeArtworkContext,
  extractAssetVersionFromRuntimeUrl
} from "../apps/api/src/features/artwork/runtimeArtworkContext.ts";

const packs = {
  singapore: { countrySlug: "singapore" },
  malaysia: { countrySlug: "malaysia" }
};

const context = createRuntimeArtworkContext({
  defaultCountrySlug: "singapore",
  defaultRuntimeCountrySlug: "singapore",
  runtimeCacheUrlPrefix: "/runtime-cache",
  getCountryPack: (countrySlug) => packs[countrySlug]
});

test("runtime artwork context resolves country identity without server globals", () => {
  assert.equal(
    context.getCountrySlugForPage({ countrySlug: " Malaysia " }),
    "malaysia"
  );
  assert.equal(
    context.getCountrySlugForPage({
      imageUrl: "/runtime-cache/malaysia/flipbook/page.1234567890abcdef.png"
    }),
    "malaysia"
  );
  assert.equal(
    context.getCountrySlugForJob({
      imageUrl: "/runtime-cache/image-jobs/legacy.json"
    }),
    "singapore"
  );
  assert.equal(
    context.getCountryPackForPage({ countrySlug: "unknown" }),
    packs.singapore
  );
});

test("runtime artwork context extracts deterministic asset versions", () => {
  assert.equal(
    extractAssetVersionFromRuntimeUrl(
      "/runtime-cache/singapore/flipbook/page.1234567890abcdef.partial.webp"
    ),
    "1234567890abcdef"
  );
  assert.equal(
    context.resolveAssetVersionForPage({
      assetVersion: "fedcba0987654321",
      imageUrl:
        "/runtime-cache/singapore/flipbook/page.1234567890abcdef.webp"
    }),
    "fedcba0987654321"
  );
  assert.equal(extractAssetVersionFromRuntimeUrl("/public/image.webp"), null);
});

test("runtime artwork context requires a registered default pack", () => {
  assert.throws(
    () =>
      createRuntimeArtworkContext({
        defaultCountrySlug: "missing",
        defaultRuntimeCountrySlug: "missing",
        runtimeCacheUrlPrefix: "/runtime-cache",
        getCountryPack: () => null
      }),
    /No default country pack is registered/
  );
});
