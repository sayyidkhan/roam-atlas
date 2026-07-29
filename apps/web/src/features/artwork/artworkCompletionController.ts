import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkCompletionDependencies = {
  artworkLifecycleController: ArtworkLifecycleController;
  explainClickError: (error: unknown) => string;
  getPageArtworkCacheKey: (page: ArtworkPage) => string;
  getPageEnvironmentUrl: (
    page: ArtworkPage | null | undefined
  ) => string | null;
  preloadArtworkImage: (imageUrl: string) => Promise<unknown>;
  render: () => void;
  state: ArtworkState;
};

export function createArtworkCompletionController(
  dependencies: ArtworkCompletionDependencies
) {
  const {
    artworkLifecycleController,
    explainClickError,
    getPageArtworkCacheKey,
    getPageEnvironmentUrl,
    preloadArtworkImage,
    render,
    state
  } = dependencies;
  const {
    isArtworkJobVisible,
    isCurrentArtworkAttempt,
    markArtworkJobFailed,
    stopArtworkPoller
  } = artworkLifecycleController;

  async function completeSceneArtwork(
    sceneId: string,
    page: ArtworkPage,
    imageResult: ArtworkPage | ArtworkJob,
    attemptId: number | null = null
  ): Promise<void> {
    if (
      attemptId != null &&
      !isCurrentArtworkAttempt(sceneId, attemptId)
    ) {
      return;
    }
    const imageUrl = imageResult.imageUrl ?? page.imageUrl;
    if (!imageUrl) {
      markArtworkJobFailed(
        sceneId,
        "Illustration completed without an image. Retry to generate it again."
      );
      return;
    }
    const current = state.artworkJobs.get(sceneId) ?? {};
    state.artworkJobs.set(sceneId, {
      ...current,
      status: "decoding_image",
      serverStatus: imageResult.status ?? page.status,
      imageUrl
    });
    if (isArtworkJobVisible(sceneId)) render();
    try {
      await preloadArtworkImage(imageUrl);
    } catch (error) {
      if (
        attemptId != null &&
        !isCurrentArtworkAttempt(sceneId, attemptId)
      ) {
        return;
      }
      markArtworkJobFailed(
        sceneId,
        explainClickError(error)
      );
      return;
    }
    if (
      attemptId != null &&
      !isCurrentArtworkAttempt(sceneId, attemptId)
    ) {
      return;
    }

    stopArtworkPoller(sceneId);
    const environmentUrl = getPageEnvironmentUrl({
      ...page,
      ...imageResult
    });
    const readyPage: ArtworkPage = {
      ...page,
      imageUrl,
      environmentUrl,
      status: "ready",
      artworkDecoded: true
    };
    state.artworkByScene.set(sceneId, {
      imageUrl,
      environmentUrl,
      page: readyPage,
      decoded: true
    });
    state.artworkJobs.delete(sceneId);
    const scene = state.activePack?.scenes?.[sceneId];
    if (
      scene &&
      state.currentSceneId === sceneId &&
      state.currentPage?.nodeId === scene.rootNodeId &&
      !state.currentPage.imageUrl
    ) {
      state.currentPage = {
        ...state.currentPage,
        imageUrl,
        environmentUrl,
        status: "ready",
        artworkDecoded: true
      };
    }
    if (isArtworkJobVisible(sceneId)) render();
  }

  async function completeCurrentPageArtwork(
    artworkJobKey: string,
    targetPage: ArtworkPage,
    imageResult: ArtworkPage | ArtworkJob,
    attemptId: number | null = null
  ): Promise<void> {
    if (
      attemptId != null &&
      !isCurrentArtworkAttempt(
        artworkJobKey,
        attemptId
      )
    ) {
      return;
    }
    const imageUrl = imageResult.imageUrl;
    if (!imageUrl) {
      markArtworkJobFailed(
        artworkJobKey,
        "Illustration completed without an image. Retry to generate it again."
      );
      return;
    }
    const current =
      state.artworkJobs.get(artworkJobKey) ?? {};
    state.artworkJobs.set(artworkJobKey, {
      ...current,
      status: "decoding_image",
      serverStatus: imageResult.status,
      imageUrl
    });
    if (isArtworkJobVisible(artworkJobKey)) render();
    try {
      await preloadArtworkImage(imageUrl);
    } catch (error) {
      if (
        attemptId != null &&
        !isCurrentArtworkAttempt(
          artworkJobKey,
          attemptId
        )
      ) {
        return;
      }
      markArtworkJobFailed(
        artworkJobKey,
        explainClickError(error)
      );
      return;
    }
    if (
      attemptId != null &&
      !isCurrentArtworkAttempt(
        artworkJobKey,
        attemptId
      )
    ) {
      return;
    }

    stopArtworkPoller(artworkJobKey);
    const environmentUrl = getPageEnvironmentUrl({
      ...targetPage,
      ...imageResult
    });
    const readyPage: ArtworkPage = {
      ...targetPage,
      ...imageResult,
      imageUrl,
      environmentUrl,
      status: "ready",
      artworkDecoded: true
    };
    state.artworkByPage.set(
      getPageArtworkCacheKey(targetPage),
      {
        imageUrl,
        environmentUrl,
        page: readyPage,
        decoded: true
      }
    );
    state.artworkJobs.delete(artworkJobKey);
    if (
      state.currentPage?.nodeId === targetPage.nodeId &&
      state.currentPage.sceneId === targetPage.sceneId &&
      !state.currentPage.imageUrl
    ) {
      state.currentPage = {
        ...state.currentPage,
        imageUrl,
        environmentUrl,
        status: "ready",
        artworkDecoded: true
      };
    }
    if (isArtworkJobVisible(artworkJobKey)) render();
  }

  return {
    completeCurrentPageArtwork,
    completeSceneArtwork
  };
}

export type ArtworkCompletionController = ReturnType<
  typeof createArtworkCompletionController
>;
