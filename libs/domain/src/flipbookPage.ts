import {
  createVlmCandidates,
  resolveLocalPageClick,
  resolveTargetNodeClick
} from "./flipbookClickPolicy.ts";
import { matchClickPhraseToNode } from "./nodeMatcher.ts";
import { resolveHotspotAction } from "./scrollScene.ts";
import { planNextFlipbookPage } from "./pagePlanner.ts";
import type {
  CreateFlipbookPageInput,
  FlipbookClick,
  FlipbookNode,
  FlipbookPage,
  FlipbookPlan,
  FlipbookPoint,
  FlipbookResult,
  ResolveFlipbookClickInput
} from "./flipbookTypes.ts";

export type {
  FlipbookAction,
  FlipbookClick,
  FlipbookHotspot,
  FlipbookNode,
  FlipbookPage,
  FlipbookPlan,
  FlipbookPoint,
  FlipbookResult,
  FlipbookScene,
  FlipbookShape,
  ResolveFlipbookClickInput
} from "./flipbookTypes.ts";

export function createFlipbookPage({
  id,
  countrySlug = "default-country",
  countryName = "selected country",
  sceneId,
  nodeId,
  imageUrl = null,
  parentId = null,
  parentClick = null,
  status = "ready",
  plan = null
}: CreateFlipbookPageInput): FlipbookPage {
  return {
    id,
    countrySlug,
    countryName,
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
  sceneArtwork,
  countryName = currentPage.countryName ?? "selected country"
}: ResolveFlipbookClickInput): FlipbookResult {
  const scene = currentPage.sceneId
    ? scenes[currentPage.sceneId]
    : undefined;
  const currentNode = currentPage.nodeId
    ? nodes[currentPage.nodeId]
    : undefined;
  if (!scene) {
    return createUnavailableSceneResult({
      countryName,
      currentNode,
      currentPage,
      normalizedClick
    });
  }

  const point = {
    x: normalizedClick.x * scene.coordinateSpace.width,
    y: normalizedClick.y * scene.coordinateSpace.height
  };
  const click: FlipbookClick = targetNodeId
    ? resolveTargetNodeClick({
        targetNodeId,
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
            currentNode,
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
          currentNode,
          scene,
          point,
          scenes,
          nodes
        }),
        resolver: "local"
      };
  const matchedNode = click.nodeId ? nodes[click.nodeId] : null;
  const plan: FlipbookPlan = planNextFlipbookPage({
    currentNode,
    matchedNode,
    clickedPhrase: click.phrase,
    countryName
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
        countrySlug: currentPage.countrySlug ?? "default-country",
        countryName,
        sceneId: currentPage.sceneId,
        nodeId: null,
        imageUrl: currentPage.imageUrl ?? null,
        parentId: currentPage.id ?? null,
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
    (plan.nextNodeId ? sceneArtwork[plan.nextNodeId] : null) ??
    (actionResult.kind === "enter_scene" && nextSceneId
      ? sceneArtwork[nextSceneId]
      : null);

  return {
    click,
    page: createFlipbookPage({
      id: makePageId({
        parentId: currentPage.id,
        nodeId: plan.nextNodeId ?? click.nodeId,
        phrase: click.phrase,
        normalizedClick
      }),
      countrySlug: currentPage.countrySlug ?? "default-country",
      countryName,
      sceneId: nextSceneId,
      nodeId: plan.nextNodeId ?? click.nodeId,
      imageUrl: artwork?.imageUrl ?? null,
      parentId: currentPage.id ?? null,
      parentClick: normalizedClick,
      status: artwork?.imageUrl ? "ready" : "generation_required",
      plan
    })
  };
}

function makePageId({
  parentId,
  nodeId,
  phrase,
  normalizedClick
}: {
  parentId?: string | null;
  nodeId?: string | null;
  phrase?: string | null;
  normalizedClick: FlipbookPoint;
}): string {
  if (nodeId) {
    return `node-${slugify(nodeId)}`;
  }

  const x = Math.round(normalizedClick.x * 1000);
  const y = Math.round(normalizedClick.y * 1000);
  return `detour-${slugify(parentId)}-${slugify(phrase ?? "unknown")}-${x}-${y}`;
}

function slugify(value: unknown): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function createUnavailableSceneResult({
  countryName,
  currentNode,
  currentPage,
  normalizedClick
}: {
  countryName: string;
  currentNode?: FlipbookNode;
  currentPage: ResolveFlipbookClickInput["currentPage"];
  normalizedClick: FlipbookPoint;
}): FlipbookResult {
  const click: FlipbookClick = {
    status: "unmapped",
    nodeId: null,
    phrase: "unmapped illustrated detail",
    confidence: "unconfirmed",
    reason: "The current RoamAtlas scene is unavailable.",
    resolver: "local"
  };
  const plan: FlipbookPlan = planNextFlipbookPage({
    currentNode,
    matchedNode: null,
    clickedPhrase: click.phrase,
    countryName
  });

  return {
    click,
    page: createFlipbookPage({
      id: makePageId({
        parentId: currentPage.id,
        nodeId: null,
        phrase: click.phrase,
        normalizedClick
      }),
      countrySlug:
        currentPage.countrySlug ?? "default-country",
      countryName,
      sceneId: currentPage.sceneId,
      nodeId: null,
      imageUrl: currentPage.imageUrl ?? null,
      parentId: currentPage.id ?? null,
      parentClick: normalizedClick,
      status: "generation_required",
      plan
    })
  };
}
