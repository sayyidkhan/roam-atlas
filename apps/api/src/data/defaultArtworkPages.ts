import {
  buildRoamAtlasImagePrompt,
  inferPageTypeForNode,
  inferZoomLevelForNode
} from "@roamatlas/prompts/imagePromptBuilder.js";
import {
  atlasNodes
} from "./sceneGraph.ts";
import type {
  CompiledCountryPack
} from "./countryPacks/serverRegistry.ts";

type ArtworkNodes =
  CompiledCountryPack["nodes"];
type ArtworkNode = ArtworkNodes[string];
type ArtworkScenes =
  CompiledCountryPack["scenes"];
type ArtworkScene = ArtworkScenes[string];

export type DefaultArtworkPage = {
  countrySlug: string;
  id: string;
  nodeId: string;
  parentClick: null;
  parentId: null;
  plan: {
    factMode: "curated" | "unconfirmed";
    frontendOverlays: Array<{
      anchor: string;
      sourceRequired: false;
      text: string;
      type: "callout";
    }>;
    imagePrompt: string;
    pageType: string;
    title: string;
    visualContext: string;
    zoomLevel: number;
  };
  sceneId: string;
  status: "generation_required";
};

export function getDefaultArtworkPageForScene(
  sceneId: string,
  scenes: ArtworkScenes,
  nodes: ArtworkNodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
): DefaultArtworkPage | null {
  const scene = scenes[sceneId];
  if (!scene) return null;

  const node = nodes[scene.rootNodeId];
  if (!node) return null;

  return createDefaultArtworkPage({
    scene,
    node,
    nodes,
    countrySlug,
    countryName
  });
}

export function getDefaultArtworkPageForNode(
  nodeId: string,
  sceneId: string | null | undefined,
  scenes: ArtworkScenes,
  nodes: ArtworkNodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
): DefaultArtworkPage | null {
  const node = nodes[nodeId];
  if (!node) return null;

  const scene =
    (sceneId ? scenes[sceneId] : undefined) ??
    Object.values(scenes).find(
      (item) =>
        item.rootNodeId === node.id ||
        item.id === node.id
    ) ??
    Object.values(scenes).find((item) =>
      nodes[item.rootNodeId]?.childIds?.includes(
        node.id
      )
    );
  if (!scene) return null;

  return createDefaultArtworkPage({
    scene,
    node,
    nodes,
    countrySlug,
    countryName,
    pageId:
      scene.rootNodeId === node.id
        ? `artwork-${scene.id}`
        : `node-${node.id}`
  });
}

export function getCanonicalArtworkPageForGeneration<
  Page extends {
    nodeId?: string | null;
    sceneId?: string | null;
  }
>(
  page: Page,
  scenes: ArtworkScenes,
  nodes: ArtworkNodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
): Page | DefaultArtworkPage {
  if (!page.nodeId) return page;

  const defaultPage =
    getDefaultArtworkPageForNode(
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
  scenes: ArtworkScenes,
  nodes: ArtworkNodes = atlasNodes,
  countrySlug = "default-country",
  countryName = "selected country"
): DefaultArtworkPage[] {
  return Object.values(scenes)
    .map((scene) => {
      const node = nodes[scene.rootNodeId];
      return node
        ? createDefaultArtworkPage({
            scene,
            node,
            nodes,
            countrySlug,
            countryName
          })
        : null;
    })
    .filter(
      (
        page
      ): page is DefaultArtworkPage =>
        page !== null
    );
}

function createDefaultArtworkPage({
  scene,
  node,
  nodes,
  countrySlug,
  countryName,
  pageId = `artwork-${scene.id}`
}: {
  countryName: string;
  countrySlug: string;
  node: ArtworkNode;
  nodes: ArtworkNodes;
  pageId?: string;
  scene: ArtworkScene;
}): DefaultArtworkPage {
  const pageType = inferPageTypeForNode(node);
  const zoomLevel = inferZoomLevelForNode(node);
  const nodeTitle = node.title ?? node.id;
  const childTitles = (node.childIds ?? [])
    .map((childId) => nodes[childId]?.title)
    .filter(
      (title): title is string =>
        typeof title === "string" &&
        Boolean(title)
    );
  const calloutLabels =
    normalizeArtworkCalloutLabels(
      node.artworkCalloutLabels
    );
  const visualContext =
    resolveArtworkVisualContext({
      scene,
      node,
      nodes
    });

  return {
    id: pageId,
    countrySlug,
    sceneId: scene.id,
    nodeId: node.id,
    parentId: null,
    parentClick: null,
    status: "generation_required",
    plan: {
      title: nodeTitle,
      pageType,
      zoomLevel,
      factMode: hasUnconfirmedNodeFacts(node)
        ? "unconfirmed"
        : "curated",
      visualContext,
      frontendOverlays: calloutLabels.map(
        (text, index) => ({
          type: "callout",
          text,
          anchor: `numbered callout ${index + 1}`,
          sourceRequired: false
        })
      ),
      imagePrompt: buildRoamAtlasImagePrompt({
        nodeId: node.id,
        nodeTitle,
        visualContext,
        pageType,
        zoomLevel,
        density:
          zoomLevel === 0
            ? "minimal"
            : "restrained",
        knownChildNodeTitles: childTitles,
        knownCalloutLabels: calloutLabels,
        countryName,
        aspectRatio: "3:2"
      })
    }
  };
}

function normalizeArtworkCalloutLabels(
  value: unknown
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((label) =>
      String(label ?? "").trim()
    )
    .filter(Boolean)
    .slice(0, 6);
}

function hasUnconfirmedNodeFacts(
  node: ArtworkNode
): boolean {
  const facts = Array.isArray(node.facts)
    ? node.facts
    : [];
  return facts.some(
    (fact) =>
      isRecord(fact) &&
      (fact.confidence === "unconfirmed" ||
        fact.sourceType === "ai_generated")
  );
}

function resolveArtworkVisualContext({
  scene,
  node,
  nodes
}: {
  node: ArtworkNode;
  nodes: ArtworkNodes;
  scene: ArtworkScene;
}): string {
  if (
    typeof node.artworkVisualContext ===
    "string"
  ) {
    return node.artworkVisualContext;
  }

  // A scene description belongs to the scene root. Reusing it for a child node
  // made unrelated landmarks leak into on-demand artwork.
  if (scene.rootNodeId === node.id) {
    if (scene.artworkVisualContext) {
      return scene.artworkVisualContext;
    }
    return scene.visualContext;
  }

  const tags = normalizeStringList(node.tags, 5);
  const childTitles = (node.childIds ?? [])
    .map((childId) => nodes[childId]?.title)
    .filter(
      (title): title is string =>
        typeof title === "string" &&
        Boolean(title)
    )
    .slice(0, 5);
  const visualCues =
    tags.length > 0
      ? ` Visual cues: ${tags.join(", ")}.`
      : "";
  const childCues =
    childTitles.length > 0
      ? ` Leave subtle optional anchors for these curated child subjects: ${childTitles.join(", ")}.`
      : "";
  const nodeTitle = node.title ?? node.id;
  const nodeType =
    typeof node.type === "string"
      ? node.type
      : "travel subject";

  return (
    `A focused ${nodeType} study of ${nodeTitle}.` +
    `${visualCues}${childCues} ` +
    "Keep the composition sparse and do not borrow landmarks from the parent scene."
  );
}

function normalizeStringList(
  value: unknown,
  limit: number
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .slice(0, limit);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
