import {
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_SCHEMA_VERSION
} from "@roamatlas/prompts/buildEnvironmentPlanPrompt.js";

export function createEnvironmentPlanServerPolicy({
  getCountryPackForPage,
  getRuntimeCountrySlugForPage
}) {
  function getPromptContext(page) {
    const pack = getCountryPackForPage(page);
    const title =
      page.plan?.title ??
      page.title ??
      page.nodeId ??
      page.sceneId ??
      "current atlas page";
    const pageType = page.plan?.pageType ?? page.pageType ?? "atlas_page";
    const currentNode =
      pack.nodes?.[page.nodeId] ??
      pack.nodes?.[pack.scenes?.[page.sceneId]?.rootNodeId];
    const scene = pack.scenes?.[page.sceneId];
    const mapNumberByNodeId = new Map(
      (scene?.hotspots ?? [])
        .filter((hotspot) => hotspot?.nodeId)
        .map((hotspot) => [hotspot.nodeId, hotspot.mapNumber ?? null])
    );
    const targetCandidates = (currentNode?.childIds ?? [])
      .map((nodeId) => pack.nodes?.[nodeId])
      .filter(Boolean)
      .map((node) => ({
        nodeId: node.id,
        title: node.title,
        mapNumber: mapNumberByNodeId.get(node.id) ?? null
      }));
    return { countryName: pack.title, title, pageType, targetCandidates };
  }

  function hasExpectedTargets(page, plan) {
    const candidateCount = getPromptContext(page).targetCandidates.length;
    return (
      candidateCount === 0 ||
      (Array.isArray(plan?.targets) && plan.targets.length > 0)
    );
  }

  function normalizePlan(rawPlan, page, { source, model }) {
    const targetCandidates = getPromptContext(page).targetCandidates;
    const allowedTargets = new Map(
      targetCandidates.map((candidate) => [candidate.nodeId, candidate])
    );
    const targets = Array.isArray(rawPlan?.targets)
      ? rawPlan.targets
          .map((target, index) =>
            normalizeTarget(target, index, allowedTargets)
          )
          .filter(Boolean)
          .slice(0, targetCandidates.length)
      : [];
    const layers = Array.isArray(rawPlan?.layers)
      ? rawPlan.layers
          .map((layer, index) => normalizeLayer(layer, index))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    return createEnvelope(page, {
      source,
      model,
      status: layers.length || targets.length ? "ready" : "fallback",
      targets,
      layers,
      warnings: normalizeWarnings(rawPlan?.warnings)
    });
  }

  function createFallback(page, warning) {
    return createEnvelope(page, {
      source: "fallback",
      model: null,
      status: "fallback",
      targets: [],
      layers: [{
        id: "safe-light-wash",
        kind: "light",
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        coordinateSpace: "normalized",
        intensity: "subtle",
        safePlacement: "open_light",
        avoid: ["labels", "callouts", "leader lines"],
        reason: "Conservative fallback avoids placing water or wildlife without image understanding."
      }],
      warnings: warning ? [warning] : []
    });
  }

  function createEnvelope(
    page,
    { source, model, status, targets = [], layers, warnings }
  ) {
    return {
      version: ENVIRONMENT_PLAN_SCHEMA_VERSION,
      source,
      model,
      status,
      pageId: page.id,
      countrySlug: getRuntimeCountrySlugForPage(page),
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      imageUrl: page.imageUrl,
      promptVersion: ENVIRONMENT_PLAN_PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      factBoundary: "Environment overlays are decorative code-rendered ambience only and are not fact sources.",
      targets,
      layers,
      warnings
    };
  }

  return {
    getPromptContext,
    hasExpectedTargets,
    normalizePlan,
    createFallback
  };
}

function normalizeTarget(target, index, allowedTargets) {
  const nodeId = String(target?.nodeId ?? "").trim();
  const candidate = allowedTargets.get(nodeId);
  const expectedMapNumber =
    candidate?.mapNumber == null
      ? null
      : String(candidate.mapNumber).trim() || null;
  const visualBounds = normalizeTargetBounds(target?.visualBounds, {
    maxWidth: 0.48,
    maxHeight: 0.52
  });
  const labelBounds = normalizeTargetBounds(target?.labelBounds, {
    maxWidth: 0.24,
    maxHeight: 0.12
  });
  if (!candidate || !visualBounds || !labelBounds || target?.confidence === "low") {
    return null;
  }
  return {
    id: `target-${slugify(nodeId || index + 1)}`,
    nodeId,
    mapNumber: expectedMapNumber,
    visualBounds,
    labelBounds,
    coordinateSpace: "normalized",
    confidence: ["high", "medium", "low"].includes(target?.confidence)
      ? target.confidence
      : "low",
    reason: String(target?.reason ?? "").slice(0, 180)
  };
}

function normalizeLayer(layer, index) {
  const kind = normalizeLayerKind(layer?.kind);
  const safePlacement = normalizeSafePlacement(layer?.safePlacement);
  const bounds = normalizeBounds(layer?.bounds);
  if (!kind || !safePlacement || !bounds) return null;
  if (["water", "marine_life"].includes(kind) && safePlacement !== "open_water") {
    return null;
  }
  if (kind === "foliage" && safePlacement !== "foliage") return null;
  if (kind === "cloud" && !["sky", "open_air"].includes(safePlacement)) {
    return null;
  }
  if (
    kind === "birds" &&
    !["sky", "open_air", "open_water"].includes(safePlacement)
  ) {
    return null;
  }
  return {
    id: slugify(layer?.id || `${kind}-${index + 1}`),
    kind,
    bounds,
    coordinateSpace: "normalized",
    intensity: layer?.intensity === "medium" ? "medium" : "subtle",
    safePlacement,
    avoid: normalizeAvoidList(layer?.avoid),
    reason: String(layer?.reason ?? "").slice(0, 180)
  };
}

function normalizeLayerKind(kind) {
  const value = normalizeEnumValue(kind);
  return ["cloud", "water", "foliage", "light", "marine_life", "birds"].includes(value)
    ? value
    : null;
}

function normalizeSafePlacement(value) {
  const normalized = normalizeEnumValue(value);
  return ["sky", "open_air", "open_water", "foliage", "open_light"].includes(normalized)
    ? normalized
    : null;
}

function normalizeEnumValue(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const x = clamp01(Number(bounds.x));
  const y = clamp01(Number(bounds.y));
  const width = Math.min(clamp(Number(bounds.width), 0.04, 1), 1 - x);
  const height = Math.min(clamp(Number(bounds.height), 0.04, 1), 1 - y);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    width < 0.04 ||
    height < 0.04
  ) {
    return null;
  }
  return { x, y, width, height };
}

function normalizeTargetBounds(bounds, { maxWidth, maxHeight }) {
  const normalized = normalizeBounds(bounds);
  if (!normalized) return null;
  const width = Math.min(normalized.width, maxWidth);
  const height = Math.min(normalized.height, maxHeight);
  const centerX = normalized.x + normalized.width / 2;
  const centerY = normalized.y + normalized.height / 2;
  return {
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height
  };
}

function normalizeAvoidList(value) {
  const fallback = [
    "land",
    "islands",
    "buildings",
    "labels",
    "callouts",
    "leader lines"
  ];
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").slice(0, 180))
    .filter(Boolean)
    .slice(0, 4);
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
