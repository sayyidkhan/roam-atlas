import { resolveImageClick } from "./clickResolver.ts";
import { findTopmostHotspot } from "./scrollScene.ts";
import type {
  FlipbookAction,
  FlipbookClick,
  FlipbookHotspot,
  FlipbookNode,
  FlipbookPoint,
  FlipbookScene
} from "./flipbookTypes.ts";

type FlipbookGraph = {
  nodes: Record<string, FlipbookNode>;
  scenes: Record<string, FlipbookScene>;
};

export function resolveTargetNodeClick({
  targetNodeId,
  scenes,
  nodes
}: FlipbookGraph & {
  targetNodeId: string;
}): FlipbookClick {
  const node = nodes[targetNodeId];
  if (!node) {
    return {
      status: "unmapped",
      nodeId: null,
      phrase: targetNodeId,
      confidence: "unconfirmed",
      reason:
        "Requested target node is not in the curated graph.",
      resolver: "overlay"
    };
  }

  return {
    status: "matched",
    nodeId: targetNodeId,
    phrase: node.title,
    confidence: nodeConfidence(node),
    action: actionForNode(targetNodeId, scenes),
    reason: "Matched through frontend overlay click target.",
    resolver: "overlay"
  };
}

export function resolveLocalPageClick({
  currentNode,
  scene,
  point,
  scenes,
  nodes
}: FlipbookGraph & {
  currentNode?: FlipbookNode;
  point: FlipbookPoint;
  scene: FlipbookScene;
}): FlipbookClick {
  const shouldUseSceneHotspots =
    !currentNode || scene.rootNodeId === currentNode.id;
  const sceneHotspot = shouldUseSceneHotspots
    ? findTopmostHotspot(scene.hotspots ?? [], point)
    : null;
  if (sceneHotspot) {
    return resolveImageClick({
      scene: { ...scene, hotspots: scene.hotspots ?? [] },
      point,
      nodes
    });
  }

  if (shouldUseSceneHotspots) {
    return {
      status: "unmapped",
      nodeId: null,
      phrase: "unmapped illustrated detail",
      confidence: "unconfirmed",
      reason:
        "No precomputed RoamAtlas region contains this click."
    };
  }

  const childCandidates =
    createFallbackChildRegionCandidates({
      currentNode,
      scene,
      scenes,
      nodes
    });
  const childHotspot = findTopmostHotspot(
    childCandidates,
    point
  );
  if (childHotspot?.nodeId && childHotspot.label) {
    return {
      status: "matched",
      nodeId: childHotspot.nodeId,
      phrase: childHotspot.label,
      confidence: childHotspot.confidence,
      action: childHotspot.action,
      reason:
        "Matched through current page precomputed click region."
    };
  }

  return {
    status: "unmapped",
    nodeId: null,
    phrase: "unmapped illustrated detail",
    confidence: "unconfirmed",
    reason: "No current-page child region contains this click."
  };
}

export function createVlmCandidates({
  currentNode,
  scene,
  scenes,
  nodes
}: FlipbookGraph & {
  currentNode?: FlipbookNode;
  scene: FlipbookScene;
}): FlipbookHotspot[] {
  const candidates: FlipbookHotspot[] = [];
  const seen = new Set<string>();
  const currentNodeId =
    currentNode?.id ?? scene.rootNodeId;

  for (const childId of currentNode?.childIds ?? []) {
    if (!nodes[childId] || seen.has(childId)) continue;
    seen.add(childId);
    candidates.push({
      id: `${currentNodeId}-${childId}`,
      sceneId: scene.id,
      nodeId: childId,
      kind: "poi",
      shape: { x: 0, y: 0, width: 0, height: 0 },
      zIndex: 100,
      label: nodes[childId].title,
      confidence: nodeConfidence(nodes[childId]),
      action: actionForNode(childId, scenes)
    });
  }

  for (const hotspot of scene.hotspots ?? []) {
    if (hotspot.nodeId && seen.has(hotspot.nodeId)) continue;
    if (hotspot.nodeId) seen.add(hotspot.nodeId);
    candidates.push(hotspot);
  }

  return candidates;
}

function createFallbackChildRegionCandidates({
  currentNode,
  scene,
  scenes,
  nodes
}: FlipbookGraph & {
  currentNode?: FlipbookNode;
  scene: FlipbookScene;
}): FlipbookHotspot[] {
  const childIds = currentNode?.childIds ?? [];
  if (!currentNode || childIds.length === 0) return [];

  const usableWidth = scene.coordinateSpace.width * 0.84;
  const usableHeight =
    scene.coordinateSpace.height * 0.66;
  const startX = scene.coordinateSpace.width * 0.08;
  const startY = scene.coordinateSpace.height * 0.18;
  const columns = Math.min(3, childIds.length);
  const rows = Math.ceil(childIds.length / columns);
  const cellWidth = usableWidth / columns;
  const cellHeight = usableHeight / rows;
  const candidates: FlipbookHotspot[] = [];

  childIds.forEach((nodeId, index) => {
    const node = nodes[nodeId];
    if (!node) return;
    const column = index % columns;
    const row = Math.floor(index / columns);
    candidates.push({
      id: `${currentNode.id}-precomputed-${nodeId}`,
      sceneId: scene.id,
      nodeId,
      kind: "poi",
      shape: {
        x: startX + column * cellWidth,
        y: startY + row * cellHeight,
        width: cellWidth,
        height: cellHeight
      },
      zIndex: 90,
      label: node.title,
      confidence: nodeConfidence(node),
      action: actionForNode(nodeId, scenes)
    });
  });

  return candidates;
}

function actionForNode(
  nodeId: string,
  scenes: Record<string, FlipbookScene>
): FlipbookAction {
  const scene = Object.values(scenes).find(
    (item) => item.rootNodeId === nodeId
  );
  return scene
    ? { type: "enter_scene", sceneId: scene.id }
    : { type: "open_node", nodeId };
}

function nodeConfidence(node: FlipbookNode): string {
  return node.facts?.some(
    (fact) => fact.confidence === "confirmed"
  )
    ? "confirmed"
    : "general";
}
