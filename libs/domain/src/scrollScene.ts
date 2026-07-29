import type {
  FlipbookAction,
  FlipbookHotspot,
  FlipbookPoint,
  FlipbookShape
} from "./flipbookTypes.ts";

export function buildTileCacheKey({
  sceneId,
  tileId,
  styleVersion,
  dataVersion,
  promptVersion,
  imageModel
}: {
  dataVersion: string;
  imageModel: string;
  promptVersion: string;
  sceneId: string;
  styleVersion: string;
  tileId: string;
}): string {
  return `scene:${sceneId}:tile:${tileId}:style:${styleVersion}:data:${dataVersion}:prompt:${promptVersion}:model:${imageModel}`;
}

export function viewportToScenePoint({
  viewportX,
  viewportY,
  camera
}: {
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  viewportX: number;
  viewportY: number;
}): FlipbookPoint {
  return {
    x: camera.x + viewportX / camera.zoom,
    y: camera.y + viewportY / camera.zoom
  };
}

export function findTopmostHotspot(
  hotspots: FlipbookHotspot[],
  point: FlipbookPoint
): FlipbookHotspot | null {
  return hotspots
    .filter((hotspot) => containsPoint(hotspot.shape, point))
    .sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

type HotspotActionInput = {
  action?: FlipbookAction;
  nodeId?: string | null;
};

type HotspotActionResult =
  | {
      kind: "enter_scene";
      sceneId: string;
      selectedNodeId: string | null;
    }
  | {
      kind: "open_node";
      selectedNodeId: string;
    }
  | {
      detourId: string;
      kind: "show_detour";
      selectedNodeId: string | null;
    }
  | {
      kind: "unmapped";
      selectedNodeId: string | null;
    };

export function resolveHotspotAction({
  hotspot,
  scenes,
  currentSelectedNodeId
}: {
  currentSelectedNodeId: string | null;
  hotspot: HotspotActionInput | null | undefined;
  scenes: Record<
    string,
    { rootNodeId: string } | undefined
  >;
}): HotspotActionResult {
  if (!hotspot?.action) {
    return {
      kind: "unmapped",
      selectedNodeId: currentSelectedNodeId
    };
  }

  if (hotspot.action.type === "enter_scene") {
    return {
      kind: "enter_scene",
      sceneId: hotspot.action.sceneId,
      selectedNodeId:
        hotspot.nodeId ?? scenes[hotspot.action.sceneId]?.rootNodeId ?? currentSelectedNodeId
    };
  }

  if (hotspot.action.type === "open_node") {
    return {
      kind: "open_node",
      selectedNodeId: hotspot.action.nodeId
    };
  }

  return {
    kind: "show_detour",
    detourId: hotspot.action.detourId,
    selectedNodeId: currentSelectedNodeId
  };
}

export function containsPoint(
  shape: FlipbookShape,
  point: FlipbookPoint
): boolean {
  if ("points" in shape) {
    return containsPolygonPoint(shape.points, point);
  }

  return (
    point.x >= shape.x &&
    point.x <= shape.x + shape.width &&
    point.y >= shape.y &&
    point.y <= shape.y + shape.height
  );
}

function containsPolygonPoint(
  points: FlipbookPoint[],
  point: FlipbookPoint
): boolean {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function getMissingTiles<
  Tile extends { status: string }
>(scene: { tiles: Tile[] }): Tile[] {
  return scene.tiles.filter((tile) => tile.status !== "ready");
}
