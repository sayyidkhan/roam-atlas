import { resolveImageClick } from "./clickResolver.js";
import { matchClickPhraseToNode } from "./nodeMatcher.js";
import { resolveHotspotAction } from "./scrollScene.js";
import { findTopmostHotspot } from "./scrollScene.js";
import { planNextFlipbookPage } from "./pagePlanner.js";

export function createFlipbookPage({
  id,
  countrySlug = "singapore",
  sceneId,
  nodeId,
  imageUrl,
  parentId = null,
  parentClick = null,
  status = "ready",
  plan = null
}) {
  return {
    id,
    countrySlug,
    sceneId,
    nodeId,
    imageUrl,
    parentId,
    parentClick,
    status,
    plan
  };
}

export function resolveFlipbookClick({
  currentPage,
  normalizedClick,
  targetNodeId = null,
  detourPhrase = null,
  resolvedPhrase = null,
  scenes,
  nodes,
  sceneArtwork
}) {
  const scene = scenes[currentPage.sceneId];
  const point = {
    x: normalizedClick.x * scene.coordinateSpace.width,
    y: normalizedClick.y * scene.coordinateSpace.height
  };
  const click = targetNodeId
    ? resolveTargetNodeClick({
        targetNodeId,
        scene,
        scenes,
        nodes
      })
    : detourPhrase
    ? {
        status: "unmapped",
        nodeId: null,
        phrase: detourPhrase,
        confidence: "unconfirmed",
        reason: "User chose an unverified drill-down prompt.",
        resolver: "overlay"
      }
    : resolvedPhrase
    ? {
        ...matchClickPhraseToNode({
          phrase: resolvedPhrase,
          candidates: createVlmCandidates({
            currentNode: nodes[currentPage.nodeId],
            scene,
            scenes,
            nodes
          }),
          nodes
        }),
        phrase: resolvedPhrase,
        resolver: "vlm"
      }
    : {
        ...resolveLocalPageClick({
          currentNode: nodes[currentPage.nodeId],
          scene,
          point,
          scenes,
          nodes
        }),
        resolver: "local"
      };
  const matchedNode = click.nodeId ? nodes[click.nodeId] : null;
  const plan = planNextFlipbookPage({
    currentNode: nodes[currentPage.nodeId],
    matchedNode,
    clickedPhrase: click.phrase
  });

  if (click.status === "unmapped") {
    return {
      click,
      page: createFlipbookPage({
        id: makePageId({
          parentId: currentPage.id,
          nodeId: null,
          phrase: click.phrase,
          normalizedClick
        }),
        countrySlug: currentPage.countrySlug ?? "singapore",
        sceneId: currentPage.sceneId,
        nodeId: null,
        imageUrl: currentPage.imageUrl,
        parentId: currentPage.id,
        parentClick: normalizedClick,
        status: "generation_required",
        plan
      })
    };
  }

  const actionResult = resolveHotspotAction({
    hotspot: {
      nodeId: click.nodeId,
      action: click.action
    },
    scenes,
    currentSelectedNodeId: currentPage.nodeId
  });
  const nextSceneId =
    actionResult.kind === "enter_scene" ? actionResult.sceneId : currentPage.sceneId;
  const artwork =
    sceneArtwork[plan.nextNodeId] ??
    (actionResult.kind === "enter_scene" ? sceneArtwork[nextSceneId] : null);

  return {
    click,
    page: createFlipbookPage({
      id: makePageId({
        parentId: currentPage.id,
        nodeId: plan.nextNodeId ?? click.nodeId,
        phrase: click.phrase,
        normalizedClick
      }),
      countrySlug: currentPage.countrySlug ?? "singapore",
      sceneId: nextSceneId,
      nodeId: plan.nextNodeId ?? click.nodeId,
      imageUrl: artwork?.imageUrl ?? null,
      parentId: currentPage.id,
      parentClick: normalizedClick,
      status: artwork?.imageUrl ? "ready" : "generation_required",
      plan
    })
  };
}

function resolveTargetNodeClick({ targetNodeId, scene, scenes, nodes }) {
  const node = nodes[targetNodeId];
  if (!node) {
    return {
      status: "unmapped",
      nodeId: null,
      phrase: targetNodeId,
      confidence: "unconfirmed",
      reason: "Requested target node is not in the curated graph.",
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

function resolveLocalPageClick({ currentNode, scene, point, scenes, nodes }) {
  const shouldUseSceneHotspots = !currentNode || scene.rootNodeId === currentNode.id;
  const sceneHotspot = shouldUseSceneHotspots ? findTopmostHotspot(scene.hotspots, point) : null;
  if (sceneHotspot) {
    return resolveImageClick({ scene, point, nodes });
  }

  if (shouldUseSceneHotspots) {
    return {
      status: "unmapped",
      nodeId: null,
      phrase: "unmapped illustrated detail",
      confidence: "unconfirmed",
      reason: "No precomputed WanderSG region contains this click."
    };
  }

  const childCandidates = createFallbackChildRegionCandidates({
    currentNode,
    scene,
    scenes,
    nodes
  });
  const childHotspot = findTopmostHotspot(childCandidates, point);
  if (childHotspot) {
    return {
      status: "matched",
      nodeId: childHotspot.nodeId,
      phrase: childHotspot.label,
      confidence: childHotspot.confidence,
      action: childHotspot.action,
      reason: "Matched through current page precomputed click region."
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

function createFallbackChildRegionCandidates({ currentNode, scene, scenes, nodes }) {
  const childIds = currentNode?.childIds ?? [];
  if (childIds.length === 0) return [];

  const usableWidth = scene.coordinateSpace.width * 0.84;
  const usableHeight = scene.coordinateSpace.height * 0.66;
  const startX = scene.coordinateSpace.width * 0.08;
  const startY = scene.coordinateSpace.height * 0.18;
  const columns = Math.min(3, childIds.length);
  const rows = Math.ceil(childIds.length / columns);
  const cellWidth = usableWidth / columns;
  const cellHeight = usableHeight / rows;

  return childIds
    .map((nodeId, index) => {
      const node = nodes[nodeId];
      if (!node) return null;
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
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
      };
    })
    .filter(Boolean);
}

function makePageId({ parentId, nodeId, phrase, normalizedClick }) {
  if (nodeId) {
    return `node-${slugify(nodeId)}`;
  }

  const x = Math.round(normalizedClick.x * 1000);
  const y = Math.round(normalizedClick.y * 1000);
  return `detour-${slugify(parentId)}-${slugify(phrase ?? "unknown")}-${x}-${y}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function createVlmCandidates({ currentNode, scene, scenes, nodes }) {
  const candidates = [];
  const seen = new Set();

  for (const childId of currentNode?.childIds ?? []) {
    if (!nodes[childId] || seen.has(childId)) continue;
    seen.add(childId);
    candidates.push({
      id: `${currentNode.id}-${childId}`,
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

  for (const hotspot of scene.hotspots) {
    if (seen.has(hotspot.nodeId)) continue;
    seen.add(hotspot.nodeId);
    candidates.push(hotspot);
  }

  return candidates;
}

function actionForNode(nodeId, scenes) {
  const scene = Object.values(scenes).find((item) => item.rootNodeId === nodeId);
  return scene
    ? { type: "enter_scene", sceneId: scene.id }
    : { type: "open_node", nodeId };
}

function nodeConfidence(node) {
  return node.facts?.some((fact) => fact.confidence === "confirmed")
    ? "confirmed"
    : "general";
}
