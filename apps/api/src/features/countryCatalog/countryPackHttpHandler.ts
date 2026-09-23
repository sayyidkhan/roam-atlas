import {
  CountryPackRegistryResponseSchema,
  CountryPackResponseSchema
} from "@roamatlas/contracts/countryPackContract.js";
import type {
  CompiledCountryPack
} from "../../data/countryPacks/serverRegistry.ts";
import { jsonResponse } from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";

type CountryPackHttpDependencies = {
  countryPacks: Record<string, CompiledCountryPack>;
  defaultCountrySlug: string;
  resolveConfirmedExplorerPack?: (
    countrySlug: string
  ) => Promise<CompiledCountryPack | null>;
};

export function createCountryPackRoutes(
  dependencies: CountryPackHttpDependencies
): HonoRouteRegistrar {
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
 * Serves country-pack data. Source-controlled packs stay on the curated
 * registry. A starter map confirmed for curation is compiled into a
 * runtime draft explorer without promoting its facts to confirmed.
 */
export async function handleCountryPackHttpRequest({
  url,
  countryPacks,
  defaultCountrySlug,
  resolveConfirmedExplorerPack
}: CountryPackHttpDependencies & {
  url: URL;
}): Promise<Response> {
  const countrySlug = String(url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const scope = url.searchParams.get("scope") ?? (countrySlug ? "full" : "summary");

  if (countrySlug) {
    const registered = countryPacks[countrySlug];
    if (!registered) {
      return jsonResponse(
        { error: `Unknown country pack: ${countrySlug}` },
        404
      );
    }
    const pack = await resolveServedCountryPack(
      registered,
      resolveConfirmedExplorerPack
    );

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
        countryPacks: await summarizeCountryPackRegistry(
          countryPacks,
          resolveConfirmedExplorerPack
        )
      };
  return jsonResponse(
    CountryPackRegistryResponseSchema.parse(payload),
    200,
    { "Cache-Control": "no-cache" }
  );
}

async function resolveServedCountryPack(
  registered: CompiledCountryPack,
  resolveConfirmedExplorerPack: CountryPackHttpDependencies["resolveConfirmedExplorerPack"]
): Promise<CompiledCountryPack> {
  if (
    registered.registration === "source_controlled" ||
    !resolveConfirmedExplorerPack
  ) {
    return registered;
  }
  return await resolveConfirmedExplorerPack(registered.countrySlug) ?? registered;
}

async function summarizeCountryPackRegistry(
  packs: Record<string, CompiledCountryPack>,
  resolveConfirmedExplorerPack: CountryPackHttpDependencies["resolveConfirmedExplorerPack"]
) {
  const entries = await Promise.all(
    Object.entries(packs).map(async ([countrySlug, pack]) => {
      if (
        pack.registration === "source_controlled" ||
        !resolveConfirmedExplorerPack
      ) {
        return [countrySlug, summarizeCountryPack(pack)] as const;
      }
      const confirmed = await resolveConfirmedExplorerPack(countrySlug);
      return [countrySlug, summarizeCountryPack(confirmed ?? pack)] as const;
    })
  );
  return Object.fromEntries(entries);
}

function summarizeCountryPack(pack: CompiledCountryPack) {
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
