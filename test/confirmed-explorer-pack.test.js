import assert from "node:assert/strict";
import test from "node:test";

import { handleArtworkHttpRequest } from "../apps/api/src/features/artwork/artworkHttpHandler.ts";
import { createConfirmedExplorerPackResolver } from "../apps/api/src/features/countryCatalog/confirmedExplorerPack.ts";
import { handleCountryPackHttpRequest } from "../apps/api/src/features/countryCatalog/countryPackHttpHandler.ts";
import { compileCountryPackData } from "../apps/api/src/data/countryPacks/compiler.ts";
import {
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene
} from "../apps/api/src/data/defaultArtworkPages.ts";
import { createConfirmedExplorerPackSource } from "../libs/domain/src/confirmedExplorerPack.ts";
import { resolveAppRoute } from "../libs/domain/src/routes.ts";

const thailandDraft = {
  countryCode: "TH",
  countryName: "Thailand",
  countrySlug: "thailand",
  curationStatus: "confirmed_for_curation",
  summary: "Thailand chapters for curation review.",
  sourceRegistry: [
    {
      id: "tourism-thailand",
      title: "Tourism Thailand itineraries",
      url: "https://www.tourismthailand.org/"
    }
  ],
  regions: [
    {
      name: "Bangkok & Kudi Chin",
      kind: "city",
      why: "A city chapter pairing Bangkok with the Kudi Chin neighborhood.",
      confidence: "likely",
      sourceUrl: "https://www.tourismthailand.org/",
      children: [
        {
          name: "Bangkok",
          kind: "city",
          why: "A large urban base for temples, markets, and river travel.",
          confidence: "confirmed",
          sourceUrl: "https://www.tourismthailand.org/",
          children: []
        }
      ]
    },
    {
      name: "Phuket & Andaman Coast",
      kind: "area",
      why: "A coast chapter for Phuket, Krabi, and Phang Nga.",
      confidence: "likely",
      sourceUrl: "https://www.tourismthailand.org/",
      children: []
    }
  ]
};

test("confirmed starter maps compile into an unconfirmed explorer pack", () => {
  const source = createConfirmedExplorerPackSource({
    draft: thailandDraft
  });

  assert.equal(source.registration, "runtime_draft");
  assert.equal(source.confidence, "unconfirmed");
  assert.equal(source.overviewSceneId, "thailand-overview");
  assert.deepEqual(
    source.nodes.thailand.childIds,
    [
      "thailand-bangkok-kudi-chin",
      "thailand-phuket-andaman-coast"
    ]
  );
  assert.equal(
    source.nodes["thailand-bangkok"].facts[0].confidence,
    "likely"
  );
  assert.equal(
    source.scenes["thailand-overview"].hotspots.length,
    2
  );
  assert.equal(
    source.scenes["thailand-bangkok-kudi-chin-scroll"].rootNodeId,
    "thailand-bangkok-kudi-chin"
  );
  assert.equal(
    createConfirmedExplorerPackSource({
      ...thailandDraft,
      curationStatus: "pending"
    }),
    null
  );
});

test("runtime draft packs open the explorer while unregistered packs stay on config", () => {
  const country = { slug: "thailand" };
  const runtimeDraft = {
    registration: "runtime_draft",
    rootNodeId: "thailand",
    nodes: { thailand: { id: "thailand" } }
  };
  const unregistered = {
    registration: "unregistered",
    rootNodeId: "austria"
  };

  assert.equal(
    resolveAppRoute("/thailand", {
      countries: [country],
      countryPacks: { thailand: runtimeDraft }
    }).type,
    "country_overview"
  );
  assert.equal(
    resolveAppRoute("/austria", {
      countries: [{ slug: "austria" }],
      countryPacks: { austria: unregistered }
    }).type,
    "country_needs_config"
  );
});

test("country pack reads serve a confirmed explorer without replacing curated packs", async () => {
  const compiled = compileCountryPackData(
    createConfirmedExplorerPackSource(thailandDraft)
  );
  const curated = {
    ...compiled,
    countrySlug: "singapore",
    registration: "source_controlled",
    confidence: "confirmed"
  };
  let resolverCalls = 0;
  const resolveConfirmedExplorerPack = async () => {
    resolverCalls += 1;
    return compiled;
  };

  const thailandResponse = await handleCountryPackHttpRequest({
    url: new URL("http://127.0.0.1/api/country-packs?slug=thailand"),
    countryPacks: {
      thailand: {
        ...compiled,
        registration: "unregistered"
      }
    },
    defaultCountrySlug: "singapore",
    resolveConfirmedExplorerPack
  });
  const singaporeResponse = await handleCountryPackHttpRequest({
    url: new URL("http://127.0.0.1/api/country-packs?slug=singapore"),
    countryPacks: { singapore: curated },
    defaultCountrySlug: "singapore",
    resolveConfirmedExplorerPack
  });
  const thailandBody = await thailandResponse.json();
  const singaporeBody = await singaporeResponse.json();

  assert.equal(thailandResponse.status, 200);
  assert.equal(thailandBody.countryPack.registration, "runtime_draft");
  assert.equal(
    thailandBody.countryPack.nodes["thailand-bangkok-kudi-chin"].title,
    "Bangkok & Kudi Chin"
  );
  assert.equal(singaporeBody.countryPack.registration, "source_controlled");
  assert.equal(resolverCalls, 1);

  const summaryResponse = await handleCountryPackHttpRequest({
    url: new URL("http://127.0.0.1/api/country-packs?scope=summary"),
    countryPacks: {
      singapore: curated,
      thailand: {
        ...compiled,
        countrySlug: "thailand",
        registration: "unregistered"
      }
    },
    defaultCountrySlug: "singapore",
    resolveConfirmedExplorerPack: async (countrySlug) =>
      countrySlug === "thailand" ? compiled : null
  });
  const summaryBody = await summaryResponse.json();
  assert.equal(summaryBody.countryPacks.singapore.registration, "source_controlled");
  assert.equal(summaryBody.countryPacks.thailand.registration, "runtime_draft");
  assert.equal(summaryBody.countryPacks.thailand.confidence, "unconfirmed");
});

test("artwork uses confirmed chapter names instead of generic map labels", async () => {
  const compiled = compileCountryPackData(
    createConfirmedExplorerPackSource(thailandDraft)
  );
  let imagePrompt = "";
  const response = await handleArtworkHttpRequest({
    url: new URL(
      "http://127.0.0.1/api/artwork?countrySlug=thailand&sceneId=thailand-overview&quality=low"
    ),
    defaultCountrySlug: "singapore",
    getCountryPack: () => ({
      ...compiled,
      registration: "unregistered",
      nodes: {
        ...compiled.nodes,
        thailand: {
          ...compiled.nodes.thailand,
          childIds: []
        }
      }
    }),
    resolveConfirmedExplorerPack: async () => compiled,
    getDefaultArtworkPageForNode,
    getDefaultArtworkPageForScene,
    createImageJob: async (page) => {
      imagePrompt = page.plan.imagePrompt;
      return page;
    },
    normalizeImageQuality: () => "low"
  });

  assert.equal(response.status, 200);
  assert.match(imagePrompt, /1\. Bangkok & Kudi Chin/);
  assert.match(imagePrompt, /2\. Phuket & Andaman Coast/);
  assert.doesNotMatch(imagePrompt, /capital or city core/);
});

test("confirmed explorer resolver reads the stored starter map", async () => {
  const resolver = createConfirmedExplorerPackResolver({
    getCountryBySlug: (slug) =>
      slug === "thailand"
        ? { code: "TH", name: "Thailand", slug: "thailand" }
        : null,
    readStoredDraft: async () => ({ draft: thailandDraft })
  });

  const pack = await resolver("thailand");

  assert.equal(pack.registration, "runtime_draft");
  assert.equal(pack.confidence, "unconfirmed");
  assert.equal(await resolver("austria"), null);
});
