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

type Listener = () => void;

let currentSnapshot: ExplorerChromeSnapshot | null = null;
const listeners = new Set<Listener>();

export const explorerChromeBridge = {
  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): ExplorerChromeSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: ExplorerChromeSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
