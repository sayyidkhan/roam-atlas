import { ROAMATLAS_EXPERIENCE_CONFIG } from "@roamatlas/data/experienceConfig.js";
import { canonicalRouteForNode } from "@roamatlas/domain/routes.js";

import { APP_CONFIG } from "../config/appConfig";
import { DEFAULT_COUNTRY_SLUG } from "../data/countryPacks";
import { createArtworkRuntime } from "../features/artwork/artworkRuntimeComposition";
import { createCountrySetupRuntime } from "../features/countrySetup/countrySetupRuntimeComposition";
import { normalizeImageQuality } from "../features/experience/imageQualityPolicy";
import { createImageQualityPreference } from "../features/experience/imageQualityPreference";
import { getPageEnvironmentUrl } from "../features/explorer/explorerEnvironmentPagePolicy";
import { createExplorerRuntime } from "../features/explorer/explorerRuntimeComposition";
import { createExplorerFeedbackController } from "../features/explorer/explorerFeedbackController";
import { createExplorerImagePreloader } from "../features/explorer/explorerImagePreloader";
import {
  explainExplorerRequestError
} from "../features/explorer/explorerNavigationPagePolicy";
import { createExplorerPageTransitionBridge } from "../features/explorer/explorerPageTransitionBridge";
import { createExplorerPageTransitionController } from "../features/explorer/explorerPageTransitionController";
import { createExplorerPresentation } from "../features/explorer/explorerPresentationComposition";
import { createExplorerPublisherRegistry } from "../features/explorer/explorerPublisherRegistry";
import { createAppToastController } from "../features/notifications/appToastController";
import { createApplicationElements } from "./applicationElements";
import { createApplicationLifecycleBridge } from "./applicationLifecycleBridge";
import { createApplicationLifecycleController } from "./applicationLifecycleController";
import {
  APPLICATION_RUNTIME_CONFIG,
  buildBrowserLoadingStepTrail
} from "./applicationRuntimeConfig";
import { createApplicationRuntimeClients } from "./applicationRuntimeClients";
import type { ApplicationState } from "./applicationRuntimeTypes";
import { createApplicationState } from "./applicationState";
import { createApplicationViewController } from "./applicationViewController";
import { createApplicationViewBridge } from "./applicationViewBridge";
import { setBrowserPath } from "./browserRuntime";

export function composeApplicationRuntime() {
  const {
    countryDraftClient,
    explorerClient,
    placeImageClient
  } = createApplicationRuntimeClients();
  const state: ApplicationState = createApplicationState({
    defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
    defaultImageQuality:
      APP_CONFIG.imageQuality.defaultValue,
    experienceConfig: ROAMATLAS_EXPERIENCE_CONFIG
  });
  const elements = createApplicationElements();
  const lifecycleBridge =
    createApplicationLifecycleBridge();
  const applicationViewBridge =
    createApplicationViewBridge();
  const render = applicationViewBridge.render;
  const appToastController = createAppToastController({
    defaultDurationMs:
      APP_CONFIG.notifications.defaultToastDurationMs
  });
  const showAppToast = appToastController.show;
  const imageQualityPreference =
    createImageQualityPreference({
      fallbackValue:
        APP_CONFIG.imageQuality.defaultValue,
      normalizeImageQuality,
      storageKey:
        APPLICATION_RUNTIME_CONFIG.imageQualityStorageKey
    });
  const hasStoredImageQualityPreference =
    imageQualityPreference.hasStoredValue;
  const storeImageQualityPreference =
    imageQualityPreference.store;
  const explorerPublisherRegistry =
    createExplorerPublisherRegistry();
  const explorerPageTransitionBridge =
    createExplorerPageTransitionBridge();
  const explorerFeedbackController =
    createExplorerFeedbackController({
      buildLoadingStepTrail:
        buildBrowserLoadingStepTrail,
      state,
      transientStatusDurationMs:
        APP_CONFIG.notifications
          .transientStatusDurationMs
    });
  const explorerImagePreloader =
    createExplorerImagePreloader({
      imageLoads: state.artworkImageLoads
    });

  const countryExperience = createCountrySetupRuntime({
    countryDraftClient,
    elements,
    explainError: explainExplorerRequestError,
    lifecycleBridge,
    placeImageClient,
    render,
    showAppToast,
    state,
    storeImageQualityPreference
  });

  const {
    loadStoredCountryDraft,
    renderCountryShell
  } = countryExperience;
  state.imageQuality = imageQualityPreference.load();

  const artworkController = createArtworkRuntime({
    enterReadyPage:
      explorerPageTransitionBridge.enterReadyPage,
    explainClickError: explainExplorerRequestError,
    getPageEnvironmentUrl,
    hasStoredImageQualityPreference,
    preloadArtworkImage:
      explorerImagePreloader.preloadArtworkImage,
    render,
    state
  });

  const {
    invalidatePrefetchState,
    loadExperienceConfig,
    mergePrefetchedArtwork,
    prefetchNextDestinations,
    renderImageGenerationPending,
    requestCurrentPageArtwork,
    requestSceneArtwork,
    stopArtworkPoller
  } = artworkController;

  const explorerController = createExplorerRuntime({
    clearLoadingPanel:
      explorerFeedbackController.clearLoadingPanel,
    elements,
    enterReadyPage:
      explorerPageTransitionBridge.enterReadyPage,
    explorerClient,
    mergePrefetchedArtwork,
    preloadArtworkImage:
      explorerImagePreloader.preloadArtworkImage,
    prefetchNextDestinations,
    publishExplorerDestinations:
      explorerPublisherRegistry.publishDestinations,
    publishExplorerScene:
      explorerPublisherRegistry.publishScene,
    publishExplorerChromeContent:
      explorerPublisherRegistry.publishChromeContent,
    publishExplorerChromeState:
      explorerPublisherRegistry.publishChromeState,
    render,
    renderImageGenerationPending,
    renderLoadingPanel:
      explorerFeedbackController.renderLoadingPanel,
    renderTransientScrollStatus:
      explorerFeedbackController
        .renderTransientScrollStatus,
    requestCurrentPageArtwork,
    requestSceneArtwork,
    state
  });

  const {
    bindPageClick,
    cancelPendingNavigation,
    clearEnvironmentState,
    endNavigationFeedback,
    explainClickError,
    renderNodeDetail,
    renderDetour,
    renderScene
  } = explorerController;

  const { explorerChromeController } =
    createExplorerPresentation({
      artworkController,
      clearPendingJob:
        explorerPageTransitionBridge.clearPendingJob,
      explorerController,
      lifecycleBridge,
      publisherRegistry: explorerPublisherRegistry,
      render,
      state
    });

  const applicationViewController =
    createApplicationViewController({
      elements,
      renderCountryShell,
      renderDetour,
      renderExplorerChrome:
        explorerChromeController.publishState,
      renderNodeDetail,
      renderScene,
      state
    });
  applicationViewBridge.attach(applicationViewController);

  const explorerPageTransitionController =
    createExplorerPageTransitionController({
      canonicalRouteForNode,
      endNavigationFeedback,
      render,
      setBrowserPath,
      state
    });
  explorerPageTransitionBridge.attach(
    explorerPageTransitionController
  );

  return lifecycleBridge.attach(
    createApplicationLifecycleController({
      bindPageClick,
      cancelPendingNavigation,
      clearEnvironmentState,
      clearPendingJob:
        explorerPageTransitionBridge.clearPendingJob,
      elements,
      explainClickError,
      invalidatePrefetchState,
      loadExperienceConfig,
      loadStoredCountryDraft,
      render,
      setBrowserPath,
      state,
      stopArtworkPoller
    })
  );
}
