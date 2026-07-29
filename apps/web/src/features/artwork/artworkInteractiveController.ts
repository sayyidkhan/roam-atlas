import type { ArtworkCompletionController } from "./artworkCompletionController";
import type { ArtworkLifecycleController } from "./artworkLifecycleController";
import { createArtworkPendingController } from "./artworkPendingController";
import type { ArtworkPollingController } from "./artworkPollingController";
import { createArtworkRequestController } from "./artworkRequestController";
import type {
  ArtworkPage,
  ArtworkState
} from "./artworkRuntimeTypes";

type ArtworkRuntimeController =
  ArtworkCompletionController &
  ArtworkLifecycleController &
  ArtworkPollingController;

type ArtworkInteractiveDependencies = {
  apiPath: (path: string) => string;
  artworkRuntimeController: ArtworkRuntimeController;
  enterReadyPage: (page: ArtworkPage) => void;
  explainClickError: (error: unknown) => string;
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  getPageArtworkJobKey: (
    page: ArtworkPage | null
  ) => string;
  render: () => void;
  state: ArtworkState;
};

export function createArtworkInteractiveController(
  dependencies: ArtworkInteractiveDependencies
) {
  let artworkAttemptSequence = 0;
  const nextAttemptId = (): number =>
    ++artworkAttemptSequence;
  const artworkRequestController =
    createArtworkRequestController({
      ...dependencies,
      nextAttemptId
    });
  const artworkPendingController =
    createArtworkPendingController({
      artworkRequestController,
      artworkRuntimeController:
        dependencies.artworkRuntimeController,
      enterReadyPage: dependencies.enterReadyPage,
      nextAttemptId,
      state: dependencies.state
    });

  return {
    ...artworkRequestController,
    ...artworkPendingController
  };
}
