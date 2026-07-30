import { createStore } from "zustand/vanilla";

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

type ExplorerDestinationStoreState = {
  clear: () => void;
  setSnapshot: (snapshot: ExplorerDestinationSnapshot) => void;
  snapshot: ExplorerDestinationSnapshot | null;
};

export const explorerDestinationStore =
  createStore<ExplorerDestinationStoreState>((set) => ({
    snapshot: null,
    clear: () => set({ snapshot: null }),
    setSnapshot: (snapshot) => set({ snapshot })
  }));
