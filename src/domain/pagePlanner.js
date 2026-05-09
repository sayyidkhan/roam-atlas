import {
  buildWanderImagePrompt,
  inferPageTypeForNode,
  inferZoomLevelForNode
} from "./imagePromptBuilder.js";

export function planNextFlipbookPage({ currentNode, matchedNode, clickedPhrase }) {
  if (!matchedNode) {
    const zoomLevel = Math.min((currentNode?.zoomLevel ?? 0) + 1, 4);
    const pageType = "ai_detour";
    const title = clickedPhrase;
    const visualContext = `An unverified imagined detail inspired by: ${clickedPhrase}.`;
    return {
      nextNodeId: null,
      pageType,
      zoomLevel,
      title,
      visualContext,
      imagePrompt: buildWanderImagePrompt({
        nodeId: "unmapped-detour",
        nodeTitle: title,
        visualContext,
        pageType,
        zoomLevel,
        density: "restrained",
        parentNodeTitle: currentNode?.title
      }),
      factMode: "unverified_detour",
      frontendOverlays: [
        {
          type: "fact",
          text: "This is an AI-imagined detour, not a confirmed WanderSG node.",
          anchor: clickedPhrase
        }
      ],
      clickTargetsToPrecompute: []
    };
  }

  const pageType = inferPageTypeForNode(matchedNode);
  const zoomLevel = inferZoomLevelForNode(matchedNode);
  const visualContext = visualContextForNode(matchedNode);

  return {
    nextNodeId: matchedNode.id,
    pageType,
    zoomLevel,
    title: matchedNode.title,
    visualContext,
    imagePrompt: buildWanderImagePrompt({
      nodeId: matchedNode.id,
      nodeTitle: matchedNode.title,
      visualContext,
      pageType,
      zoomLevel,
      density: zoomLevel === 0 ? "minimal" : "balanced",
      parentNodeTitle: currentNode?.title
    }),
    frontendOverlays: [
      {
        type: "label",
        text: matchedNode.title,
        anchor: clickedPhrase
      }
    ],
    clickTargetsToPrecompute: matchedNode.childIds.map((nodeId) => ({
      targetName: nodeId,
      likelyNodeId: nodeId,
      whyClickable: "Child node in the curated WanderSG scene graph."
    })),
    factMode: "verified"
  };
}

function visualContextForNode(node) {
  if (node.type === "country") {
    return "A calm whole-Singapore overview with multiple sparse region anchors, open water, green corridors, roads, transit, and distinct district entry points.";
  }
  if (node.type === "district") {
    return `${node.title} as a spacious district planning board with roads, water, parks, paths, simplified landmarks, and clear region geometry.`;
  }
  if (node.type === "attraction") {
    return `${node.title} as a focused architectural encyclopedia plate with entrances, paths, landscape, water, transit hints, and simplified context.`;
  }
  if (node.type === "zone") {
    return `${node.title} as a clean zone plate with paths, planted areas, habitat-like spaces, viewing points, and generous spacing.`;
  }
  if (node.type === "animal") {
    return `${node.title} as a restrained natural history plate with habitat context, body silhouette, behavior hints, and blank callout anchors.`;
  }
  if (node.type === "anatomy_plate") {
    return `${node.title} as an encyclopedia cutaway with numbered anchors, fine leader lines, blank caption boxes, and simple structural detail.`;
  }

  return `${node.title} as a restrained illustrated encyclopedia page.`;
}
