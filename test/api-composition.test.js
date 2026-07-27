import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { createArtworkRoutes } from "../src/features/artwork/artworkHttpHandler.js";
import { createCountryPackRoutes } from "../src/features/countryCatalog/countryPackHttpHandler.js";
import { createCountryDraftRoutes } from "../src/features/countryDraft/countryDraftHttpHandler.js";
import { createCountryImageRoutes } from "../src/features/countryImages/countryImageHttpHandler.js";
import { createExperienceConfigRoutes } from "../src/features/experience/experienceConfigHttpHandler.js";
import { createClickResolutionRoutes } from "../src/features/explorer/clickResolutionHttpHandler.js";
import { createPlaceImageRoutes } from "../src/features/placeImages/placeImageHttpHandler.js";
import { createRuntimeCacheRoutes } from "../src/features/runtimeCache/runtimeCacheHttpHandler.js";
import { registerHonoRoute } from "../src/platform/http/honoRoutes.ts";
import { createRoamAtlasApi } from "../src/server/createRoamAtlasApi.ts";

test("typed Hono composition registers every feature-owned API route", () => {
  const handler = async () => {};
  const app = createRoamAtlasApi({
    routeRegistrars: createRouteRegistrars(handler),
    liveReload: {
      routePath: "/__live-reload",
      handleRequest: () => {}
    },
    serveStaticAsset: async () => {}
  });
  const registered = new Set(
    app.routes.map((route) => `${route.method} ${route.path}`)
  );

  assert.ok(registered.has("POST /api/resolve-click"));
  assert.ok(registered.has("GET /api/artwork"));
  assert.ok(registered.has("HEAD /api/place-image"));
  assert.ok(registered.has("POST /api/country-draft/approve-item"));
  assert.ok(registered.has("POST /api/runtime-cache/flush"));
  assert.ok(registered.has("GET /__live-reload"));
});

test("Hono dispatches a feature route through native Fetch responses", async () => {
  let receivedCountry;
  const app = createRoamAtlasApi({
    routeRegistrars: [
      createCountryImageRoutes({
        getCountryBySlug: (countrySlug) => ({ slug: countrySlug }),
        resolveImage: async (country) => {
          receivedCountry = country;
          return {
            imageUrl: "https://images.example.test/singapore.jpg",
            source: "fixture",
            pageTitle: "Singapore"
          };
        },
        isLocalImageUrl: () => false
      })
    ],
    liveReload: {
      routePath: "/__live-reload",
      handleRequest: () => {}
    },
    serveStaticAsset: async () => {}
  });

  const response = await app.fetch(
    new Request("http://127.0.0.1/api/country-image?countrySlug=singapore")
  );

  assert.equal(receivedCountry?.slug, "singapore");
  assert.equal(response.status, 302);
});

test("Hono maps request-contract validation failures to HTTP 400", async () => {
  const app = createRoamAtlasApi({
    routeRegistrars: [
      (honoApp) => {
        registerHonoRoute(
          honoApp,
          "GET",
          "/api/contract-failure",
          () => z.object({ countrySlug: z.string() }).parse({})
        );
      }
    ],
    liveReload: {
      routePath: "/__live-reload",
      handleRequest: () => {}
    },
    serveStaticAsset: async () => {},
    logger: { error() {} }
  });

  const response = await app.fetch(
    new Request("http://127.0.0.1/api/contract-failure")
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /countrySlug/);
});

function createRouteRegistrars(handler) {
  const placeHandlers = {
    handleImageRequest: handler,
    handleResetRequest: handler,
    handleFeedbackRequest: handler,
    handleSuggestionsRequest: handler,
    handleHistoryRequest: handler,
    handleHistorySelectionRequest: handler,
    handleHistoryDeleteRequest: handler
  };
  const draftHandlers = {
    handleDraftRequest: handler,
    handleInfluenceRequest: handler,
    handleConfirmRequest: handler,
    handleReorderRequest: handler,
    handleApprovalRequest: handler
  };

  return [
    createClickResolutionRoutes({
      handleResolveClick: handler,
      handleFlipbookClick: handler
    }),
    createArtworkRoutes({}),
    createExperienceConfigRoutes({}),
    createCountryImageRoutes({
      getCountryBySlug: handler,
      resolveImage: handler,
      isLocalImageUrl: handler
    }),
    createPlaceImageRoutes(placeHandlers),
    createCountryPackRoutes({}),
    createCountryDraftRoutes(draftHandlers),
    createRuntimeCacheRoutes({})
  ];
}
