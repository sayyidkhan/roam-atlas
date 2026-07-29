import type { ApplicationState } from "./applicationRuntimeTypes";

type ApplicationGeneratedStateDependencies = {
  cancelPendingNavigation: () => void;
  clearEnvironmentState: (countrySlug: string) => void;
  clearPendingJob: () => void;
  invalidatePrefetchState: () => void;
  state: ApplicationState;
  stopArtworkPoller: (artworkJobKey: string) => void;
};

export function createApplicationGeneratedStateController(
  dependencies: ApplicationGeneratedStateDependencies
) {
  const {
    cancelPendingNavigation,
    clearEnvironmentState,
    clearPendingJob,
    invalidatePrefetchState,
    state,
    stopArtworkPoller
  } = dependencies;

  function clearCountryGeneratedState(
    countrySlug: string
  ): void {
    clearPendingJob();
    cancelPendingNavigation();
    for (const artworkJobKey of [
      ...state.artworkJobs.keys()
    ]) {
      stopArtworkPoller(artworkJobKey);
    }
    state.artworkJobs.clear();
    state.artworkByScene.clear();
    state.artworkByPage.clear();
    state.artworkImageLoads.clear();
    invalidatePrefetchState();
    clearEnvironmentState(countrySlug);
    if (state.currentPage?.countrySlug === countrySlug) {
      state.currentPage = {
        ...state.currentPage,
        imageUrl: null,
        environmentUrl: null,
        artworkDecoded: false
      };
    }
  }

  return { clearCountryGeneratedState };
}
