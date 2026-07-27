import { findSceneIdForNode } from "./routes.js";

export function listNextArtworkDestinations({
  scene,
  scenes,
  nodes,
  currentPage,
  limit = 10
}) {
  if (!scene || !currentPage) return [];

  const targets = [];
  const seen = new Set();
  const pageNodeId = currentPage.nodeId;
  const isSceneRoot = pageNodeId === scene.rootNodeId;
  // The country overview can contain deeper visual hotspots (for example,
  // Singapore Zoo inside Nature & Wildlife). The bottom rail is its chapter
  // navigation, so keep it aligned to the country's direct children rather
  // than flattening those deeper shortcuts into peer destinations.
  const overviewChapterIds = new Set(
    scene.pageType === "homepage_overview"
      ? nodes[scene.rootNodeId]?.childIds ?? []
      : []
  );

  if (isSceneRoot) {
    for (const hotspot of scene.hotspots ?? []) {
      if (!hotspot.nodeId) continue;
      if (overviewChapterIds.size && !overviewChapterIds.has(hotspot.nodeId)) continue;
      if (hotspot.action?.type === "enter_scene") {
        const targetScene = scenes[hotspot.action.sceneId];
        if (!targetScene) continue;
        pushTarget(targets, seen, {
          key: `scene:${targetScene.id}`,
          sceneId: targetScene.id,
          nodeId: targetScene.rootNodeId,
          title: nodes[targetScene.rootNodeId]?.title ?? hotspot.label ?? targetScene.title
        });
        continue;
      }

      if (hotspot.action?.type === "open_node") {
        pushTarget(targets, seen, {
          key: `node:${hotspot.action.nodeId}`,
          sceneId: scene.id,
          nodeId: hotspot.action.nodeId,
          title: nodes[hotspot.action.nodeId]?.title ?? hotspot.label
        });
      }
    }
  } else if (pageNodeId && nodes[pageNodeId]) {
    for (const childId of nodes[pageNodeId].childIds ?? []) {
      const child = nodes[childId];
      if (!child) continue;
      pushTarget(targets, seen, {
        key: `node:${childId}`,
        sceneId: findSceneIdForNode({ nodeId: childId, nodes, scenes }) ?? scene.id,
        nodeId: childId,
        title: child.title
      });
    }
  }

  return targets.slice(0, limit);
}

function pushTarget(targets, seen, target) {
  if (!target.sceneId || seen.has(target.key)) return;
  seen.add(target.key);
  targets.push(target);
}
