import { createStore } from "zustand/vanilla";

export type SceneBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type ExplorerSceneSnapshot = {
  commands: {
    openTarget: (target: ExplorerSceneTarget) => void;
  };
  displayImage: {
    isPreview: boolean;
    url: string;
  } | null;
  environmentPlan: unknown;
  hasFinalArtwork: boolean;
  isArtworkPending: boolean;
  pageTitle: string;
  scene: {
    ambientLayers?: unknown[];
    coordinateSpace: {
      height: number;
      width: number;
    };
    id: string;
    title: string;
  };
  showImageOverlays: boolean;
  targets: ExplorerSceneTarget[];
  tiles: Array<{
    bounds: SceneBounds;
    column: number;
    id: string;
    imageUrl: string | null;
  }>;
};

export type ExplorerSceneTarget = {
  ariaLabel: string;
  bounds: SceneBounds;
  isActive: boolean;
  mode: "label" | "visual";
  nodeId: string;
  normalizedClick: {
    x: number;
    y: number;
  };
};

type ExplorerSceneStoreState = {
  clear: () => void;
  setSnapshot: (snapshot: ExplorerSceneSnapshot) => void;
  snapshot: ExplorerSceneSnapshot | null;
};

export const explorerSceneStore =
  createStore<ExplorerSceneStoreState>((set) => ({
    snapshot: null,
    clear: () => set({ snapshot: null }),
    setSnapshot: (snapshot) => set({ snapshot })
  }));
