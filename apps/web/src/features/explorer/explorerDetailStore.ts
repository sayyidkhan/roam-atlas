import { createStore } from "zustand/vanilla";

export type ExplorerFact = {
  confidence?: string;
  sourceUrl?: string;
  text?: string;
};

export type ExplorerDetailNode = {
  facts?: ExplorerFact[];
  title?: string;
  type?: string;
  [key: string]: unknown;
};

export type ExplorerDetailOverride = {
  confidence?: string;
  message?: string;
  title?: string;
};

export type ExplorerDetailMode =
  | "compact"
  | "expanded"
  | "hidden";

export type ExplorerDetailSnapshot = {
  commands: {
    close: () => void;
    collapse: () => void;
    expand: () => void;
  };
  detailOverride: ExplorerDetailOverride | null;
  mode: ExplorerDetailMode;
  node: ExplorerDetailNode | null;
};

type ExplorerDetailStoreState = {
  clear: () => void;
  setSnapshot: (snapshot: ExplorerDetailSnapshot) => void;
  snapshot: ExplorerDetailSnapshot | null;
};

export const explorerDetailStore =
  createStore<ExplorerDetailStoreState>((set) => ({
    snapshot: null,
    clear: () => set({ snapshot: null }),
    setSnapshot: (snapshot) => set({ snapshot })
  }));
