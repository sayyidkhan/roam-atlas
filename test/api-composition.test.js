import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { createArtworkRoutes } from "../apps/api/src/features/artwork/artworkHttpHandler.ts";
import { createCountryPackRoutes } from "../apps/api/src/features/countryCatalog/countryPackHttpHandler.ts";
import { createCountryDraftRoutes } from "../apps/api/src/features/countryDraft/countryDraftHttpHandler.ts";
import { createCountryImageRoutes } from "../apps/api/src/features/countryImages/countryImageHttpHandler.ts";
import { createExperienceConfigRoutes } from "../apps/api/src/features/experience/experienceConfigHttpHandler.ts";
import { createClickResolutionRoutes } from "../apps/api/src/features/explorer/clickResolutionHttpHandler.ts";
import { createPlaceImageRoutes } from "../apps/api/src/features/placeImages/placeImageHttpHandler.ts";
import { createRuntimeArtifactRoutes } from "../apps/api/src/features/runtimeCache/runtimeArtifactHttpHandler.ts";
import { createRuntimeCacheRoutes } from "../apps/api/src/features/runtimeCache/runtimeCacheHttpHandler.ts";
import { registerHonoRoute } from "../apps/api/src/platform/http/honoRoutes.ts";
import { createRoamAtlasApi } from "../apps/api/src/server/createRoamAtlasApi.ts";

test("typed Hono composition registers every feature-owned API route", () => {
  const handler = async () => {};
  const app = createRoamAtlasApi({
    routeRegistrars: createRouteRegistrars(handler)
  });
  const registered = new Set(
    app.routes.map((route) => `${route.method} ${route.path}`)
  );

  assert.ok(registered.has("POST /api/resolve-click"));
  assert.ok(registered.has("GET /api/artwork"));
  assert.ok(registered.has("HEAD /api/place-image"));
  assert.ok(registered.has("POST /api/country-draft/approve-item"));
  assert.ok(registered.has("POST /api/runtime-cache/flush"));
  assert.ok(registered.has("GET /runtime-cache/*"));
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
    ]
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
    createRuntimeArtifactRoutes({
      runtimeCacheRoot: "/tmp/unused-runtime-cache",
      runtimeCacheUrlPrefix: "/runtime-cache"
    }),
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
