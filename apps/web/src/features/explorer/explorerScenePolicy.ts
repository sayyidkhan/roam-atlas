import type {
  ExplorerSceneSnapshot,
  ExplorerSceneTarget,
  SceneBounds
} from "./explorerSceneStore";

export type SceneInput = {
  ambientLayers?: unknown[];
  coordinateSpace: {
    height: number;
    width: number;
  };
  id: string;
  tiles: Array<{
    bounds: SceneBounds;
    cacheKey: string;
    column: number;
    id: string;
  }>;
  title: string;
};

type EnvironmentTarget = {
  labelBounds?: SceneBounds;
  nodeId?: string;
  visualBounds?: SceneBounds;
};

type GeneratedTile = {
  imageUrl?: string | null;
  tileId: string;
};

export function buildSceneTargets({
  environmentPlan,
  nodes,
  selectedNodeId
}: {
  environmentPlan:
    | { targets?: EnvironmentTarget[] }
    | null
    | undefined;
  nodes: Record<string, { title: string }>;
  selectedNodeId: string | null;
}): ExplorerSceneTarget[] {
  const targets = Array.isArray(environmentPlan?.targets)
    ? environmentPlan.targets
    : [];
  return targets.flatMap((target) => {
    if (
      !target.nodeId ||
      !nodes[target.nodeId] ||
      !target.visualBounds ||
      !target.labelBounds
    ) {
      return [];
    }
    const nodeTitle = nodes[target.nodeId].title;
    return [
      buildSceneTarget({
        bounds: target.visualBounds,
        isActive: target.nodeId === selectedNodeId,
        mode: "visual",
        nodeId: target.nodeId,
        nodeTitle
      }),
      buildSceneTarget({
        bounds: target.labelBounds,
        isActive: target.nodeId === selectedNodeId,
        mode: "label",
        nodeId: target.nodeId,
        nodeTitle
      })
    ];
  });
}

export function buildSceneTiles(
  scene: SceneInput,
  generatedTiles: Record<string, GeneratedTile>
): ExplorerSceneSnapshot["tiles"] {
  return scene.tiles.map((tile) => ({
    bounds: tile.bounds,
    column: tile.column,
    id: tile.id,
    imageUrl:
      generatedTiles[tile.cacheKey]?.imageUrl ??
      Object.values(generatedTiles).find(
        (item) => item.tileId === tile.id
      )?.imageUrl ??
      null
  }));
}

export function toScenePercent(
  value: number,
  total: number
): string {
  return `${(value / total) * 100}%`;
}

function buildSceneTarget({
  bounds,
  isActive,
  mode,
  nodeId,
  nodeTitle
}: {
  bounds: SceneBounds;
  isActive: boolean;
  mode: "label" | "visual";
  nodeId: string;
  nodeTitle: string;
}): ExplorerSceneTarget {
  return {
    ariaLabel:
      mode === "visual"
        ? `Explore the ${nodeTitle} area`
        : `Explore ${nodeTitle}`,
    bounds,
    isActive,
    mode,
    nodeId,
    normalizedClick: {
      x: clamp01(bounds.x + bounds.width / 2),
      y: clamp01(bounds.y + bounds.height / 2)
    }
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
