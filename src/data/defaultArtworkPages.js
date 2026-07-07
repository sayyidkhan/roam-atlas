import { atlasNodes } from "./sceneGraph.js";
import {
  buildRoamAtlasImagePrompt,
  inferPageTypeForNode,
  inferZoomLevelForNode
} from "../domain/imagePromptBuilder.js";

export function getDefaultArtworkPageForScene(
  sceneId,
  scenes,
  nodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
) {
  const scene = scenes[sceneId];
  if (!scene) return null;

  const node = nodes[scene.rootNodeId];
  if (!node) return null;

  return createDefaultArtworkPage({ scene, node, nodes, countrySlug, countryName });
}

export function getDefaultArtworkPageForNode(
  nodeId,
  sceneId,
  scenes,
  nodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
) {
  const node = nodes[nodeId];
  if (!node) return null;

  const scene =
    scenes[sceneId] ??
    Object.values(scenes).find((item) => item.rootNodeId === node.id || item.id === node.id) ??
    Object.values(scenes).find((item) => nodes[item.rootNodeId]?.childIds?.includes(node.id));
  if (!scene) return null;

  return createDefaultArtworkPage({
    scene,
    node,
    nodes,
    countrySlug,
    countryName,
    pageId: scene.rootNodeId === node.id ? `artwork-${scene.id}` : `node-${node.id}`
  });
}

export function getCanonicalArtworkPageForGeneration(
  page,
  scenes,
  nodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
) {
  if (!page?.nodeId) return page;

  const defaultPage = getDefaultArtworkPageForNode(
    page.nodeId,
    page.sceneId,
    scenes,
    nodes,
    countrySlug,
    countryName
  );
  return defaultPage ?? page;
}

export function listDefaultArtworkPages(
  scenes,
  nodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
) {
  return Object.values(scenes)
    .map((scene) => {
      const node = nodes[scene.rootNodeId];
      return node ? createDefaultArtworkPage({ scene, node, nodes, countrySlug, countryName }) : null;
    })
    .filter(Boolean);
}

function createDefaultArtworkPage({ scene, node, nodes, countrySlug, countryName, pageId = `artwork-${scene.id}` }) {
  const pageType = inferPageTypeForNode(node);
  const zoomLevel = inferZoomLevelForNode(node);
  const childTitles = (node.childIds ?? [])
    .map((childId) => nodes[childId]?.title)
    .filter(Boolean);
  const visualContext = resolveArtworkVisualContext({ scene, node });

  return {
    id: pageId,
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
      imagePrompt: buildRoamAtlasImagePrompt({
        nodeId: node.id,
        nodeTitle: node.title,
        visualContext,
        pageType,
        zoomLevel,
        density: zoomLevel === 0 ? "minimal" : "restrained",
        knownChildNodeTitles: childTitles,
        countryName,
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

function resolveArtworkVisualContext({ scene, node }) {
  if (node.artworkVisualContext) return node.artworkVisualContext;
  if (scene.artworkVisualContext) return scene.artworkVisualContext;
  if (scene.visualContext) return scene.visualContext;
  return `${node.title} as a restrained travel flipbook encyclopedia page with clear click targets, sparse layout, and short readable labels.`;
}
