import { ArtworkRequestQuerySchema, ArtworkResponseSchema } from "./artworkContract.js";
import { jsonResponse } from "../../platform/http/fetchResponses.js";
import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";

export function createArtworkRoutes(dependencies) {
  return (app) => {
    registerHonoRoute(app, "GET", "/api/artwork", (context) =>
      handleArtworkHttpRequest({
        ...dependencies,
        url: new URL(context.req.url)
      })
    );
  };
}

/**
 * Feature-owned HTTP boundary for requesting page artwork. The injected
 * dependencies keep Node transport and runtime-cache implementation outside
 * the artwork feature while preserving a validated public API contract.
 */
export async function handleArtworkHttpRequest({
  url,
  defaultCountrySlug,
  getCountryPack,
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  createImageJob,
  normalizeImageQuality
}) {
  const query = ArtworkRequestQuerySchema.parse({
    countrySlug: url.searchParams.get("countrySlug") ?? undefined,
    sceneId: url.searchParams.get("sceneId") ?? undefined,
    nodeId: url.searchParams.get("nodeId") ?? undefined,
    quality: url.searchParams.get("quality") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    prefetch: url.searchParams.get("prefetch") ?? undefined
  });
  const sceneId = query.sceneId;
  const nodeId = query.nodeId;
  const countrySlug = query.countrySlug ?? defaultCountrySlug;
  const pack = getCountryPack(countrySlug);
  if (!pack) {
    return jsonResponse(
      { error: `Unknown country pack: ${countrySlug}` },
      404
    );
  }

  const page = nodeId
    ? getDefaultArtworkPageForNode(nodeId, sceneId, pack.scenes, pack.nodes, pack.countrySlug, pack.title)
    : getDefaultArtworkPageForScene(sceneId, pack.scenes, pack.nodes, pack.countrySlug, pack.title);
  if (!page) {
    return jsonResponse({
      error: nodeId
        ? `Unknown artwork node: ${nodeId}`
        : `Unknown artwork scene: ${sceneId}`
    }, 404);
  }

  const isPrefetch = query.prefetch === "true" || query.prefetch === "priority";
  const isInteractivePriority = query.priority === "interactive";
  const jobKind = isInteractivePriority
    ? "interactive"
    : isPrefetch
    ? query.prefetch === "priority"
      ? "prefetch"
      : "artwork"
    : nodeId
    ? "interactive"
    : "artwork";
  const artworkPage = await createImageJob(page, {
    jobKind,
    imageQuality: normalizeImageQuality(query.quality)
  });
  return jsonResponse(
    ArtworkResponseSchema.parse({ page: artworkPage })
  );
}
