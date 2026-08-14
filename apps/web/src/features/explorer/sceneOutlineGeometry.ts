import type { SceneBounds } from "./explorerSceneStore";

export type SceneOutlinePoint = {
  x: number;
  y: number;
};

export function normalizeSceneOutline(
  value: unknown,
  bounds: SceneBounds
): SceneOutlinePoint[] | undefined {
  if (!Array.isArray(value) || value.length < 3 || value.length > 12) {
    return undefined;
  }
  const points = value.map(toOutlinePoint);
  if (points.some((point) => point === null)) return undefined;
  const outline = points as SceneOutlinePoint[];
  return outline.every((point) => isNearBounds(point, bounds))
    ? outline
    : undefined;
}

export function sceneOutlinePath({
  bounds,
  outline
}: {
  bounds: SceneBounds;
  outline?: SceneOutlinePoint[];
}): string {
  if (outline && outline.length >= 3) {
    return `${outline
      .map((point, index) =>
        `${index === 0 ? "M" : "L"}${point.x} ${point.y}`
      )
      .join(" ")} Z`;
  }

  const corner = Math.min(bounds.width, bounds.height) * 0.1;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return [
    `M${bounds.x + corner} ${bounds.y}`,
    `H${right - corner}`,
    `Q${right} ${bounds.y} ${right} ${bounds.y + corner}`,
    `V${bottom - corner}`,
    `Q${right} ${bottom} ${right - corner} ${bottom}`,
    `H${bounds.x + corner}`,
    `Q${bounds.x} ${bottom} ${bounds.x} ${bottom - corner}`,
    `V${bounds.y + corner}`,
    `Q${bounds.x} ${bounds.y} ${bounds.x + corner} ${bounds.y}`,
    "Z"
  ].join(" ");
}

function toOutlinePoint(value: unknown): SceneOutlinePoint | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<SceneOutlinePoint>;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

function isNearBounds(
  point: SceneOutlinePoint,
  bounds: SceneBounds
): boolean {
  const tolerance = 0.02;
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}
