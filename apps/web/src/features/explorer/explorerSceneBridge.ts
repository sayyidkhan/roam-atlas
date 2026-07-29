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

type Listener = () => void;

let currentSnapshot: ExplorerSceneSnapshot | null = null;
const listeners = new Set<Listener>();

export const explorerSceneBridge = {
  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): ExplorerSceneSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: ExplorerSceneSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
