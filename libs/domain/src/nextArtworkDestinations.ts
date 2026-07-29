import { findSceneIdForNode } from "./routes.ts";

export type ArtworkDestination = {
  key: string;
  nodeId: string;
  sceneId: string;
  title: string;
};

type NavigationNode = {
  childIds: string[];
  title?: string;
};

type NavigationScene = {
  hotspots: NavigationHotspot[];
  id: string;
  pageType?: string;
  rootNodeId: string;
  title?: string;
};

type NavigationHotspot = {
  action?:
    | { sceneId: string; type: "enter_scene" }
    | { nodeId: string; type: "open_node" }
    | { type: "other" };
  label?: string;
  nodeId?: string;
};

export function listNextArtworkDestinations({
  scene,
  scenes,
  nodes,
  currentPage,
  limit = 10
}: {
  currentPage: unknown;
  limit?: number;
  nodes: Readonly<Record<string, unknown>>;
  scene: unknown;
  scenes: Readonly<Record<string, unknown>>;
}): ArtworkDestination[] {
  const currentScene = readNavigationScene(scene);
  const pageNodeId = readPageNodeId(currentPage);
  if (!currentScene || !pageNodeId) return [];

  const targets: ArtworkDestination[] = [];
  const seen = new Set<string>();
  const isSceneRoot = pageNodeId === currentScene.rootNodeId;
  // The country overview can contain deeper visual hotspots (for example,
  // Singapore Zoo inside Nature & Wildlife). The bottom rail is its chapter
  // navigation, so keep it aligned to the country's direct children rather
  // than flattening those deeper shortcuts into peer destinations.
  const overviewChapterIds = new Set(
    currentScene.pageType === "homepage_overview"
      ? readNavigationNode(nodes[currentScene.rootNodeId])
          ?.childIds ?? []
      : []
  );

  if (isSceneRoot) {
    for (const hotspot of currentScene.hotspots) {
      if (!hotspot.nodeId) continue;
      if (overviewChapterIds.size && !overviewChapterIds.has(hotspot.nodeId)) continue;
      if (hotspot.action?.type === "enter_scene") {
        const targetScene = readNavigationScene(
          scenes[hotspot.action.sceneId]
        );
        if (!targetScene) continue;
        pushTarget(targets, seen, {
          key: `scene:${targetScene.id}`,
          sceneId: targetScene.id,
          nodeId: targetScene.rootNodeId,
          title:
            readNavigationNode(
              nodes[targetScene.rootNodeId]
            )?.title ??
            hotspot.label ??
            targetScene.title ??
            targetScene.rootNodeId
        });
        continue;
      }

      if (hotspot.action?.type === "open_node") {
        pushTarget(targets, seen, {
          key: `node:${hotspot.action.nodeId}`,
          sceneId: currentScene.id,
          nodeId: hotspot.action.nodeId,
          title:
            readNavigationNode(
              nodes[hotspot.action.nodeId]
            )?.title ??
            hotspot.label ??
            hotspot.action.nodeId
        });
      }
    }
  } else {
    const pageNode = readNavigationNode(nodes[pageNodeId]);
    for (const childId of pageNode?.childIds ?? []) {
      const child = readNavigationNode(nodes[childId]);
      if (!child) continue;
      pushTarget(targets, seen, {
        key: `node:${childId}`,
        sceneId:
          findSceneIdForNode({
            nodeId: childId,
            nodes,
            scenes
          }) ?? currentScene.id,
        nodeId: childId,
        title: child.title ?? childId
      });
    }
  }

  return targets.slice(0, limit);
}

function pushTarget(
  targets: ArtworkDestination[],
  seen: Set<string>,
  target: ArtworkDestination
): void {
  if (!target.sceneId || seen.has(target.key)) return;
  seen.add(target.key);
  targets.push(target);
}

function readNavigationNode(
  value: unknown
): NavigationNode | null {
  if (!isRecord(value)) return null;
  return {
    childIds: Array.isArray(value.childIds)
      ? value.childIds.filter(
          (childId): childId is string =>
            typeof childId === "string"
        )
      : [],
    title:
      typeof value.title === "string"
        ? value.title
        : undefined
  };
}

function readNavigationScene(
  value: unknown
): NavigationScene | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.rootNodeId !== "string"
  ) {
    return null;
  }
  return {
    hotspots: Array.isArray(value.hotspots)
      ? value.hotspots
          .map(readNavigationHotspot)
          .filter(
            (
              hotspot
            ): hotspot is NavigationHotspot =>
              hotspot !== null
          )
      : [],
    id: value.id,
    pageType:
      typeof value.pageType === "string"
        ? value.pageType
        : undefined,
    rootNodeId: value.rootNodeId,
    title:
      typeof value.title === "string"
        ? value.title
        : undefined
  };
}

function readNavigationHotspot(
  value: unknown
): NavigationHotspot | null {
  if (!isRecord(value)) return null;
  return {
    action: readNavigationAction(value.action),
    label:
      typeof value.label === "string"
        ? value.label
        : undefined,
    nodeId:
      typeof value.nodeId === "string"
        ? value.nodeId
        : undefined
  };
}

function readNavigationAction(
  value: unknown
): NavigationHotspot["action"] {
  if (!isRecord(value) || typeof value.type !== "string") {
    return undefined;
  }
  if (
    value.type === "enter_scene" &&
    typeof value.sceneId === "string"
  ) {
    return {
      sceneId: value.sceneId,
      type: "enter_scene"
    };
  }
  if (
    value.type === "open_node" &&
    typeof value.nodeId === "string"
  ) {
    return {
      nodeId: value.nodeId,
      type: "open_node"
    };
  }
  return { type: "other" };
}

function readPageNodeId(value: unknown): string | null {
  return isRecord(value) &&
    typeof value.nodeId === "string"
    ? value.nodeId
    : null;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
