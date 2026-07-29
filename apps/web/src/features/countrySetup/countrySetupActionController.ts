import type {
  ApplicationState,
  CountrySummary
} from "../../app/applicationRuntimeTypes";
import type { RuntimePack } from "../../app/browserRuntime";
import type { AppToastOptions } from "../notifications/appToastController";
import type { RuntimeCacheScope } from "../runtimeCache/runtimeCacheTypes";
import type {
  CountryDraftStore
} from "../countryDraft/countryDraftTypes";
import type { CountryShellScrollSnapshot } from "./countryShellScroll";

export type CountrySetupCommands = {
  backToCountries: () => void;
  openOrBuildMap: () => void;
  resetGeneratedVisuals: () => void;
  setImageQuality: (value: string) => void;
};

type CountrySetupActionDependencies = {
  canOpenCountryExplorer: (country: CountrySummary) => boolean;
  captureScroll: () => CountryShellScrollSnapshot;
  clearCountryGeneratedState: (countrySlug: string) => void;
  draftStore: CountryDraftStore;
  ensureCountryPack: (
    countrySlug: string
  ) => Promise<RuntimePack | null>;
  enterCountryLanding: () => void;
  enterMappedCountry: (pack: RuntimePack | null) => void;
  imageQualityLabel: (value: string) => string;
  normalizeImageQuality: (value: unknown) => string;
  render: () => void;
  requestCountryDraft: (
    country: CountrySummary,
    options?: { force?: boolean; preserveScroll?: boolean }
  ) => Promise<boolean>;
  requestCountryRuntimeCacheFlush: (
    country: CountrySummary,
    options?: {
      confirm?: boolean;
      scope?: RuntimeCacheScope;
    }
  ) => Promise<boolean>;
  restoreScroll: (snapshot: CountryShellScrollSnapshot) => void;
  showBootstrapError: (error: unknown) => void;
  showToast: (options: AppToastOptions) => void;
  state: ApplicationState;
  storeImageQualityPreference: (value: string) => void;
};

/**
 * React-facing country setup commands.
 *
 * These methods contain no DOM lookup or delegated-event parsing, so the
 * setup surface can call feature behavior directly.
 */
export function createCountrySetupActionController({
  canOpenCountryExplorer,
  captureScroll,
  clearCountryGeneratedState,
  draftStore,
  ensureCountryPack,
  enterCountryLanding,
  enterMappedCountry,
  imageQualityLabel,
  normalizeImageQuality,
  render,
  requestCountryDraft,
  requestCountryRuntimeCacheFlush,
  restoreScroll,
  showBootstrapError,
  showToast,
  state,
  storeImageQualityPreference
}: CountrySetupActionDependencies): CountrySetupCommands {
  function selectedCountry(): CountrySummary | null {
    return state.selectedCountry;
  }

  function backToCountries(): void {
    enterCountryLanding();
  }

  function openOrBuildMap(): void {
    const country = selectedCountry();
    if (!country) return;
    if (canOpenCountryExplorer(country)) {
      void ensureCountryPack(country.slug)
        .then(enterMappedCountry)
        .catch(showBootstrapError);
      return;
    }
    const draftState = draftStore.get(country.slug);
    void requestCountryDraft(country, {
      force: Boolean(draftState?.draft),
      preserveScroll: Boolean(draftState?.draft)
    });
  }

  function resetGeneratedVisuals(): void {
    const country = selectedCountry();
    if (!country) return;
    void requestCountryRuntimeCacheFlush(country, {
      confirm: false,
      scope: "visuals"
    });
  }

  function setImageQuality(value: string): void {
    const imageQuality = normalizeImageQuality(value);
    if (imageQuality === state.imageQuality) return;
    const scrollSnapshot = captureScroll();
    state.imageQuality = imageQuality;
    storeImageQualityPreference(imageQuality);
    const country = selectedCountry();
    if (country) clearCountryGeneratedState(country.slug);
    render();
    restoreScroll(scrollSnapshot);
    showToast({
      title: `${imageQualityLabel(imageQuality)} quality selected`,
      message:
        "New and regenerated illustrations will use this quality. Existing images from other quality tiers will not be reused."
    });
  }

  return {
    backToCountries,
    openOrBuildMap,
    resetGeneratedVisuals,
    setImageQuality
  };
}
