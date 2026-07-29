import type { ArtworkCompletionController } from "./artworkCompletionController";
import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import type { ArtworkPollingController } from "./artworkPollingController";
import type {
  ArtworkJobKind,
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkRequestRuntime =
  ArtworkCompletionController &
  ArtworkLifecycleController &
  ArtworkPollingController;

type ArtworkRequestDependencies = {
  apiPath: (path: string) => string;
  artworkRuntimeController: ArtworkRequestRuntime;
  explainClickError: (error: unknown) => string;
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  getPageArtworkJobKey: (
    page: ArtworkPage | null
  ) => string;
  nextAttemptId: () => number;
  render: () => void;
  state: ArtworkState;
};

type ArtworkRequestOptions = {
  jobKind?: ArtworkJobKind;
};

export function createArtworkRequestController(
  dependencies: ArtworkRequestDependencies
) {
  const {
    apiPath,
    artworkRuntimeController,
    explainClickError,
    fetchArtworkResource,
    getPageArtworkJobKey,
    nextAttemptId,
    render,
    state
  } = dependencies;
  const {
    completeCurrentPageArtwork,
    completeSceneArtwork,
    isCurrentArtworkAttempt,
    markArtworkJobFailed,
    pollArtworkJob,
    pollCurrentPageArtworkJob,
    startArtworkPoller
  } = artworkRuntimeController;

  async function requestSceneArtwork(
    sceneId: string,
    { jobKind = "interactive" }: ArtworkRequestOptions = {}
  ): Promise<void> {
    if (
      state.artworkByScene.has(sceneId) ||
      state.artworkJobs.has(sceneId)
    ) {
      return;
    }

    const attemptId = nextAttemptId();
    state.artworkJobs.set(sceneId, {
      status: "requesting",
      jobKind,
      countrySlug: state.activeCountrySlug,
      attemptId,
      startedAt: Date.now(),
      attempts: 0
    });
    render();
    try {
      const params = new URLSearchParams({
        countrySlug: state.activeCountrySlug,
        sceneId,
        quality: state.imageQuality
      });
      if (jobKind === "interactive") {
        params.set("priority", "interactive");
      }
      const response = await fetchArtworkResource(
        apiPath(`/api/artwork?${params.toString()}`),
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error(
          `Artwork request failed: ${response.status}`
        );
      }
      const { page } = (await response.json()) as {
        page: ArtworkPage;
      };
      if (!isCurrentArtworkAttempt(sceneId, attemptId)) return;
      if (page.status === "ready" && page.imageUrl) {
        await completeSceneArtwork(
          sceneId,
          page,
          page,
          attemptId
        );
        return;
      }

      const jobUrl = page.generated?.jobUrl;
      if (!jobUrl) {
        markArtworkJobFailed(
          sceneId,
          "The illustration job did not provide a status URL. Retry to start it again."
        );
        return;
      }
      state.artworkJobs.set(sceneId, {
        ...state.artworkJobs.get(sceneId),
        status:
          page.status ??
          "pending_codex_image_generation",
        page,
        jobKind,
        jobUrl
      });
      startArtworkPoller(
        sceneId,
        (currentAttemptId) =>
          pollArtworkJob(
            sceneId,
            jobUrl,
            page,
            currentAttemptId
          ),
        attemptId
      );
    } catch (error) {
      if (!isCurrentArtworkAttempt(sceneId, attemptId)) return;
      markArtworkJobFailed(
        sceneId,
        explainClickError(error)
      );
    }
  }

  async function requestCurrentPageArtwork(
    { jobKind = "interactive" }: ArtworkRequestOptions = {}
  ): Promise<void> {
    const page = state.currentPage;
    if (!page?.nodeId || !page.sceneId || page.imageUrl) {
      return;
    }
    const artworkJobKey = getPageArtworkJobKey(page);
    if (state.artworkJobs.has(artworkJobKey)) return;

    const attemptId = nextAttemptId();
    state.artworkJobs.set(artworkJobKey, {
      status: "requesting",
      jobKind,
      countrySlug: state.activeCountrySlug,
      page,
      attemptId,
      startedAt: Date.now(),
      attempts: 0
    });
    render();
    try {
      const params = new URLSearchParams({
        countrySlug: state.activeCountrySlug,
        sceneId: page.sceneId,
        nodeId: page.nodeId,
        quality: state.imageQuality
      });
      if (jobKind === "interactive") {
        params.set("priority", "interactive");
      }
      const response = await fetchArtworkResource(
        apiPath(`/api/artwork?${params.toString()}`),
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error(
          `Artwork request failed: ${response.status}`
        );
      }
      const { page: artworkPage } =
        (await response.json()) as {
          page: ArtworkPage;
        };
      if (
        !isCurrentArtworkAttempt(
          artworkJobKey,
          attemptId
        )
      ) {
        return;
      }
      if (
        artworkPage.status === "ready" &&
        artworkPage.imageUrl
      ) {
        await completeCurrentPageArtwork(
          artworkJobKey,
          page,
          artworkPage,
          attemptId
        );
        return;
      }

      const jobUrl = artworkPage.generated?.jobUrl;
      if (!jobUrl) {
        markArtworkJobFailed(
          artworkJobKey,
          "The illustration job did not provide a status URL. Retry to start it again."
        );
        return;
      }
      state.artworkJobs.set(artworkJobKey, {
        ...state.artworkJobs.get(artworkJobKey),
        status:
          artworkPage.status ??
          "pending_codex_image_generation",
        page: artworkPage,
        targetPage: page,
        jobKind,
        jobUrl
      });
      startArtworkPoller(
        artworkJobKey,
        (currentAttemptId) =>
          pollCurrentPageArtworkJob(
            artworkJobKey,
            jobUrl,
            page,
            artworkPage,
            currentAttemptId
          ),
        attemptId
      );
    } catch (error) {
      if (
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
    }
  }

  return {
    requestCurrentPageArtwork,
    requestSceneArtwork
  };
}

export type ArtworkRequestController = ReturnType<
  typeof createArtworkRequestController
>;
