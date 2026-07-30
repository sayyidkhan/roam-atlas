import type {
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkLifecycleDependencies = {
  getArtworkFailureMessage: (error: unknown) => string;
  getPageArtworkJobKey: (page: ArtworkPage | null) => string;
  render: () => void;
  state: ArtworkState;
  stopArtworkPolling: (artworkJobKey: string) => void;
};

export function createArtworkLifecycleController(
  dependencies: ArtworkLifecycleDependencies
) {
  const {
    getArtworkFailureMessage,
    getPageArtworkJobKey,
    render,
    state,
    stopArtworkPolling
  } = dependencies;

  function stopArtworkPoller(artworkJobKey: string): void {
    stopArtworkPolling(artworkJobKey);
  }

  function isCurrentArtworkAttempt(
    artworkJobKey: string,
    attemptId: number,
    jobUrl: string | null = null
  ): boolean {
    const current = state.artworkJobs.get(artworkJobKey);
    return Boolean(
      current &&
        current.attemptId === attemptId &&
        (!jobUrl || current.jobUrl === jobUrl)
    );
  }

  function getArtworkJobKeyForPage(
    page: ArtworkPage | null
  ): string {
    const scene =
      page?.sceneId && state.activePack
        ? state.activePack.scenes[page.sceneId]
        : null;
    return scene && page?.nodeId === scene.rootNodeId
      ? scene.id
      : getPageArtworkJobKey(page);
  }

  function isArtworkJobVisible(
    artworkJobKey: string
  ): boolean {
    return (
      state.currentView === "explorer" &&
      getArtworkJobKeyForPage(state.currentPage) ===
        artworkJobKey
    );
  }

  function markArtworkJobFailed(
    artworkJobKey: string,
    error: unknown,
    { status = "failed" }: { status?: string } = {}
  ): void {
    stopArtworkPoller(artworkJobKey);
    const current =
      state.artworkJobs.get(artworkJobKey) ?? {};
    state.artworkJobs.set(artworkJobKey, {
      ...current,
      status,
      error: getArtworkFailureMessage(error)
    });
    if (
      state.currentPage &&
      getArtworkJobKeyForPage(state.currentPage) ===
        artworkJobKey
    ) {
      state.currentPage = {
        ...state.currentPage,
        status: "artwork_failed"
      };
    }
    if (isArtworkJobVisible(artworkJobKey)) render();
  }

  return {
    getArtworkJobKeyForPage,
    isArtworkJobVisible,
    isCurrentArtworkAttempt,
    markArtworkJobFailed,
    stopArtworkPoller
  };
}

export type ArtworkLifecycleController = ReturnType<
  typeof createArtworkLifecycleController
>;
