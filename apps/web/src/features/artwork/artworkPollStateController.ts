import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkPollStateDependencies = {
  artworkPollMaxAttempts: number;
  artworkPollTimeoutMs: number;
  artworkLifecycleController: ArtworkLifecycleController;
  isArtworkJobFailed: (job: ArtworkJob) => boolean;
  state: ArtworkState;
};

export function createArtworkPollStateController(
  dependencies: ArtworkPollStateDependencies
) {
  const {
    artworkPollMaxAttempts,
    artworkPollTimeoutMs,
    artworkLifecycleController,
    isArtworkJobFailed,
    state
  } = dependencies;
  const {
    markArtworkJobFailed,
    stopArtworkPoller
  } = artworkLifecycleController;

  function recordArtworkPollAttempt(
    artworkJobKey: string,
    attemptId: number
  ): void {
    const current = state.artworkJobs.get(artworkJobKey);
    if (!current || current.attemptId !== attemptId) return;
    state.artworkJobs.set(artworkJobKey, {
      ...current,
      attempts: (current.attempts ?? 0) + 1
    });
  }

  function shouldStopArtworkPolling(
    artworkJobKey: string,
    attemptId: number
  ): boolean {
    const current = state.artworkJobs.get(artworkJobKey);
    if (
      !current ||
      current.attemptId !== attemptId ||
      isArtworkJobFailed(current)
    ) {
      return true;
    }
    if (current.status === "ready") {
      if (!current.imageUrl) {
        markArtworkJobFailed(
          artworkJobKey,
          "Illustration completed without an image. Retry to generate it again."
        );
      } else {
        stopArtworkPoller(artworkJobKey);
      }
      return true;
    }
    const elapsed =
      Date.now() - (current.startedAt ?? Date.now());
    if (
      elapsed < artworkPollTimeoutMs &&
      (current.attempts ?? 0) < artworkPollMaxAttempts
    ) {
      return false;
    }
    markArtworkJobFailed(
      artworkJobKey,
      "The illustration is taking longer than expected. The page remains usable; retry when you are ready.",
      { status: "timed_out" }
    );
    return true;
  }

  function copyArtworkJobStatus(
    artworkJobKey: string,
    job: ArtworkJob,
    page: ArtworkPage
  ): boolean {
    const current = state.artworkJobs.get(artworkJobKey);
    if (!current) return false;
    const didChange = [
      "status",
      "partialImageUrl",
      "imageUrl",
      "error",
      "environmentStatus"
    ].some((field) => current[field] !== job[field]);
    state.artworkJobs.set(artworkJobKey, {
      ...current,
      ...job,
      page: current.page ?? page,
      startedAt: current.startedAt,
      attempts: current.attempts
    });
    return didChange;
  }

  return {
    copyArtworkJobStatus,
    recordArtworkPollAttempt,
    shouldStopArtworkPolling
  };
}
