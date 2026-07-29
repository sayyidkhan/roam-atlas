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

type Listener = () => void;

let currentSnapshot: ExplorerDetailSnapshot | null = null;
const listeners = new Set<Listener>();

export const explorerDetailBridge = {
  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): ExplorerDetailSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: ExplorerDetailSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
