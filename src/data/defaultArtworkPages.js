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
  const calloutLabels = normalizeArtworkCalloutLabels(node.artworkCalloutLabels);
  const visualContext = resolveArtworkVisualContext({ scene, node, nodes });

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
      frontendOverlays: calloutLabels.map((text, index) => ({
        type: "callout",
        text,
        anchor: `numbered callout ${index + 1}`,
        sourceRequired: false
      })),
      imagePrompt: buildRoamAtlasImagePrompt({
        nodeId: node.id,
        nodeTitle: node.title,
        visualContext,
        pageType,
        zoomLevel,
        density: zoomLevel === 0 ? "minimal" : "restrained",
        knownChildNodeTitles: childTitles,
        knownCalloutLabels: calloutLabels,
        countryName,
        aspectRatio: "3:2"
      })
    }
  };
}

function normalizeArtworkCalloutLabels(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((label) => String(label ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function hasUnconfirmedNodeFacts(node) {
  return node.facts?.some(
    (fact) => fact.confidence === "unconfirmed" || fact.sourceType === "ai_generated"
  );
}

function resolveArtworkVisualContext({ scene, node, nodes }) {
  if (node.artworkVisualContext) return node.artworkVisualContext;

  // A scene description belongs to the scene root. Reusing it for a child node
  // made unrelated landmarks leak into on-demand artwork (for example, a
  // Marina Bay Sands page could inherit the Gardens by the Bay conservatories).
  if (scene.rootNodeId === node.id) {
    if (scene.artworkVisualContext) return scene.artworkVisualContext;
    if (scene.visualContext) return scene.visualContext;
  }

  const tags = (node.tags ?? []).slice(0, 5);
  const childTitles = (node.childIds ?? [])
    .map((childId) => nodes[childId]?.title)
    .filter(Boolean)
    .slice(0, 5);
  const visualCues = tags.length > 0 ? ` Visual cues: ${tags.join(", ")}.` : "";
  const childCues =
    childTitles.length > 0
      ? ` Leave subtle optional anchors for these curated child subjects: ${childTitles.join(", ")}.`
      : "";

  return `A focused ${node.type ?? "travel subject"} study of ${node.title}.${visualCues}${childCues} Keep the composition sparse and do not borrow landmarks from the parent scene.`;
}
