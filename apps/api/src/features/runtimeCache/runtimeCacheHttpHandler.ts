import {
  RuntimeCacheFlushRequestSchema,
  RuntimeCacheFlushResponseSchema
} from "@roamatlas/contracts/runtimeCacheContract.js";

import { jsonResponse } from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import { readJsonRequest } from "../../platform/http/readJsonRequest.ts";
import type {
  RuntimeCacheFlushResult
} from "./runtimeCacheService.ts";

type RuntimeCacheCountry = {
  name: string;
  slug: string;
};

type RuntimeCacheHttpDependencies = {
  flushRuntimeCache: (
    countrySlug: string
  ) => Promise<RuntimeCacheFlushResult>;
  flushVisualCache: (
    countrySlug: string
  ) => Promise<RuntimeCacheFlushResult>;
  getCountryBySlug: (
    countrySlug: string
  ) => RuntimeCacheCountry | null | undefined;
};

type RuntimeCacheHttpRequestDependencies =
  RuntimeCacheHttpDependencies & {
    request: Request;
  };

export function createRuntimeCacheRoutes(
  dependencies: RuntimeCacheHttpDependencies
): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(
      app,
      "POST",
      "/api/runtime-cache/flush",
      (context) =>
        handleRuntimeCacheFlushHttpRequest({
          ...dependencies,
          request: context.req.raw
        })
    );
  };
}

/**
 * Transport boundary for country-scoped runtime artifact cleanup. The runtime
 * supplies the two destructive operations; this feature limits callers to a
 * known country and either the visual-only or full-cache scope.
 */
export async function handleRuntimeCacheFlushHttpRequest({
  request,
  getCountryBySlug,
  flushVisualCache,
  flushRuntimeCache
}: RuntimeCacheHttpRequestDependencies): Promise<Response> {
  const parsed = RuntimeCacheFlushRequestSchema.safeParse(
    await readJsonRequest(request)
  );
  if (!parsed.success) {
    return jsonResponse(
      {
        error:
          "A country slug is required and scope must be visuals or all."
      },
      400
    );
  }
  const countrySlug = parsed.data.countrySlug.toLowerCase();
  const scope = parsed.data.scope ?? "all";
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    return jsonResponse(
      { error: `Unknown country: ${countrySlug}` },
      404
    );
  }

  const result =
    scope === "visuals"
      ? await flushVisualCache(country.slug)
      : await flushRuntimeCache(country.slug);
  return jsonResponse(
    RuntimeCacheFlushResponseSchema.parse({
      countrySlug: country.slug,
      countryName: country.name,
      scope,
      ...result
    })
  );
}
