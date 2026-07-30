import { createStore } from "zustand/vanilla";

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

type ExplorerFeedbackStoreState = {
  clear: () => void;
  snapshot: ExplorerFeedbackSnapshot;
  updateSnapshot: (
    update: Partial<ExplorerFeedbackSnapshot>
  ) => void;
};

const EMPTY_FEEDBACK_SNAPSHOT: ExplorerFeedbackSnapshot = {
  loadingPanel: null,
  scrollStatus: null
};

export const explorerFeedbackStore =
  createStore<ExplorerFeedbackStoreState>((set) => ({
    snapshot: EMPTY_FEEDBACK_SNAPSHOT,
    clear: () =>
      set({ snapshot: EMPTY_FEEDBACK_SNAPSHOT }),
    updateSnapshot: (update) =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          ...update
        }
      }))
  }));
