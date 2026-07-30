import type { QueryClient } from "@tanstack/react-query";

import { createArtworkCompletionController } from "./artworkCompletionController";
import { createArtworkInteractiveController } from "./artworkInteractiveController";
import { createArtworkJobQueryPolling } from "./artworkJobQueryPolling";
import { createArtworkLifecycleController } from "./artworkLifecycleController";
import { createArtworkPartialController } from "./artworkPartialController";
import { createArtworkPollingController } from "./artworkPollingController";
import { createArtworkPrefetchController } from "./artworkPrefetchController";
import type { BrowserExperienceConfig } from "../experience/experienceConfigClient";

type InteractiveDependencies = Parameters<
  typeof createArtworkInteractiveController
>[0];
type LifecycleDependencies = Parameters<
  typeof createArtworkLifecycleController
>[0];
type CompletionDependencies = Parameters<
  typeof createArtworkCompletionController
>[0];
type PartialDependencies = Parameters<
  typeof createArtworkPartialController
>[0];
type PollingDependencies = Parameters<
  typeof createArtworkPollingController
>[0];
type PrefetchDependencies = Parameters<
  typeof createArtworkPrefetchController
>[0];

type ArtworkControllerState =
  InteractiveDependencies["state"] &
  LifecycleDependencies["state"] &
  CompletionDependencies["state"] &
  PartialDependencies["state"] &
  PollingDependencies["state"] &
  PrefetchDependencies["state"] & {
    experienceConfig: Partial<BrowserExperienceConfig> &
      PrefetchDependencies["state"]["experienceConfig"];
  };

type ArtworkControllerDependencies =
  Omit<
    InteractiveDependencies,
    "artworkRuntimeController" | "state"
  > &
  Omit<
    LifecycleDependencies,
    "state" | "stopArtworkPolling"
  > &
  Omit<
    CompletionDependencies,
    "artworkLifecycleController" | "state"
  > &
  Omit<
    PartialDependencies,
    "artworkLifecycleController" | "state"
  > &
  Omit<
    PollingDependencies,
    | "artworkCompletionController"
    | "artworkJobQueryPolling"
    | "artworkLifecycleController"
    | "artworkPartialController"
    | "state"
  > &
  Omit<PrefetchDependencies, "state"> & {
    fetchExperienceConfig: (input: {
      fetchFn: typeof fetch;
    }) => Promise<BrowserExperienceConfig>;
    hasStoredImageQualityPreference: () => boolean;
    normalizeImageQuality: (value: unknown) => string;
    queryClient: QueryClient;
    state: ArtworkControllerState;
  };

export function createArtworkController(
  dependencies: ArtworkControllerDependencies
) {
  const {
    ARTWORK_POLL_INTERVAL_MS,
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS,
    apiPath,
    enterReadyPage,
    explainClickError,
    fetchArtworkResource,
    fetchExperienceConfig,
    getArtworkFailureMessage,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    getPageEnvironmentUrl,
    hasStoredImageQualityPreference,
    isArtworkJobFailed,
    listNextArtworkDestinations,
    preloadArtworkImage,
    queryClient,
    render,
    normalizeImageQuality,
    toApiUrl
  } = dependencies;
  const { state } = dependencies;
  const artworkPrefetchController = createArtworkPrefetchController({
    ARTWORK_POLL_INTERVAL_MS,
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS,
    apiPath,
    explainClickError,
    fetchArtworkResource,
    getPageEnvironmentUrl,
    isArtworkJobFailed,
    listNextArtworkDestinations,
    preloadArtworkImage,
    queryClient,
    render,
    state,
    toApiUrl
  });
  const { prefetchNextDestinations } =
    artworkPrefetchController;
  const artworkJobQueryPolling =
    createArtworkJobQueryPolling({
      intervalMs: ARTWORK_POLL_INTERVAL_MS,
      queryClient
    });
  const artworkLifecycleController =
    createArtworkLifecycleController({
      getArtworkFailureMessage,
      getPageArtworkJobKey,
      render,
      state,
      stopArtworkPolling: artworkJobQueryPolling.stop
    });
  const artworkCompletionController =
    createArtworkCompletionController({
      artworkLifecycleController,
      explainClickError,
      getPageArtworkCacheKey,
      getPageEnvironmentUrl,
      preloadArtworkImage,
      render,
      state
    });
  const artworkPartialController =
    createArtworkPartialController({
      artworkLifecycleController,
      isArtworkJobFailed,
      preloadArtworkImage,
      render,
      state
    });
  const artworkPollingController = createArtworkPollingController({
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS,
    artworkCompletionController,
    artworkJobQueryPolling,
    artworkLifecycleController,
    artworkPartialController,
    explainClickError,
    fetchArtworkResource,
    isArtworkJobFailed,
    render,
    state,
    toApiUrl
  });
  const artworkRuntimeController = {
    ...artworkLifecycleController,
    ...artworkCompletionController,
    ...artworkPollingController
  };
  const { stopArtworkPoller } =
    artworkLifecycleController;
  const artworkInteractiveController =
    createArtworkInteractiveController({
      apiPath,
      artworkRuntimeController,
      enterReadyPage,
      explainClickError,
      fetchArtworkResource,
      getPageArtworkJobKey,
      render,
      state
    });
  const {
    renderImageGenerationPending,
    requestArtworkForCurrentPage,
    requestCurrentPageArtwork,
    requestSceneArtwork,
    retryArtwork
  } = artworkInteractiveController;

  async function loadExperienceConfig(): Promise<void> {
    try {
      state.experienceConfig = await fetchExperienceConfig({
        fetchFn: (path, options) =>
          fetch(apiPath(String(path)), options)
      });
      if (!hasStoredImageQualityPreference()) {
        state.imageQuality = normalizeImageQuality(state.experienceConfig.defaultImageQuality);
      }
      if (state.currentView === "explorer") {
        prefetchNextDestinations();
        render();
      }
    } catch {
      // Keep bundled defaults when the config endpoint is unavailable.
    }
  }

  return {
    ...artworkPrefetchController,
    requestSceneArtwork,
    requestCurrentPageArtwork,
    stopAllArtworkPolling:
      artworkJobQueryPolling.stopAll,
    stopArtworkPoller,
    renderImageGenerationPending,
    requestArtworkForCurrentPage,
    retryArtwork,
    loadExperienceConfig
  };
}
