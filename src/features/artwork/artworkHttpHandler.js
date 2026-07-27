import { ArtworkRequestQuerySchema, ArtworkResponseSchema } from "./artworkContract.js";

/**
 * Feature-owned HTTP boundary for requesting page artwork. The injected
 * dependencies keep Node transport and runtime-cache implementation outside
 * the artwork feature while preserving a validated public API contract.
 */
export async function handleArtworkHttpRequest({
  url,
  response,
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
    sendJson(response, 404, { error: `Unknown country pack: ${countrySlug}` });
    return;
  }

  const page = nodeId
    ? getDefaultArtworkPageForNode(nodeId, sceneId, pack.scenes, pack.nodes, pack.countrySlug, pack.title)
    : getDefaultArtworkPageForScene(sceneId, pack.scenes, pack.nodes, pack.countrySlug, pack.title);
  if (!page) {
    sendJson(response, 404, {
      error: nodeId ? `Unknown artwork node: ${nodeId}` : `Unknown artwork scene: ${sceneId}`
    });
    return;
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
  sendJson(response, 200, ArtworkResponseSchema.parse({ page: artworkPage }));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
