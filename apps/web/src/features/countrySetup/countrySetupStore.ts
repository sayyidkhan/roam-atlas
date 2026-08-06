import { createStore } from "zustand/vanilla";
import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type {
  CountryDraftCommands
} from "../countryDraft/countryDraftViewModel";
import type {
  CountryDraftStore
} from "../countryDraft/countryDraftTypes";
import type {
  CountryRuntimeCacheStore
} from "../runtimeCache/countryRuntimeCacheStore";
import type {
  CountryArtworkQualityLockStore
} from "../artwork/countryArtworkQualityLockStore";
import type {
  CountrySetupCommands
} from "./countrySetupActionController";

export type ImageQualityOption = {
  description: string;
  label: string;
  recommended?: boolean;
  value: string;
};

export type CountrySetupState = {
  buildDraftPhotoUrl: (
    placeName: string,
    context: string,
    kind: string
  ) => string;
  canOpenMap: boolean;
  commands: CountrySetupCommands;
  country: CountrySummary;
  draftCommands: CountryDraftCommands;
  draftStore: CountryDraftStore;
  imageQuality: string;
  imageQualityOptions: readonly ImageQualityOption[];
  isSourceControlled: boolean;
  artworkQualityLockStore: CountryArtworkQualityLockStore;
  runtimeCacheStore: CountryRuntimeCacheStore;
};

type CountrySetupStoreState = {
  clear: () => void;
  setup: CountrySetupState | null;
  setSetup: (setup: CountrySetupState) => void;
};

export const countrySetupStore =
  createStore<CountrySetupStoreState>((set) => ({
    setup: null,
    clear: () => set({ setup: null }),
    setSetup: (setup) => set({ setup })
  }));
