import { worldCountries } from "@roamatlas/data/countries.js";
import { canonicalRouteForNode } from "@roamatlas/domain/routes.js";
import {
  buildBrowserLoadingStepTrail
} from "../../app/applicationRuntimeConfig";
import type {
  createApplicationLifecycleBridge
} from "../../app/applicationLifecycleBridge";
import type {
  ApplicationState
} from "../../app/applicationRuntimeTypes";
import { setBrowserPath } from "../../app/browserRuntime";
import { generatedTiles } from "../../data/generatedTiles";
import type {
  createArtworkController
} from "../artwork/artworkController";
import {
  getArtworkFailureMessage,
  isArtworkJobFailed,
  isArtworkJobPending
} from "../artwork/artworkJobPolicy";
import { createExplorerChromeController } from "./explorerChromeController";
import type {
  createExplorerController
} from "./explorerController";
import { createExplorerDestinationController } from "./explorerDestinationController";
import type {
  createExplorerPublisherRegistry
} from "./explorerPublisherRegistry";
import { createExplorerSceneController } from "./explorerSceneController";

type ArtworkController = ReturnType<
  typeof createArtworkController
>;
type ApplicationLifecycleBridge = ReturnType<
  typeof createApplicationLifecycleBridge
>;
type ExplorerController = ReturnType<
  typeof createExplorerController
>;
type ExplorerPublisherRegistry = ReturnType<
  typeof createExplorerPublisherRegistry
>;

type ExplorerPresentationDependencies = {
  artworkController: Pick<
    ArtworkController,
    | "getPrefetchReadinessLabel"
    | "isArtworkTargetReady"
    | "retryArtwork"
  >;
  clearPendingJob: () => void;
  explorerController: Pick<
    ExplorerController,
    "cancelPendingNavigation" | "resolveOverlayTarget"
  >;
  lifecycleBridge: Pick<
    ApplicationLifecycleBridge,
    "enterCountryLanding" | "enterCountryShell"
  >;
  publisherRegistry: ExplorerPublisherRegistry;
  render: () => void;
  state: ApplicationState;
};

export function createExplorerPresentation({
  artworkController,
  clearPendingJob,
  explorerController,
  lifecycleBridge,
  publisherRegistry,
  render,
  state
}: ExplorerPresentationDependencies) {
  const chromeController = createExplorerChromeController({
    cancelPendingNavigation:
      explorerController.cancelPendingNavigation,
    canonicalRouteForNode,
    clearPendingJob,
    enterCountryLanding:
      lifecycleBridge.enterCountryLanding,
    render,
    setBrowserPath,
    state
  });
  const destinationController =
    createExplorerDestinationController({
      buildLoadingStepTrail:
        buildBrowserLoadingStepTrail,
      enterCountryShell:
        lifecycleBridge.enterCountryShell,
      getArtworkFailureMessage,
      getExplorerState: () => state,
      getPrefetchReadinessLabel:
        artworkController.getPrefetchReadinessLabel,
      isArtworkJobFailed,
      isArtworkJobPending,
      isArtworkTargetReady:
        artworkController.isArtworkTargetReady,
      resolveOverlayTarget:
        explorerController.resolveOverlayTarget,
      retryArtwork: artworkController.retryArtwork,
      worldCountries
    });
  const sceneController = createExplorerSceneController({
    generatedTiles,
    resolveOverlayTarget: (target) => {
      void explorerController.resolveOverlayTarget(target);
    }
  });

  publisherRegistry.attach({
    chromeContent: chromeController.publishContent,
    chromeState: chromeController.publishState,
    destinations: destinationController.publish,
    scene: sceneController.publish
  });

  return { explorerChromeController: chromeController };
}
