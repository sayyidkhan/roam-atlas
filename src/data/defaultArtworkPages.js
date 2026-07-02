import { atlasNodes } from "./sceneGraph.js";
import {
  buildWanderImagePrompt,
  inferPageTypeForNode,
  inferZoomLevelForNode
} from "../domain/imagePromptBuilder.js";

const DEFAULT_ARTWORK_SCENES = [
  "singapore",
  "marina-bay-scroll",
  "gardens-by-the-bay",
  "supertree-grove",
  "sentosa-south-scroll",
  "nature-wildlife-scroll",
  "mandai-scroll",
  "singapore-zoo"
];

export function getDefaultArtworkPageForScene(sceneId, scenes, nodes = atlasNodes, countrySlug = "singapore") {
  const scene = scenes[sceneId];
  if (!scene) return null;

  const node = nodes[scene.rootNodeId];
  if (!node) return null;

  return createDefaultArtworkPage({ scene, node, nodes, countrySlug });
}

export function listDefaultArtworkPages(scenes, nodes = atlasNodes, countrySlug = "singapore") {
  return DEFAULT_ARTWORK_SCENES
    .map((nodeId) => {
      const scene = Object.values(scenes).find((item) => item.rootNodeId === nodeId || item.id === nodeId);
      if (!scene) return null;
      const node = nodes[scene.rootNodeId];
      return node ? createDefaultArtworkPage({ scene, node, nodes, countrySlug }) : null;
    })
    .filter(Boolean);
}

function createDefaultArtworkPage({ scene, node, nodes, countrySlug }) {
  const pageType = inferPageTypeForNode(node);
  const zoomLevel = inferZoomLevelForNode(node);
  const childTitles = (node.childIds ?? [])
    .map((childId) => nodes[childId]?.title)
    .filter(Boolean);
  const visualContext = defaultVisualContextForNode(node);

  return {
    id: `artwork-${scene.id}`,
    countrySlug,
    sceneId: scene.id,
    nodeId: node.id,
    parentId: null,
    parentClick: null,
    status: "generation_required",
    plan: {
      title: node.title,
      pageType,
      zoomLevel,
      factMode: hasUnconfirmedNodeFacts(node) ? "unconfirmed" : "curated",
      visualContext,
      imagePrompt: buildWanderImagePrompt({
        nodeId: node.id,
        nodeTitle: node.title,
        visualContext,
        pageType,
        zoomLevel,
        density: zoomLevel === 0 ? "minimal" : "restrained",
        knownChildNodeTitles: childTitles,
        aspectRatio: "16:9"
      })
    }
  };
}

function hasUnconfirmedNodeFacts(node) {
  return node.facts?.some(
    (fact) => fact.confidence === "unconfirmed" || fact.sourceType === "ai_generated"
  );
}

function defaultVisualContextForNode(node) {
  if (node.id === "malaysia") {
    return [
      "A restrained Malaysia starter-map overview page with clear visual icon clusters for Kuala Lumpur, Penang, Langkawi, Johor, Sabah, Sarawak, and Melaka.",
      "Use large calm water shapes, coast and island hints, forest and mountain washes, anonymous city silhouettes, warm paper texture, and clean ink outlines.",
      "Readable image text may include only the supplied candidate region names and generic status wording such as starter map or unconfirmed.",
      "Do not write curated, verified, official, best, must-see, opening hours, prices, route times, source citations, official claims, slogans, or long captions."
    ].join(" ");
  }
  if (node.id === "singapore") {
    return "A restrained Singapore overview page with clear visual icon clusters for west-side NUS, NTU, and Jurong Lake Gardens; Marina Bay and Gardens by the Bay; Chinatown, Kampong Glam, and Little India; Sentosa; east-side Changi Airport, Jewel Changi, and East Coast Park; and north-side Mandai Wildlife Reserve and Singapore Zoo. Use large open water and green space, sparse roads, and short readable curated anchor labels only.";
  }
  if (node.id === "marina-bay-scroll") {
    return "A clean Marina Bay chapter page with Marina Bay Sands, Gardens by the Bay, waterfront paths, water, civic space, bridges, and short labels for major clickable subjects.";
  }
  if (node.id === "gardens-by-the-bay") {
    return "A focused Gardens by the Bay planning illustration with glass conservatories, Supertree Grove, Cloud Forest, Flower Dome, paths, lawns, water, and short callout labels.";
  }
  if (node.id === "supertree-grove") {
    return "A Supertree Grove encyclopedia-style page with several Supertrees, canopy forms, garden paths, an optional elevated walkway, and diagram-like short labels.";
  }
  if (node.id === "sentosa-south-scroll") {
    return "A calm Sentosa and southern waterfront chapter page with beach, resort coast, green ridges, water, paths, and spacious visual clusters.";
  }
  if (node.id === "nature-wildlife-scroll") {
    return "A nature and wildlife chapter page with Mandai wildlife, botanic gardens, parkland, water, forest edges, and clear sparse clickable clusters.";
  }
  if (node.id === "mandai-scroll") {
    return "A Mandai Wildlife Reserve planning illustration with zoo entry, wildlife landscape zones, visitor paths, water, pavilions, shade, and restrained guide labels.";
  }
  if (node.id === "singapore-zoo") {
    return "A Singapore Zoo chapter page with habitat zones, visitor paths, shaded planting, water, pavilions, animals suggested as simple visual forms, and short zone labels.";
  }

  return `${node.title} as a restrained WanderSG flipbook encyclopedia page with clear click targets, sparse layout, and short readable labels.`;
}
