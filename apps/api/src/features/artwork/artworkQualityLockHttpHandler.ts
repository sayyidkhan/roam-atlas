import {
  ArtworkQualityLockResponseSchema
} from "@roamatlas/contracts/artworkContract.js";
import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import type {
  CompiledCountryPack
} from "../../data/countryPacks/serverRegistry.ts";
import type {
  CountryArtworkQualityLockService
} from "./countryArtworkQualityLockService.ts";

type ArtworkQualityLockHttpDependencies = {
  defaultCountrySlug: string;
  getCountryPack: (countrySlug: string) => CompiledCountryPack | null;
  qualityLockService: CountryArtworkQualityLockService;
};

export function createArtworkQualityLockRoutes({
  defaultCountrySlug,
  getCountryPack,
  qualityLockService
}: ArtworkQualityLockHttpDependencies): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(
      app,
      "GET",
      "/api/artwork/quality-lock",
      async (context) => {
        const url = new URL(context.req.url);
        const countrySlug =
          url.searchParams.get("countrySlug") ?? defaultCountrySlug;
        if (!getCountryPack(countrySlug)) {
          return jsonResponse(
            { error: `Unknown country pack: ${countrySlug}` },
            404
          );
        }
        const imageQuality =
          await qualityLockService.getLockedImageQuality(countrySlug);
        return jsonResponse(
          ArtworkQualityLockResponseSchema.parse({
            countrySlug,
            imageQuality,
            locked: imageQuality !== null
          })
        );
      }
    );
  };
}
