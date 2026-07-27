export function selectSemanticRegionForPoint(regions, point) {
  return regions
    .filter((item) => pointInBox(point, item.bbox))
    .sort((a, b) => compareSemanticRegionHit(a, b, point))[0] ?? null;
}

export function appendSemanticRegion(
  understanding,
  { normalizedClick, result, vlm, pack }
) {
  const phrase = result.click?.phrase ?? vlm.phrase;
  if (!phrase || result.click?.resolver === "vlm_guard") return understanding;

  const matchedNodeId = result.click?.nodeId ?? null;
  const id = matchedNodeId
    ? `node-${matchedNodeId}`
    : `phrase-${slugify(phrase)}`;
  const existing = understanding.regions.find(
    (region) =>
      region.id === id ||
      (matchedNodeId && region.matchedNodeId === matchedNodeId)
  );
  const nextRegion = {
    id,
    phrase,
    label: matchedNodeId ? pack.nodes[matchedNodeId]?.title ?? phrase : phrase,
    matchedNodeId,
    status: matchedNodeId ? "matched" : "unmapped_detour",
    bbox: boxAroundPoint(normalizedClick, matchedNodeId ? 0.22 : 0.12),
    cacheClick: normalizedClick,
    confidence: result.click?.confidence ?? "general",
    confidenceScore: matchedNodeId ? 80 : 45,
    source: vlm.status === "resolved" ? "click_vlm" : "local_confirmed_click",
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    existing.bbox = matchedNodeId
      ? mergeBoxes(existing.bbox, nextRegion.bbox)
      : nextRegion.bbox;
    existing.phrase = existing.phrase || nextRegion.phrase;
    existing.cacheClick = nextRegion.cacheClick ?? existing.cacheClick;
    existing.updatedAt = nextRegion.updatedAt;
    existing.confidenceScore = Math.max(
      existing.confidenceScore ?? 0,
      nextRegion.confidenceScore
    );
  } else {
    understanding.regions.push(nextRegion);
  }
  return understanding;
}

export function createBaseUnderstanding(page, { countrySlug, assetVersion }) {
  const timestamp = new Date().toISOString();
  return {
    version: "semantic-regions-v1",
    pageId: page.id,
    countrySlug,
    sceneId: page.sceneId,
    nodeId: page.nodeId,
    imageUrl: page.imageUrl,
    assetVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
    regions: []
  };
}

export function createUnresolvedClickResult({
  currentPage,
  normalizedClick,
  vlm
}) {
  return {
    click: {
      status: "unmapped",
      nodeId: null,
      phrase: vlm.phrase ?? "unresolved illustrated detail",
      confidence: "unconfirmed",
      reason: "Runtime image click was not resolved with enough VLM confidence; refusing fallback hotspot navigation.",
      resolver: "vlm_guard"
    },
    page: {
      ...currentPage,
      parentClick: normalizedClick,
      status: "ready",
      plan: {
        title: "Click unresolved",
        factMode: "unverified_detour",
        imagePrompt: null
      }
    }
  };
}

export function centerOfBox(box) {
  if (!box) return null;
  return {
    x: clamp01(box.x + box.width / 2),
    y: clamp01(box.y + box.height / 2)
  };
}

function compareSemanticRegionHit(a, b, point) {
  const distanceDifference =
    semanticRegionClickDistance(a, point) -
    semanticRegionClickDistance(b, point);
  if (Math.abs(distanceDifference) > 0.0004) return distanceDifference;
  return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
}

function semanticRegionClickDistance(region, point) {
  const anchor = region.cacheClick ?? centerOfBox(region.bbox);
  if (!anchor || !point) return Number.POSITIVE_INFINITY;
  return (anchor.x - point.x) ** 2 + (anchor.y - point.y) ** 2;
}

function pointInBox(point, box) {
  if (!point || !box) return false;
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function boxAroundPoint(point, size) {
  const half = size / 2;
  const x = clamp01(point.x - half);
  const y = clamp01(point.y - half);
  return {
    x,
    y,
    width: Math.min(size, 1 - x),
    height: Math.min(size, 1 - y)
  };
}

function mergeBoxes(a, b) {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: x1,
    y: y1,
    width: Math.min(1 - x1, x2 - x1),
    height: Math.min(1 - y1, y2 - y1)
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "unknown"
  );
}
