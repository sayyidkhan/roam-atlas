import { createStore } from "zustand/vanilla";

export type ExplorerChromeSnapshot = {
  backDisabled: boolean;
  breadcrumb: string;
  commands: {
    back: () => void;
    countries: () => void;
  };
  isBusy: boolean;
  isVisible: boolean;
  title: string;
};

type ExplorerChromeStoreState = {
  clear: () => void;
  setSnapshot: (snapshot: ExplorerChromeSnapshot) => void;
  snapshot: ExplorerChromeSnapshot | null;
};

export const explorerChromeStore =
  createStore<ExplorerChromeStoreState>((set) => ({
    snapshot: null,
    clear: () => set({ snapshot: null }),
    setSnapshot: (snapshot) => set({ snapshot })
  }));
