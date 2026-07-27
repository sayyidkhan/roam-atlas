export function buildTileCacheKey({
  sceneId,
  tileId,
  styleVersion,
  dataVersion,
  promptVersion,
  imageModel
}) {
  return `scene:${sceneId}:tile:${tileId}:style:${styleVersion}:data:${dataVersion}:prompt:${promptVersion}:model:${imageModel}`;
}

export function viewportToScenePoint({ viewportX, viewportY, camera }) {
  return {
    x: camera.x + viewportX / camera.zoom,
    y: camera.y + viewportY / camera.zoom
  };
}

export function findTopmostHotspot(hotspots, point) {
  return hotspots
    .filter((hotspot) => containsPoint(hotspot.shape, point))
    .sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

export function resolveHotspotAction({ hotspot, scenes, currentSelectedNodeId }) {
  if (!hotspot) {
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

export function containsPoint(shape, point) {
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

function containsPolygonPoint(points, point) {
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

export function getMissingTiles(scene) {
  return scene.tiles.filter((tile) => tile.status !== "ready");
}
