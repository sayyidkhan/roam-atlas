import { createStore } from "zustand/vanilla";

import type {
  ExplorerBreadcrumbItem
} from "./explorerBreadcrumbPolicy";

export type ExplorerChromeSnapshot = {
  backDisabled: boolean;
  breadcrumbs: ExplorerBreadcrumbItem[];
  commands: {
    back: () => void;
    countries: () => void;
    openBreadcrumb: (nodeId: string) => void;
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
