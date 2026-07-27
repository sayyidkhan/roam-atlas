import {
  CountryPackRegistryResponseSchema,
  CountryPackResponseSchema
} from "@roamatlas/contracts/countryPackContract.js";
import { jsonResponse } from "../../platform/http/fetchResponses.js";
import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";

export function createCountryPackRoutes(dependencies) {
  return (app) => {
    registerHonoRoute(app, "GET", "/api/country-packs", (context) =>
      handleCountryPackHttpRequest({
        ...dependencies,
        url: new URL(context.req.url)
      })
    );
  };
}

/**
 * Serves curated country-pack data. Runtime drafts are intentionally excluded:
 * this endpoint is the read boundary for source-controlled travel facts.
 */
export function handleCountryPackHttpRequest({
  url,
  countryPacks,
  defaultCountrySlug
}) {
  const countrySlug = String(url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const scope = url.searchParams.get("scope") ?? (countrySlug ? "full" : "summary");

  if (countrySlug) {
    const pack = countryPacks[countrySlug];
    if (!pack) {
      return jsonResponse(
        { error: `Unknown country pack: ${countrySlug}` },
        404
      );
    }

    return jsonResponse(
      CountryPackResponseSchema.parse({
        countrySlug,
        countryPack: pack
      }),
      200,
      { "Cache-Control": "no-cache" }
    );
  }

  const payload = scope === "full"
    ? { defaultCountrySlug, countryPacks }
    : {
        defaultCountrySlug,
        countryPacks: summarizeCountryPackRegistry(countryPacks)
      };
  return jsonResponse(
    CountryPackRegistryResponseSchema.parse(payload),
    200,
    { "Cache-Control": "no-cache" }
  );
}

function summarizeCountryPackRegistry(packs) {
  return Object.fromEntries(
    Object.entries(packs).map(([countrySlug, pack]) => [countrySlug, summarizeCountryPack(pack)])
  );
}

function summarizeCountryPack(pack) {
  return {
    countryCode: pack.countryCode,
    countrySlug: pack.countrySlug,
    title: pack.title,
    rootNodeId: pack.rootNodeId,
    overviewSceneId: pack.overviewSceneId,
    confidence: pack.confidence,
    registration: pack.registration
  };
}
