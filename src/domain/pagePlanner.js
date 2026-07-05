import {
  buildRoamAtlasImagePrompt,
  inferPageTypeForNode,
  inferZoomLevelForNode
} from "./imagePromptBuilder.js";

export function planNextFlipbookPage({ currentNode, matchedNode, clickedPhrase, countryName = "selected country" }) {
  if (!matchedNode) {
    const currentZoomLevel = inferZoomLevelForNode(currentNode);
    const shouldUseDetailPlate =
      currentZoomLevel >= 2 || isFineGrainedDetourPhrase(clickedPhrase);
    const zoomLevel = shouldUseDetailPlate
      ? Math.max(3, Math.min(currentZoomLevel + 1, 4))
      : Math.min(currentZoomLevel + 1, 4);
    const pageType = "ai_detour";
    const title = clickedPhrase;
    const visualContext = shouldUseDetailPlate
      ? `A focused unverified encyclopedia plate studying one clicked subject: ${clickedPhrase}. Show the subject as the main object with diagrammatic structure, optional cutaway or exploded-view details, blank callout anchors, and only minimal environmental context.`
      : `An unverified imagined detail inspired by: ${clickedPhrase}.`;
    return {
      nextNodeId: null,
      pageType,
      zoomLevel,
      title,
      visualContext,
      imagePrompt: buildRoamAtlasImagePrompt({
        nodeId: "unmapped-detour",
        nodeTitle: title,
        visualContext,
        pageType,
        zoomLevel,
        density: "restrained",
        parentNodeTitle: currentNode?.title,
        countryName
      }),
      factMode: "unverified_detour",
      frontendOverlays: [
        {
          type: "fact",
          text: "This is an AI-imagined detour, not a confirmed RoamAtlas node.",
          anchor: clickedPhrase
        }
      ],
      clickTargetsToPrecompute: []
    };
  }

  const pageType = inferPageTypeForNode(matchedNode);
  const zoomLevel = inferZoomLevelForNode(matchedNode);
  const visualContext = visualContextForNode(matchedNode);
  const isUnconfirmedNode = hasUnconfirmedNodeFacts(matchedNode);

  return {
    nextNodeId: matchedNode.id,
    pageType,
    zoomLevel,
    title: matchedNode.title,
    visualContext,
    imagePrompt: buildRoamAtlasImagePrompt({
      nodeId: matchedNode.id,
      nodeTitle: matchedNode.title,
      visualContext,
      pageType,
      zoomLevel,
      density: isUnconfirmedNode || zoomLevel === 0 ? "minimal" : "balanced",
      parentNodeTitle: currentNode?.title,
      countryName
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
      whyClickable: "Child node in the mapped RoamAtlas scene graph."
    })),
    factMode: isUnconfirmedNode ? "unconfirmed" : "verified"
  };
}

function visualContextForNode(node) {
  if (hasUnconfirmedNodeFacts(node)) {
    return [
      `${node.title} as an unconfirmed starter-map page.`,
      "Show a generic atlas composition with terrain, water, paths, trees, transit hints, and anonymous city or landscape forms.",
      `Use the supplied page title "${node.title}" only.`,
      "Do not invent named attractions, street names, walk names, districts, official signs, opening hours, prices, routes, citations, rankings, or factual captions.",
      "If labels are needed, use only generic labels such as city core, waterfront, green space, old town texture, island area, forest, hills, coast, or transit hint."
    ].join(" ");
  }

  if (node.type === "country") {
    return `A calm whole-country overview for ${node.title} with multiple sparse region anchors, open water, green corridors, roads, transit hints, and distinct district entry points.`;
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

function hasUnconfirmedNodeFacts(node) {
  return node.facts?.some(
    (fact) => fact.confidence === "unconfirmed" || fact.sourceType === "ai_generated"
  );
}

function isFineGrainedDetourPhrase(phrase) {
  const normalized = String(phrase ?? "").toLowerCase();
  return FINE_GRAINED_DETOUR_TERMS.some((term) => normalized.includes(term));
}

const FINE_GRAINED_DETOUR_TERMS = [
  "boat",
  "ferry",
  "ship",
  "vessel",
  "statue",
  "building",
  "hotel",
  "facade",
  "roof",
  "tower",
  "bridge",
  "skytrain",
  "train",
  "terminal",
  "pavilion",
  "canopy",
  "structure",
  "spout",
  "vehicle",
  "airplane",
  "plane",
  "bus",
  "tram"
];
