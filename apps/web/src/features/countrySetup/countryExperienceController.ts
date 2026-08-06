import { createCountryDraftController } from "../countryDraft/countryDraftController";
import { createCountryDraftViewController } from "../countryDraft/countryDraftViewController";
import { createDraftPhotoLightboxController } from "../placeImages/draftPhotoLightboxController";
import { createPlaceImageController } from "../placeImages/placeImageController";
import type {
  ApplicationState,
  CountryShellNavigationOptions,
  CountrySummary,
  NavigationOptions
} from "../../app/applicationRuntimeTypes";
import type { ApplicationElements } from "../../app/applicationElements";
import type { RuntimePack } from "../../app/browserRuntime";
import type { AppToastOptions } from "../notifications/appToastController";
import type { RuntimeCacheScope } from "../runtimeCache/runtimeCacheTypes";
import {
  countrySetupStore,
  type ImageQualityOption
} from "./countrySetupStore";
import type {
  CountryRuntimeCacheStore
} from "../runtimeCache/countryRuntimeCacheStore";
import { createCountryShellScrollController } from "./countryShellScroll";
import { createCountrySetupActionController } from "./countrySetupActionController";
import type {
  CountryDraftStore
} from "../countryDraft/countryDraftTypes";
import type {
  PlaceImageSessionStore
} from "../placeImages/placeImageSessionStore";
import {
  scopeInstructionToCandidate
} from "./countryExperiencePolicy";
import type {
  CountryArtworkQualityLockStore
} from "../artwork/countryArtworkQualityLockStore";
import type {
  createCountryArtworkQualityLockController
} from "../artwork/countryArtworkQualityLockController";

type DraftControllerDependencies = Parameters<
  typeof createCountryDraftController
>[0];
type PlaceImageControllerDependencies = Parameters<
  typeof createPlaceImageController
>[0];
type LightboxControllerDependencies = Parameters<
  typeof createDraftPhotoLightboxController
>[0];

type CountryExperienceDependencies = {
  APP_CONFIG: DraftControllerDependencies["APP_CONFIG"] &
    PlaceImageControllerDependencies["APP_CONFIG"] &
    LightboxControllerDependencies["APP_CONFIG"];
  IMAGE_QUALITY_OPTIONS: readonly ImageQualityOption[];
  PLACE_IMAGE_REQUEST_SESSION: string;
  PLACE_IMAGE_SELECTION_VERSION: string;
  appendUnconfirmedRegionCandidates:
    DraftControllerDependencies["appendUnconfirmedRegionCandidates"];
  apiPath: (path: string) => string;
  artworkQualityLockController: ReturnType<
    typeof createCountryArtworkQualityLockController
  >;
  artworkQualityLockStore: CountryArtworkQualityLockStore;
  clearCountryGeneratedState: (countrySlug: string) => void;
  countryDraftClient:
    DraftControllerDependencies["countryDraftClient"];
  draftStore: CountryDraftStore;
  createCountryPackStarterMap:
    DraftControllerDependencies["createCountryPackStarterMap"];
  elements: Pick<ApplicationElements, "countryShell">;
  ensureCountryPack: (
    countrySlug: string
  ) => Promise<RuntimePack | null>;
  enterCountryLanding: (options?: NavigationOptions) => void;
  enterMappedCountry: (
    pack: RuntimePack | null,
    options?: NavigationOptions
  ) => void;
  enterCountryShell: (
    country: CountrySummary,
    options?: CountryShellNavigationOptions
  ) => void;
  explainClickError: (error: unknown) => string;
  getDraftNodeAtPath:
    DraftControllerDependencies["getDraftNodeAtPath"];
  imageQualityLabel: (value: string) => string;
  isConfiguredCountryPack:
    DraftControllerDependencies["isConfiguredCountryPack"];
  isDraftItemApproved:
    DraftControllerDependencies["isDraftItemApproved"];
  normalizeImageQuality: (value: unknown) => string;
  placeImageClient:
    PlaceImageControllerDependencies["placeImageClient"] &
      LightboxControllerDependencies["placeImageClient"];
  placeImageSessionStore: PlaceImageSessionStore;
  removeDraftNodeAtPath:
    DraftControllerDependencies["removeDraftNodeAtPath"];
  render: () => void;
  requestCountryRuntimeCacheFlush: (
    country: CountrySummary,
    options?: {
      confirm?: boolean;
      scope?: RuntimeCacheScope;
    }
  ) => Promise<boolean>;
  runtimeCacheStore: CountryRuntimeCacheStore;
  reorderArray: DraftControllerDependencies["reorderArray"];
  showAppToast: (options: AppToastOptions) => void;
  showBootstrapError: (error: unknown) => void;
  state: ApplicationState;
  storeImageQualityPreference: (value: string) => void;
};

export function createCountryExperienceController(
  dependencies: CountryExperienceDependencies
) {
  const {
    APP_CONFIG,
    IMAGE_QUALITY_OPTIONS,
    PLACE_IMAGE_REQUEST_SESSION,
    PLACE_IMAGE_SELECTION_VERSION,
    appendUnconfirmedRegionCandidates,
    apiPath,
    artworkQualityLockController,
    artworkQualityLockStore,
    clearCountryGeneratedState,
    countryDraftClient,
    draftStore,
    createCountryPackStarterMap,
    elements,
    ensureCountryPack,
    enterCountryLanding,
    enterMappedCountry,
    enterCountryShell,
    explainClickError,
    getDraftNodeAtPath,
    imageQualityLabel,
    isConfiguredCountryPack,
    isDraftItemApproved,
    normalizeImageQuality,
    placeImageClient,
    placeImageSessionStore,
    removeDraftNodeAtPath,
    render,
    requestCountryRuntimeCacheFlush,
    runtimeCacheStore,
    reorderArray,
    showAppToast,
    showBootstrapError,
    state,
    storeImageQualityPreference,
  } = dependencies;
  const countryShellScroll =
    createCountryShellScrollController(
      elements.countryShell
    );
  const captureCountryShellScroll =
    countryShellScroll.capture;
  const restoreCountryShellScroll =
    countryShellScroll.restore;

  const countryDraftController = createCountryDraftController({
    APP_CONFIG,
    appendUnconfirmedRegionCandidates,
    captureCountryShellScroll,
    countryDraftClient,
    createCountryPackStarterMap,
    ensureCountryPack,
    explainClickError,
    getSelectedCountry: () => state.selectedCountry,
    getDraftNodeAtPath,
    isConfiguredCountryPack,
    isDraftItemApproved,
    removeDraftNodeAtPath,
    render,
    reorderArray,
    restoreCountryShellScroll,
    showAppToast,
    draftStore
  });
  const {
    requestCountryDraft
  } = countryDraftController;
  const countrySetupCommands =
    createCountrySetupActionController({
      canOpenCountryExplorer,
      captureScroll: captureCountryShellScroll,
      clearCountryGeneratedState,
      ensureCountryPack,
      enterCountryLanding,
      enterMappedCountry,
      imageQualityLabel,
      normalizeImageQuality,
      draftStore,
      render,
      requestCountryDraft,
      requestCountryRuntimeCacheFlush,
      restoreScroll: restoreCountryShellScroll,
      showBootstrapError,
      showToast: showAppToast,
      state,
      storeImageQualityPreference
    });
  const placeImageController = createPlaceImageController({
    APP_CONFIG,
    PLACE_IMAGE_REQUEST_SESSION,
    PLACE_IMAGE_SELECTION_VERSION,
    apiPath,
    captureCountryShellScroll,
    explainClickError,
    placeImageClient,
    placeImageSessionStore,
    render,
    restoreCountryShellScroll,
    showAppToast
  });
  const draftPhotoLightboxController =
    createDraftPhotoLightboxController({
      APP_CONFIG,
      PLACE_IMAGE_REQUEST_SESSION,
      getSelectedCountry: () => state.selectedCountry,
      placeImageClient,
      placeImageSessionStore,
      render,
      ...placeImageController,
    });
  const countryDraftViewController =
    createCountryDraftViewController({
      deleteCurrentDraftItem:
        countryDraftController.deleteCurrentDraftItem,
      editUnconfirmedDraftCandidate:
        countryDraftController.editUnconfirmedDraftCandidate,
      openDraftPhotoLightbox:
        draftPhotoLightboxController.openDraftPhotoLightbox,
      reorderCurrentDraftItems:
        countryDraftController.reorderCurrentDraftItems,
      requestCountryDraft,
      requestCountryDraftApproval:
        countryDraftController.requestCountryDraftApproval,
      requestCountryDraftConfirmation:
        countryDraftController.requestCountryDraftConfirmation,
      requestCountryDraftInfluence:
        countryDraftController.requestCountryDraftInfluence,
      requestPlaceImageReset:
        placeImageController.requestPlaceImageReset,
      scopeInstructionToCandidate,
      state
    });

  function canOpenCountryExplorer(
    country: CountrySummary
  ): boolean {
    const draftState = draftStore.get(country.slug);
    return Boolean(draftState?.draft);
  }
  
  function renderCountryShell(): void {
    const country = state.selectedCountry;
    if (!country) return;
    const canOpenMap = canOpenCountryExplorer(country);
    countrySetupStore.getState().setSetup({
      buildDraftPhotoUrl: (
        placeName,
        context,
        kind
      ) =>
        placeImageController.buildPlaceImageUrl(
          country.slug,
          placeName,
          { context, kind }
        ),
      country,
      canOpenMap,
      draftStore,
      imageQuality: state.imageQuality,
      imageQualityOptions: IMAGE_QUALITY_OPTIONS,
      artworkQualityLockStore,
      isSourceControlled: isConfiguredCountryPack(
        country.slug
      ),
      runtimeCacheStore,
      draftCommands: countryDraftViewController.commands,
      commands: countrySetupCommands
    });
    void artworkQualityLockController.load(country.slug);
  }
  
  async function resetCountryAndOpenMap(
    country: CountrySummary
  ): Promise<void> {
    enterCountryLanding();
    runtimeCacheStore.set(country.slug, {
      status: "loading",
      scope: "all",
      message: `Preparing ${country.name}: clearing generated cache.`
    });
    render();
  
    const flushed = await requestCountryRuntimeCacheFlush(country, { confirm: false });
    if (!flushed) {
      enterCountryShell(country);
      return;
    }
  
    enterCountryShell(country, { replaceUrl: true });
    const rebuilt = await requestCountryDraft(country, { force: true });
    if (!rebuilt) return;
  
    const pack = await ensureCountryPack(country.slug);
    if (pack) {
      enterMappedCountry(pack);
    }
  }
  
  async function resetCountry(
    country: CountrySummary
  ): Promise<void> {
    runtimeCacheStore.set(country.slug, {
      status: "loading",
      scope: "all",
      message: `Resetting ${country.name}: clearing generated cache.`
    });
    render();
  
    const flushed = await requestCountryRuntimeCacheFlush(country, { confirm: false });
    if (!flushed) return;
  
    await requestCountryDraft(country, { force: true });
  }
  
  return {
    ...countryDraftController,
    ...countrySetupCommands,
    ...countryDraftViewController,
    ...draftPhotoLightboxController,
    ...placeImageController,
    captureCountryShellScroll,
    restoreCountryShellScroll,
    canOpenCountryExplorer,
    renderCountryShell,
    resetCountryAndOpenMap,
    resetCountry,
  };
}
