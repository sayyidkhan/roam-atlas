export type EnvironmentKind =
  | "birds"
  | "cloud"
  | "crowd"
  | "foliage"
  | "light"
  | "marine_life"
  | "traffic"
  | "water";

export type EnvironmentBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type EnvironmentLayer = {
  bounds?: EnvironmentBounds;
  coordinateSpace?: "normalized" | string;
  id?: string;
  intensity?: "medium" | "subtle" | string;
  kind?: string;
  safePlacement?: string;
};

export type EnvironmentLayerSelection = {
  layers: EnvironmentLayer[];
  source: string;
};

export type EnvironmentScene = {
  ambientLayers?: EnvironmentLayer[];
  coordinateSpace: {
    height: number;
    width: number;
  };
};

const ENVIRONMENT_KINDS = new Set<EnvironmentKind>([
  "birds",
  "cloud",
  "crowd",
  "foliage",
  "light",
  "marine_life",
  "traffic",
  "water"
]);

export function selectEnvironmentLayers(
  sceneValue: unknown,
  planValue: unknown
): EnvironmentLayerSelection {
  const scene = readEnvironmentScene(sceneValue);
  const plan = readEnvironmentPlan(planValue);
  const plannedLayers = plan.layers.filter(
    isRenderableEnvironmentLayer
  );
  return {
    layers: plannedLayers.length
      ? plannedLayers
      : (scene.ambientLayers ?? []).filter(
          isSafeFallbackEnvironmentLayer
        ),
    source: plannedLayers.length
      ? plan.source
      : "scene-fallback"
  };
}

export function readEnvironmentScene(
  value: unknown
): EnvironmentScene {
  const candidate =
    value && typeof value === "object"
      ? (value as {
          ambientLayers?: unknown;
          coordinateSpace?: unknown;
        })
      : {};
  const coordinateSpace =
    candidate.coordinateSpace &&
    typeof candidate.coordinateSpace === "object"
      ? (candidate.coordinateSpace as {
          height?: unknown;
          width?: unknown;
        })
      : {};
  return {
    ambientLayers: readEnvironmentLayers(
      candidate.ambientLayers
    ),
    coordinateSpace: {
      height: finiteNumber(coordinateSpace.height, 1),
      width: finiteNumber(coordinateSpace.width, 1)
    }
  };
}

export function normalizeEnvironmentKind(
  kind: unknown
): EnvironmentKind {
  const normalized = String(kind ?? "light")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_") as EnvironmentKind;
  return ENVIRONMENT_KINDS.has(normalized)
    ? normalized
    : "light";
}

export function getAtmosphereProfile(
  layers: EnvironmentLayer[]
): "air" | "coastal" | "coastal-park" | "garden" {
  const kinds = new Set(
    layers.map((layer) =>
      normalizeEnvironmentKind(layer.kind)
    )
  );
  if (kinds.has("water") && kinds.has("foliage")) {
    return "coastal-park";
  }
  if (kinds.has("water")) return "coastal";
  if (kinds.has("foliage")) return "garden";
  return "air";
}

export function getNormalizedEnvironmentBounds(
  layer: EnvironmentLayer
): EnvironmentBounds {
  const bounds = layer.bounds;
  return bounds && isNormalizedBounds(bounds)
    ? bounds
    : { x: 0, y: 0, width: 1, height: 1 };
}

export function getRenderedEnvironmentBounds(
  layer: EnvironmentLayer,
  scene: EnvironmentScene
): EnvironmentBounds {
  const bounds = layer.bounds ?? {
    x: 0,
    y: 0,
    width: scene.coordinateSpace.width,
    height: scene.coordinateSpace.height
  };
  const isNormalized =
    layer.coordinateSpace === "normalized" ||
    isNormalizedBounds(bounds);
  return {
    x: isNormalized
      ? bounds.x
      : bounds.x / scene.coordinateSpace.width,
    y: isNormalized
      ? bounds.y
      : bounds.y / scene.coordinateSpace.height,
    width: isNormalized
      ? bounds.width
      : bounds.width / scene.coordinateSpace.width,
    height: isNormalized
      ? bounds.height
      : bounds.height / scene.coordinateSpace.height
  };
}

export function expandNormalizedBounds(
  bounds: EnvironmentBounds,
  amount: EnvironmentBounds
): EnvironmentBounds {
  const x = clamp01(bounds.x - amount.x);
  const y = clamp01(bounds.y - amount.y);
  const x2 = clamp01(
    bounds.x + bounds.width + amount.width
  );
  const y2 = clamp01(
    bounds.y + bounds.height + amount.height
  );
  return {
    x,
    y,
    width: Math.max(0.04, x2 - x),
    height: Math.max(0.04, y2 - y)
  };
}

export function mergeNormalizedBounds(
  boundsList: EnvironmentBounds[]
): EnvironmentBounds {
  if (!boundsList.length) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const x1 = Math.min(
    ...boundsList.map((bounds) => bounds.x)
  );
  const y1 = Math.min(
    ...boundsList.map((bounds) => bounds.y)
  );
  const x2 = Math.max(
    ...boundsList.map(
      (bounds) => bounds.x + bounds.width
    )
  );
  const y2 = Math.max(
    ...boundsList.map(
      (bounds) => bounds.y + bounds.height
    )
  );
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1
  };
}

export function getEnvironmentParticleCount(
  kind: EnvironmentKind,
  intensity: "medium" | "subtle"
): number {
  const countByKind: Record<EnvironmentKind, number> = {
    birds: intensity === "medium" ? 6 : 4,
    cloud: intensity === "medium" ? 6 : 4,
    crowd: intensity === "medium" ? 5 : 3,
    foliage: intensity === "medium" ? 8 : 5,
    light: 1,
    marine_life: intensity === "medium" ? 4 : 3,
    traffic: intensity === "medium" ? 5 : 3,
    water: intensity === "medium" ? 8 : 6
  };
  return countByKind[kind];
}

export function environmentParticleDuration(
  kind: EnvironmentKind,
  index: number,
  intensity: "medium" | "subtle"
): number {
  const mediumOffset = intensity === "medium" ? -0.7 : 0;
  const baseByKind: Record<EnvironmentKind, number> = {
    birds: 4.8,
    cloud: 11,
    crowd: 4.8,
    foliage: 5.4,
    light: 16,
    marine_life: 4.2,
    traffic: 4.8,
    water: 4.6
  };
  return Math.max(
    3.2,
    baseByKind[kind] +
      mediumOffset +
      (index % 3) * 0.55
  );
}

export function seededPercent(
  seed: unknown,
  index: number,
  salt: number
): number {
  const text = String(seed ?? "ambient");
  let value = salt + index * 31;
  for (let position = 0; position < text.length; position += 1) {
    value =
      (value +
        text.charCodeAt(position) * (position + 3)) %
      100;
  }
  return Math.max(5, Math.min(95, value));
}

export function isRenderableEnvironmentLayer(
  layer: EnvironmentLayer
): boolean {
  if (
    normalizeEnvironmentKind(layer.kind) !==
    "marine_life"
  ) {
    return true;
  }
  const bounds = layer.bounds;
  return Boolean(
    bounds &&
      bounds.width >= 0.07 &&
      bounds.height >= 0.05 &&
      bounds.y <= 0.86
  );
}

function readEnvironmentPlan(value: unknown): {
  layers: EnvironmentLayer[];
  source: string;
} {
  const candidate =
    value && typeof value === "object"
      ? (value as {
          layers?: unknown;
          source?: unknown;
        })
      : {};
  return {
    layers: readEnvironmentLayers(candidate.layers),
    source:
      typeof candidate.source === "string"
        ? candidate.source
        : "image-plan"
  };
}

function readEnvironmentLayers(
  value: unknown
): EnvironmentLayer[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (layer): layer is EnvironmentLayer =>
      Boolean(layer && typeof layer === "object")
  );
}

function isSafeFallbackEnvironmentLayer(
  layer: EnvironmentLayer
): boolean {
  return ["light", "cloud"].includes(
    normalizeEnvironmentKind(layer.kind)
  );
}

function isNormalizedBounds(
  bounds: EnvironmentBounds | undefined
): boolean {
  return Boolean(
    bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.width <= 1 &&
      bounds.height <= 1
  );
}

function finiteNumber(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
