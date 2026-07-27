import {
  CountryPackRegistryResponseSchema,
  CountryPackResponseSchema
} from "./countryPackContract.js";

/**
 * Serves curated country-pack data. Runtime drafts are intentionally excluded:
 * this endpoint is the read boundary for source-controlled travel facts.
 */
export function handleCountryPackHttpRequest({ url, response, countryPacks, defaultCountrySlug }) {
  const countrySlug = String(url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const scope = url.searchParams.get("scope") ?? (countrySlug ? "full" : "summary");

  if (countrySlug) {
    const pack = countryPacks[countrySlug];
    if (!pack) {
      sendJson(response, 404, { error: `Unknown country pack: ${countrySlug}` });
      return;
    }

    sendJson(response, 200, CountryPackResponseSchema.parse({ countrySlug, countryPack: pack }));
    return;
  }

  const payload = scope === "full"
    ? { defaultCountrySlug, countryPacks }
    : {
        defaultCountrySlug,
        countryPacks: summarizeCountryPackRegistry(countryPacks)
      };
  sendJson(response, 200, CountryPackRegistryResponseSchema.parse(payload));
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

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  });
  response.end(JSON.stringify(payload));
}
