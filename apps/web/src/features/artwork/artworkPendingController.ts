import type { ArtworkCompletionController } from "./artworkCompletionController";
import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import type { ArtworkPollingController } from "./artworkPollingController";
import type { ArtworkRequestController } from "./artworkRequestController";
import type {
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkPendingRuntime =
  ArtworkCompletionController &
  ArtworkLifecycleController &
  ArtworkPollingController;

type ArtworkPendingDependencies = {
  artworkRequestController: ArtworkRequestController;
  artworkRuntimeController: ArtworkPendingRuntime;
  enterReadyPage: (page: ArtworkPage) => void;
  nextAttemptId: () => number;
  state: ArtworkState;
};

type ArtworkResult = {
  click?: unknown;
  page?: ArtworkPage;
  [key: string]: unknown;
};

export function createArtworkPendingController(
  dependencies: ArtworkPendingDependencies
) {
  const {
    artworkRequestController,
    artworkRuntimeController,
    enterReadyPage,
    nextAttemptId,
    state
  } = dependencies;
  const {
    requestCurrentPageArtwork,
    requestSceneArtwork
  } = artworkRequestController;
  const {
    completeCurrentPageArtwork,
    completeSceneArtwork,
    getArtworkJobKeyForPage,
    markArtworkJobFailed,
    pollArtworkJob,
    pollCurrentPageArtworkJob,
    startArtworkPoller,
    stopArtworkPoller
  } = artworkRuntimeController;

  function renderImageGenerationPending(
    page: ArtworkPage,
    result: ArtworkResult
  ): void {
    const artworkJobKey = getArtworkJobKeyForPage(page);
    const attemptId = nextAttemptId();
    const jobUrl = page.generated?.jobUrl;
    const pendingPage: ArtworkPage = {
      ...page,
      imageUrl: null,
      environmentUrl: null,
      status: page.imageUrl
        ? "decoding_image"
        : page.status
    };

    state.artworkJobs.set(artworkJobKey, {
      status:
        pendingPage.status ??
        "pending_codex_image_generation",
      serverStatus: page.status,
      jobKind: "interactive",
      countrySlug: state.activeCountrySlug,
      page,
      result,
      jobUrl,
      attemptId,
      startedAt: Date.now(),
      attempts: 0
    });

    enterReadyPage(pendingPage);

    if (page.imageUrl && page.sceneId) {
      const scene =
        state.activePack?.scenes[page.sceneId];
      if (scene && page.nodeId === scene.rootNodeId) {
        void completeSceneArtwork(
          page.sceneId,
          page,
          page,
          attemptId
        );
      } else {
        void completeCurrentPageArtwork(
          artworkJobKey,
          pendingPage,
          page,
          attemptId
        );
      }
      return;
    }

    if (!jobUrl) {
      state.artworkJobs.delete(artworkJobKey);
      requestArtworkForCurrentPage();
      return;
    }

    if (!page.sceneId) {
      markArtworkJobFailed(
        artworkJobKey,
        "The illustration page did not identify its scene."
      );
      return;
    }
    const scene = state.activePack?.scenes[page.sceneId];
    if (scene && page.nodeId === scene.rootNodeId) {
      startArtworkPoller(
        artworkJobKey,
        (currentAttemptId) =>
          pollArtworkJob(
            page.sceneId as string,
            jobUrl,
            page,
            currentAttemptId
          ),
        attemptId
      );
    } else {
      startArtworkPoller(
        artworkJobKey,
        (currentAttemptId) =>
          pollCurrentPageArtworkJob(
            artworkJobKey,
            jobUrl,
            pendingPage,
            page,
            currentAttemptId
          ),
        attemptId
      );
    }
  }

  function requestArtworkForCurrentPage(): void {
    const page = state.currentPage;
    if (!page?.sceneId || !state.activePack) return;
    const scene = state.activePack.scenes[page.sceneId];
    if (scene && page.nodeId === scene.rootNodeId) {
      void requestSceneArtwork(scene.id, {
        jobKind: "interactive"
      });
    } else {
      void requestCurrentPageArtwork({
        jobKind: "interactive"
      });
    }
  }

  function retryArtwork(artworkJobKey: string): void {
    const currentPage = state.currentPage;
    if (
      !currentPage ||
      getArtworkJobKeyForPage(currentPage) !==
        artworkJobKey
    ) {
      return;
    }
    stopArtworkPoller(artworkJobKey);
    state.artworkJobs.delete(artworkJobKey);
    state.currentPage = {
      ...currentPage,
      imageUrl: null,
      environmentUrl: null,
      status: "pending_codex_image_generation"
    };
    requestArtworkForCurrentPage();
  }

  return {
    renderImageGenerationPending,
    requestArtworkForCurrentPage,
    retryArtwork
  };
}
