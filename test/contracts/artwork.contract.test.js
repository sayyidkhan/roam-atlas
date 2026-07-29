import { describe, expect, it } from "vitest";

import { countryPacks } from "../../apps/api/src/data/countryPacks/serverRegistry.ts";
import { getDefaultArtworkPageForScene } from "../../apps/api/src/data/defaultArtworkPages.ts";
import {
  ArtworkRequestQuerySchema,
  ArtworkResponseSchema
} from "../../libs/contracts/src/artworkContract.ts";
import {
  CountryPackRegistryResponseSchema,
  CountryPackResponseSchema
} from "../../libs/contracts/src/countryPackContract.ts";
import {
  RuntimeCacheFlushRequestSchema,
  RuntimeCacheFlushResponseSchema
} from "../../libs/contracts/src/runtimeCacheContract.ts";

describe("artwork and country-pack contracts", () => {
  it("accepts a curated Singapore artwork page", () => {
    const pack = countryPacks.singapore;
    const page = getDefaultArtworkPageForScene(
      "singapore-overview",
      pack.scenes,
      pack.nodes,
      pack.countrySlug,
      pack.title
    );

    expect(ArtworkResponseSchema.parse({ page }).page.plan.factMode).toBe("curated");
  });

  it("rejects invalid artwork queries and missing factual modes", () => {
    expect(() => ArtworkRequestQuerySchema.parse({ quality: "ultra" })).toThrow();
    expect(() => ArtworkResponseSchema.parse({
      page: {
        id: "page",
        countrySlug: "singapore",
        sceneId: "singapore-overview",
        nodeId: "singapore",
        status: "ready",
        plan: { title: "Singapore" }
      }
    })).toThrow();
  });

  it("keeps source-controlled pack metadata in registry and single-pack responses", () => {
    const singapore = countryPacks.singapore;
    const registry = CountryPackRegistryResponseSchema.parse({
      defaultCountrySlug: "singapore",
      countryPacks
    });

    expect(registry.countryPacks.singapore.confidence).toBe("confirmed");
    expect(registry.countryPacks.afghanistan.registration).toBe("unregistered");
    expect(CountryPackResponseSchema.parse({
      countrySlug: "singapore",
      countryPack: singapore
    }).countryPack.registration).toBe("source_controlled");
  });

  it("limits destructive cache flushing to a known scope and a structured response", () => {
    expect(RuntimeCacheFlushRequestSchema.parse({ countrySlug: "singapore", scope: "visuals" }).scope)
      .toBe("visuals");
    expect(() => RuntimeCacheFlushRequestSchema.parse({ countrySlug: "", scope: "everything" })).toThrow();
    expect(RuntimeCacheFlushResponseSchema.parse({
      countrySlug: "singapore",
      countryName: "Singapore",
      scope: "all",
      flushed: true,
      factBoundary: "Source-controlled country pack data was not changed."
    }).flushed).toBe(true);
  });
});
