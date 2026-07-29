import type { PlaceImagePromptResult } from "./placeImageTypes";

export type DraftPhotoLightboxInput = {
  context?: string;
  kind?: string;
  placeName?: string;
  src: string;
};

export type DraftPhotoHistorySnapshot = {
  canDelete: boolean;
  canKeep: boolean;
  canMoveNext: boolean;
  canMovePrevious: boolean;
  deleteLabel: string;
  keepLabel: string;
  label: string;
};

export type DraftPhotoLightboxSnapshot = {
  busyAction:
    | "delete"
    | "keep"
    | "reset"
    | null;
  commands: {
    close: () => void;
    deleteHistoryEntry: () => Promise<void>;
    keepHistoryEntry: () => Promise<void>;
    moveHistory: (offset: number) => void;
    reset: () => Promise<void>;
    submitFeedback: (feedback: string) => Promise<boolean>;
    suggestPrompts: (
      currentFeedback: string
    ) => Promise<PlaceImagePromptResult>;
  };
  feedbackMaxLength: number;
  history: DraftPhotoHistorySnapshot | null;
  imageUrl: string;
  input: Required<DraftPhotoLightboxInput>;
};

type Listener = () => void;

let currentSnapshot: DraftPhotoLightboxSnapshot | null = null;
const listeners = new Set<Listener>();

/**
 * Compatibility boundary between imperative feature commands and the
 * React-owned reference-photo dialog.
 */
export const draftPhotoLightboxBridge = {
  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): DraftPhotoLightboxSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: DraftPhotoLightboxSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
