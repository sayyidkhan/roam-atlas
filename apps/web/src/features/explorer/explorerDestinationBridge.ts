export type DestinationPhase =
  | "failed"
  | "idle"
  | "loading"
  | "queued"
  | "ready"
  | "starting";

export type ExplorerDestinationItem = {
  key: string;
  label: string;
  mapNumber: string;
  nodeId: string;
  normalizedClick: {
    x: number;
    y: number;
  };
  phase: DestinationPhase;
  readinessLabel: string;
  statusText: string;
};

export type ExplorerLoadingBoard = {
  artworkJobKey: string;
  detail: string;
  headline: string;
  isBusy: boolean;
  isFailed: boolean;
  isUnmappedStarterCountry: boolean;
  items: ExplorerDestinationItem[];
  pageTitle: string;
  readyCount: number;
  totalCount: number;
};

export type ExplorerDestinationSnapshot = {
  board: ExplorerLoadingBoard | null;
  commands: {
    openCountrySetup: () => void;
    openDestination: (item: ExplorerDestinationItem) => void;
    retryArtwork: (artworkJobKey: string) => void;
  };
  rail: {
    items: ExplorerDestinationItem[];
    readiness: string;
  } | null;
};

type Listener = () => void;

let currentSnapshot: ExplorerDestinationSnapshot | null = null;
const listeners = new Set<Listener>();

export const explorerDestinationBridge = {
  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): ExplorerDestinationSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: ExplorerDestinationSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
