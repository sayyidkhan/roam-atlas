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

export function getDefaultArtworkPageForScene(sceneId, scenes) {
  const scene = scenes[sceneId];
  if (!scene) return null;

  const node = atlasNodes[scene.rootNodeId];
  if (!node) return null;

  return createDefaultArtworkPage({ scene, node });
}

export function listDefaultArtworkPages(scenes) {
  return DEFAULT_ARTWORK_SCENES
    .map((nodeId) => {
      const scene = Object.values(scenes).find((item) => item.rootNodeId === nodeId || item.id === nodeId);
      if (!scene) return null;
      const node = atlasNodes[scene.rootNodeId];
      return node ? createDefaultArtworkPage({ scene, node }) : null;
    })
    .filter(Boolean);
}

function createDefaultArtworkPage({ scene, node }) {
  const pageType = inferPageTypeForNode(node);
  const zoomLevel = inferZoomLevelForNode(node);
  const childTitles = (node.childIds ?? [])
    .map((childId) => atlasNodes[childId]?.title)
    .filter(Boolean);
  const visualContext = defaultVisualContextForNode(node);

  return {
    id: `artwork-${scene.id}`,
    sceneId: scene.id,
    nodeId: node.id,
    parentId: null,
    parentClick: null,
    status: "generation_required",
    plan: {
      title: node.title,
      pageType,
      zoomLevel,
      factMode: "curated",
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

function defaultVisualContextForNode(node) {
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
