import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type { CountrySetupCommands } from "./countrySetupActionController";
import type {
  CountryDraftCommands,
} from "../countryDraft/countryDraftViewModel";
import type {
  CountryDraftStore
} from "../countryDraft/countryDraftTypes";
import type {
  CountryRuntimeCacheStore
} from "../runtimeCache/countryRuntimeCacheStore";

export type ImageQualityOption = {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
};

export type CountrySetupSnapshot = {
  buildDraftPhotoUrl: (
    placeName: string,
    context: string,
    kind: string
  ) => string;
  country: CountrySummary;
  canOpenMap: boolean;
  draftCommands: CountryDraftCommands;
  draftStore: CountryDraftStore;
  imageQuality: string;
  imageQualityOptions: readonly ImageQualityOption[];
  isSourceControlled: boolean;
  runtimeCacheStore: CountryRuntimeCacheStore;
  commands: CountrySetupCommands;
};

type Listener = () => void;

let currentSnapshot: CountrySetupSnapshot | null = null;
const listeners = new Set<Listener>();

/**
 * Narrow compatibility bridge between the imperative command runtime and the
 * React-owned country setup surface.
 *
 * Draft and runtime-cache workflow state already use feature stores. Delete
 * this bridge when the remaining country/navigation command snapshot does too.
 */
export const countrySetupBridge = {
  getSnapshot(): CountrySetupSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: CountrySetupSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
