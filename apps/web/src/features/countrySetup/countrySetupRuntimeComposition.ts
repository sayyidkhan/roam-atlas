import { APP_CONFIG } from "../../config/appConfig";
import {
  ensureCountryPack,
  isConfiguredCountryPack
} from "../../data/countryPacks";
import { createCountryPackStarterMap } from "@roamatlas/domain/countryDraft.js";
import {
  appendUnconfirmedRegionCandidates,
  isDraftItemApproved
} from "@roamatlas/domain/countryDraftReview.js";
import { PLACE_IMAGE_SELECTION_VERSION } from "@roamatlas/domain/placeImageSelection.js";
import {
  APPLICATION_RUNTIME_CONFIG
} from "../../app/applicationRuntimeConfig";
import type {
  ApplicationElements
} from "../../app/applicationElements";
import type {
  createApplicationLifecycleBridge
} from "../../app/applicationLifecycleBridge";
import type {
  ApplicationState
} from "../../app/applicationRuntimeTypes";
import { apiPath } from "../../app/browserRuntime";
import {
  getDraftNodeAtPath,
  removeDraftNodeAtPath,
  reorderArray
} from "../countryDraft/draftTree";
import type {
  createCountryDraftClient
} from "../countryDraft/countryDraftClient";
import { createCountryDraftStore } from "../countryDraft/countryDraftStore";
import {
  imageQualityLabel,
  normalizeImageQuality
} from "../experience/imageQualityPolicy";
import type { AppToastOptions } from "../notifications/appToastController";
import type {
  createPlaceImageClient
} from "../placeImages/placeImageClient";
import { createPlaceImageSessionStore } from "../placeImages/placeImageSessionStore";
import { createCountryRuntimeCacheController } from "../runtimeCache/countryRuntimeCacheController";
import { createCountryRuntimeCacheStore } from "../runtimeCache/countryRuntimeCacheStore";
import { flushCountryRuntimeCache } from "../runtimeCache/runtimeCacheClient";
import { createCountryArtworkQualityLockController } from "../artwork/countryArtworkQualityLockController";
import { fetchCountryArtworkQualityLock } from "../artwork/artworkQualityLockClient";
import { createCountryArtworkQualityLockStore } from "../artwork/countryArtworkQualityLockStore";
import { createCountryExperienceController } from "./countryExperienceController";

type ApplicationLifecycleBridge = ReturnType<
  typeof createApplicationLifecycleBridge
>;

type CountrySetupRuntimeDependencies = {
  countryDraftClient: ReturnType<
    typeof createCountryDraftClient
  >;
  elements: ApplicationElements;
  explainError: (error: unknown) => string;
  lifecycleBridge: Pick<
    ApplicationLifecycleBridge,
    | "clearCountryGeneratedState"
    | "enterCountryLanding"
    | "enterCountryShell"
    | "enterMappedCountry"
    | "showBootstrapError"
  >;
  placeImageClient: ReturnType<
    typeof createPlaceImageClient
  >;
  render: () => void;
  showAppToast: (options: AppToastOptions) => void;
  state: ApplicationState;
  storeImageQualityPreference: (value: string) => void;
};

export function createCountrySetupRuntime({
  countryDraftClient,
  elements,
  explainError,
  lifecycleBridge,
  placeImageClient,
  render,
  showAppToast,
  state,
  storeImageQualityPreference
}: CountrySetupRuntimeDependencies) {
  const draftStore = createCountryDraftStore();
  const placeImageSessionStore =
    createPlaceImageSessionStore();
  const runtimeCacheStore =
    createCountryRuntimeCacheStore();
  const artworkQualityLockStore =
    createCountryArtworkQualityLockStore();
  const artworkQualityLockController =
    createCountryArtworkQualityLockController({
      fetchCountryArtworkQualityLock: ({ countrySlug }) =>
        fetchCountryArtworkQualityLock({
          apiPath,
          countrySlug,
          fetchFn: fetch
        }),
      qualityLockStore: artworkQualityLockStore,
      render
    });
  const countryRuntimeCacheController =
    createCountryRuntimeCacheController({
      apiPath,
      clearCountryGeneratedState:
        lifecycleBridge.clearCountryGeneratedState,
      draftStore,
      errorToastDurationMs:
        APP_CONFIG.notifications.errorToastDurationMs,
      explainError,
      flushCountryRuntimeCache,
      placeImageSessionStore,
      refreshArtworkQualityLock:
        artworkQualityLockController.refresh,
      runtimeCacheStore,
      render,
      showToast: showAppToast
    });

  return createCountryExperienceController({
    APP_CONFIG,
    IMAGE_QUALITY_OPTIONS:
      APPLICATION_RUNTIME_CONFIG.imageQualityOptions,
    PLACE_IMAGE_REQUEST_SESSION:
      APPLICATION_RUNTIME_CONFIG.placeImageRequestSession,
    PLACE_IMAGE_SELECTION_VERSION,
    appendUnconfirmedRegionCandidates,
    apiPath,
    clearCountryGeneratedState:
      lifecycleBridge.clearCountryGeneratedState,
    countryDraftClient,
    artworkQualityLockController,
    artworkQualityLockStore,
    draftStore,
    createCountryPackStarterMap,
    elements,
    ensureCountryPack,
    enterCountryLanding:
      lifecycleBridge.enterCountryLanding,
    enterCountryShell: lifecycleBridge.enterCountryShell,
    enterMappedCountry:
      lifecycleBridge.enterMappedCountry,
    explainClickError: explainError,
    getDraftNodeAtPath,
    imageQualityLabel,
    isConfiguredCountryPack,
    isDraftItemApproved,
    normalizeImageQuality,
    placeImageClient,
    placeImageSessionStore,
    removeDraftNodeAtPath,
    render,
    requestCountryRuntimeCacheFlush:
      countryRuntimeCacheController.flush,
    runtimeCacheStore,
    reorderArray,
    showAppToast,
    showBootstrapError:
      lifecycleBridge.showBootstrapError,
    state,
    storeImageQualityPreference
  });
}
