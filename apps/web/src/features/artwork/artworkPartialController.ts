import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import type {
  ArtworkJob,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkPartialDependencies = {
  artworkLifecycleController: ArtworkLifecycleController;
  isArtworkJobFailed: (job: ArtworkJob) => boolean;
  preloadArtworkImage: (imageUrl: string) => Promise<unknown>;
  render: () => void;
  state: ArtworkState;
};

export function createArtworkPartialController(
  dependencies: ArtworkPartialDependencies
) {
  const {
    artworkLifecycleController,
    isArtworkJobFailed,
    preloadArtworkImage,
    render,
    state
  } = dependencies;
  const { isArtworkJobVisible } =
    artworkLifecycleController;

  async function preparePartialArtwork(
    artworkJobKey: string,
    partialImageUrl: string,
    attemptId: number
  ): Promise<void> {
    const current = state.artworkJobs.get(artworkJobKey);
    if (
      !current ||
      current.attemptId !== attemptId ||
      current.decodedPartialImageUrl === partialImageUrl ||
      current.loadingPartialImageUrl === partialImageUrl
    ) {
      return;
    }
    state.artworkJobs.set(artworkJobKey, {
      ...current,
      loadingPartialImageUrl: partialImageUrl
    });
    try {
      await preloadArtworkImage(partialImageUrl);
      const latest = state.artworkJobs.get(artworkJobKey);
      if (
        !latest ||
        latest.attemptId !== attemptId ||
        latest.status === "ready" ||
        isArtworkJobFailed(latest)
      ) {
        return;
      }
      state.artworkJobs.set(artworkJobKey, {
        ...latest,
        decodedPartialImageUrl: partialImageUrl,
        loadingPartialImageUrl: null
      });
      if (isArtworkJobVisible(artworkJobKey)) render();
    } catch {
      const latest = state.artworkJobs.get(artworkJobKey);
      if (!latest || latest.attemptId !== attemptId) return;
      state.artworkJobs.set(artworkJobKey, {
        ...latest,
        loadingPartialImageUrl: null,
        partialImageFailed: true
      });
    }
  }

  return { preparePartialArtwork };
}

export type ArtworkPartialController = ReturnType<
  typeof createArtworkPartialController
>;
