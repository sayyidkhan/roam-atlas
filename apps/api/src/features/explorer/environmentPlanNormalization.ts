import type {
  BoundsInput,
  RawEnvironmentLayer,
  RawEnvironmentTarget,
  TargetCandidate
} from "./environmentPlanServerTypes.ts";

type NormalizedBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function normalizeEnvironmentTarget(
  target: RawEnvironmentTarget,
  index: number,
  allowedTargets: Map<string, TargetCandidate>
) {
  const nodeId = String(target?.nodeId ?? "").trim();
  const candidate = allowedTargets.get(nodeId);
  const expectedMapNumber =
    candidate?.mapNumber == null
      ? null
      : String(candidate.mapNumber).trim() || null;
  const visualBounds = normalizeTargetBounds(
    target?.visualBounds,
    {
      maxWidth: 0.48,
      maxHeight: 0.52
    }
  );
  const labelBounds = normalizeTargetBounds(
    target?.labelBounds,
    {
      maxWidth: 0.24,
      maxHeight: 0.12
    }
  );
  if (
    !candidate ||
    !visualBounds ||
    !labelBounds ||
    target?.confidence === "low"
  ) {
    return null;
  }
  return {
    id: `target-${slugify(nodeId || index + 1)}`,
    nodeId,
    mapNumber: expectedMapNumber,
    visualBounds,
    labelBounds,
    coordinateSpace: "normalized",
    confidence: ["high", "medium", "low"].includes(
      String(target?.confidence)
    )
      ? String(target.confidence)
      : "low",
    reason: String(target?.reason ?? "").slice(0, 180)
  };
}

export function normalizeEnvironmentLayer(
  layer: RawEnvironmentLayer,
  index: number
) {
  const kind = normalizeLayerKind(layer?.kind);
  const safePlacement = normalizeSafePlacement(
    layer?.safePlacement
  );
  const bounds = normalizeBounds(layer?.bounds);
  if (!kind || !safePlacement || !bounds) return null;
  if (
    ["water", "marine_life"].includes(kind) &&
    safePlacement !== "open_water"
  ) {
    return null;
  }
  if (
    kind === "foliage" &&
    safePlacement !== "foliage"
  ) {
    return null;
  }
  if (
    kind === "cloud" &&
    !["sky", "open_air"].includes(safePlacement)
  ) {
    return null;
  }
  if (
    kind === "birds" &&
    !["sky", "open_air", "open_water"].includes(
      safePlacement
    )
  ) {
    return null;
  }
  return {
    id: slugify(layer?.id || `${kind}-${index + 1}`),
    kind,
    bounds,
    coordinateSpace: "normalized",
    intensity:
      layer?.intensity === "medium" ? "medium" : "subtle",
    safePlacement,
    avoid: normalizeAvoidList(layer?.avoid),
    reason: String(layer?.reason ?? "").slice(0, 180)
  };
}

export function normalizeEnvironmentWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").slice(0, 180))
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeLayerKind(kind: unknown): string | null {
  const value = normalizeEnumValue(kind);
  return [
    "cloud",
    "water",
    "foliage",
    "light",
    "marine_life",
    "birds"
  ].includes(value)
    ? value
    : null;
}

function normalizeSafePlacement(
  value: unknown
): string | null {
  const normalized = normalizeEnumValue(value);
  return [
    "sky",
    "open_air",
    "open_water",
    "foliage",
    "open_light"
  ].includes(normalized)
    ? normalized
    : null;
}

function normalizeEnumValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function normalizeBounds(
  bounds: BoundsInput | null | undefined
): NormalizedBounds | null {
  if (!bounds || typeof bounds !== "object") return null;
  const x = clamp01(Number(bounds.x));
  const y = clamp01(Number(bounds.y));
  const width = Math.min(
    clamp(Number(bounds.width), 0.04, 1),
    1 - x
  );
  const height = Math.min(
    clamp(Number(bounds.height), 0.04, 1),
    1 - y
  );
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

function normalizeTargetBounds(
  bounds: BoundsInput | null | undefined,
  {
    maxWidth,
    maxHeight
  }: { maxHeight: number; maxWidth: number }
): NormalizedBounds | null {
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

function normalizeAvoidList(value: unknown): string[] {
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
    .map((item) =>
      String(item ?? "").trim().toLowerCase()
    )
    .filter(Boolean)
    .slice(0, 8);
}

function slugify(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(maximum, Math.max(minimum, value));
}
