export type ExplorerFeedbackSnapshot = {
  loadingPanel: {
    detail: string;
    message: string;
    progressState:
      | "complete"
      | "failed"
      | "indeterminate";
    steps: Array<{
      label: string;
      state: string;
    }>;
  } | null;
  scrollStatus: string | null;
};

type Listener = () => void;

let currentSnapshot: ExplorerFeedbackSnapshot = {
  loadingPanel: null,
  scrollStatus: null
};
const listeners = new Set<Listener>();

export const explorerFeedbackBridge = {
  clear(): void {
    currentSnapshot = {
      loadingPanel: null,
      scrollStatus: null
    };
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): ExplorerFeedbackSnapshot {
    return currentSnapshot;
  },

  publish(
    update: Partial<ExplorerFeedbackSnapshot>
  ): void {
    currentSnapshot = {
      ...currentSnapshot,
      ...update
    };
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
