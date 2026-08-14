import { explorerSceneStore } from "./explorerSceneStore";
import {
  buildSceneTargets,
  buildSceneTiles,
  type SceneInput
} from "./explorerScenePolicy";
import type { SceneOutlinePoint } from "./sceneOutlineGeometry";

type GeneratedTile = {
  imageUrl?: string | null;
  tileId: string;
};

export type ExplorerSceneInput = {
  displayImageUrl: string | null;
  environmentPlan: {
    targets?: Array<{
      labelBounds?: {
        height: number;
        width: number;
        x: number;
        y: number;
      };
      nodeId?: string;
      visualBounds?: {
        height: number;
        width: number;
        x: number;
        y: number;
      };
      visualOutline?: SceneOutlinePoint[];
    }>;
  } | null;
  hasFinalArtwork: boolean;
  isArtworkPending: boolean;
  isPreview: boolean;
  nodes: Record<string, { title: string }>;
  pageTitle: string;
  scene: SceneInput;
  selectedNodeId: string | null;
};

type ExplorerSceneControllerDependencies = {
  generatedTiles: Record<string, GeneratedTile>;
  resolveOverlayTarget: (target: {
    nodeId: string;
    normalizedClick: {
      x: number;
      y: number;
    };
  }) => void | Promise<void>;
};

export function createExplorerSceneController({
  generatedTiles,
  resolveOverlayTarget
}: ExplorerSceneControllerDependencies) {
  function publish(input: ExplorerSceneInput): void {
    explorerSceneStore.getState().setSnapshot({
      commands: {
        openTarget: (target) => {
          void resolveOverlayTarget({
            nodeId: target.nodeId,
            normalizedClick: target.normalizedClick
          });
        }
      },
      displayImage: input.displayImageUrl
        ? {
            isPreview: input.isPreview,
            url: input.displayImageUrl
          }
        : null,
      environmentPlan: input.environmentPlan,
      hasFinalArtwork: input.hasFinalArtwork,
      isArtworkPending: input.isArtworkPending,
      pageTitle: input.pageTitle,
      scene: input.scene,
      showImageOverlays: input.hasFinalArtwork,
      targets: buildSceneTargets({
        environmentPlan: input.environmentPlan,
        nodes: input.nodes,
        selectedNodeId: input.selectedNodeId
      }),
      tiles: buildSceneTiles(
        input.scene,
        generatedTiles
      )
    });
  }

  return { publish };
}
