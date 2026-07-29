import type { ArtworkCompletionController } from "./artworkCompletionController";
import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import type { ArtworkPartialController } from "./artworkPartialController";
import { createArtworkPollStateController } from "./artworkPollStateController";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkPollingDependencies = {
  ARTWORK_POLL_INTERVAL_MS: number;
  ARTWORK_POLL_MAX_ATTEMPTS: number;
  ARTWORK_POLL_TIMEOUT_MS: number;
  artworkCompletionController: ArtworkCompletionController;
  artworkLifecycleController: ArtworkLifecycleController;
  artworkPartialController: ArtworkPartialController;
  explainClickError: (error: unknown) => string;
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  isArtworkJobFailed: (job: ArtworkJob) => boolean;
  render: () => void;
  state: ArtworkState;
  toApiUrl: (path: string) => string;
};

export function createArtworkPollingController(
  dependencies: ArtworkPollingDependencies
) {
  const {
    ARTWORK_POLL_INTERVAL_MS,
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS,
    artworkCompletionController,
    artworkLifecycleController,
    artworkPartialController,
    explainClickError,
    fetchArtworkResource,
    isArtworkJobFailed,
    render,
    state,
    toApiUrl
  } = dependencies;
  const {
    completeCurrentPageArtwork,
    completeSceneArtwork
  } = artworkCompletionController;
  const {
    isArtworkJobVisible,
    isCurrentArtworkAttempt,
    markArtworkJobFailed,
    stopArtworkPoller
  } = artworkLifecycleController;
  const { preparePartialArtwork } =
    artworkPartialController;
  const artworkPollStateController =
    createArtworkPollStateController({
      artworkPollIntervalMs: ARTWORK_POLL_INTERVAL_MS,
      artworkPollMaxAttempts: ARTWORK_POLL_MAX_ATTEMPTS,
      artworkPollTimeoutMs: ARTWORK_POLL_TIMEOUT_MS,
      artworkLifecycleController,
      isArtworkJobFailed,
      state
    });
  const {
    copyArtworkJobStatus,
    recordArtworkPollAttempt,
    shouldStopArtworkPolling,
    startArtworkPoller
  } = artworkPollStateController;

  async function pollArtworkJob(
    sceneId: string,
    jobUrl: string,
    page: ArtworkPage,
    attemptId: number
  ): Promise<void> {
    if (shouldStopArtworkPolling(sceneId, attemptId)) return;
    try {
      const response = await fetchArtworkResource(
        toApiUrl(jobUrl),
        { cache: "no-store" }
      );
      if (!isCurrentArtworkAttempt(sceneId, attemptId, jobUrl)) {
        return;
      }
      recordArtworkPollAttempt(sceneId, attemptId);
      if (!response.ok) {
        shouldStopArtworkPolling(sceneId, attemptId);
        return;
      }
      const job = (await response.json()) as ArtworkJob;
      if (!isCurrentArtworkAttempt(sceneId, attemptId, jobUrl)) {
        return;
      }
      const activeJob = state.artworkJobs.get(sceneId);
      if (
        !activeJob ||
        activeJob.status === "decoding_image" ||
        activeJob.status === "ready"
      ) {
        return;
      }
      const didChange = copyArtworkJobStatus(
        sceneId,
        job,
        page
      );
      if (
        job.partialImageUrl &&
        job.status !== "ready"
      ) {
        void preparePartialArtwork(
          sceneId,
          job.partialImageUrl,
          attemptId
        );
      }
      if (isArtworkJobFailed(job)) {
        markArtworkJobFailed(
          sceneId,
          job.error ?? "Illustration generation failed.",
          { status: job.status }
        );
        return;
      }
      if (job.status === "ready" && !job.imageUrl) {
        markArtworkJobFailed(
          sceneId,
          "Illustration completed without an image. Retry to generate it again."
        );
        return;
      }
      if (job.status === "ready" && job.imageUrl) {
        stopArtworkPoller(sceneId);
        await completeSceneArtwork(
          sceneId,
          page,
          job,
          attemptId
        );
        return;
      }
      if (didChange && isArtworkJobVisible(sceneId)) render();
    } catch (error) {
      if (!isCurrentArtworkAttempt(sceneId, attemptId, jobUrl)) {
        return;
      }
      recordArtworkPollAttempt(sceneId, attemptId);
      if (shouldStopArtworkPolling(sceneId, attemptId)) return;
      copyArtworkJobStatus(
        sceneId,
        {
          status:
            state.artworkJobs.get(sceneId)?.status ??
            "waiting_for_job",
          lastPollError: explainClickError(error)
        },
        page
      );
    }
  }

  async function pollCurrentPageArtworkJob(
    artworkJobKey: string,
    jobUrl: string,
    targetPage: ArtworkPage,
    artworkPage: ArtworkPage,
    attemptId: number
  ): Promise<void> {
    if (shouldStopArtworkPolling(artworkJobKey, attemptId)) return;
    try {
      const response = await fetchArtworkResource(
        toApiUrl(jobUrl),
        { cache: "no-store" }
      );
      if (
        !isCurrentArtworkAttempt(
          artworkJobKey,
          attemptId,
          jobUrl
        )
      ) {
        return;
      }
      recordArtworkPollAttempt(artworkJobKey, attemptId);
      if (!response.ok) {
        shouldStopArtworkPolling(artworkJobKey, attemptId);
        return;
      }
      const job = (await response.json()) as ArtworkJob;
      if (
        !isCurrentArtworkAttempt(
          artworkJobKey,
          attemptId,
          jobUrl
        )
      ) {
        return;
      }
      const activeJob = state.artworkJobs.get(artworkJobKey);
      if (
        !activeJob ||
        activeJob.status === "decoding_image" ||
        activeJob.status === "ready"
      ) {
        return;
      }
      const didChange = copyArtworkJobStatus(
        artworkJobKey,
        job,
        artworkPage
      );
      if (
        job.partialImageUrl &&
        job.status !== "ready"
      ) {
        void preparePartialArtwork(
          artworkJobKey,
          job.partialImageUrl,
          attemptId
        );
      }
      if (isArtworkJobFailed(job)) {
        markArtworkJobFailed(
          artworkJobKey,
          job.error ?? "Illustration generation failed.",
          { status: job.status }
        );
        return;
      }
      if (job.status === "ready" && !job.imageUrl) {
        markArtworkJobFailed(
          artworkJobKey,
          "Illustration completed without an image. Retry to generate it again."
        );
        return;
      }
      if (job.status === "ready" && job.imageUrl) {
        stopArtworkPoller(artworkJobKey);
        await completeCurrentPageArtwork(
          artworkJobKey,
          targetPage,
          { ...artworkPage, ...job },
          attemptId
        );
        return;
      }
      if (didChange && isArtworkJobVisible(artworkJobKey)) {
        render();
      }
    } catch (error) {
      if (
        !isCurrentArtworkAttempt(
          artworkJobKey,
          attemptId,
          jobUrl
        )
      ) {
        return;
      }
      recordArtworkPollAttempt(artworkJobKey, attemptId);
      if (
        shouldStopArtworkPolling(artworkJobKey, attemptId)
      ) {
        return;
      }
      copyArtworkJobStatus(
        artworkJobKey,
        {
          status:
            state.artworkJobs.get(artworkJobKey)?.status ??
            "waiting_for_job",
          lastPollError: explainClickError(error)
        },
        artworkPage
      );
    }
  }

  return {
    pollCurrentPageArtworkJob,
    pollArtworkJob,
    startArtworkPoller
  };
}

export type ArtworkPollingController = ReturnType<
  typeof createArtworkPollingController
>;
