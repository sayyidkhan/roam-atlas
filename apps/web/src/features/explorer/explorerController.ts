import { createExplorerEnvironmentController } from "./explorerEnvironmentController";
import { createExplorerNavigationController } from "./explorerNavigationController";
import { createExplorerDetailController } from "./explorerDetailController";
import type { PreloadedImageSize } from "./explorerImagePreloader";
import { createExplorerSceneOrchestrator } from "./explorerSceneOrchestrator";

type EnvironmentDependencies = Parameters<
  typeof createExplorerEnvironmentController
>[0];
type NavigationDependencies = Parameters<
  typeof createExplorerNavigationController
>[0];
type DetailDependencies = Parameters<
  typeof createExplorerDetailController
>[0];
type SceneDependencies = Parameters<
  typeof createExplorerSceneOrchestrator
>[0];

export type ExplorerControllerState =
  EnvironmentDependencies["state"] &
  NavigationDependencies["state"] &
  DetailDependencies["state"] &
  SceneDependencies["state"];

type ExplorerControllerDependencies =
  Omit<
    EnvironmentDependencies,
    "getCurrentRequestPage" | "state"
  > &
  Omit<
    NavigationDependencies,
    | "getPageEnvironmentUrl"
    | "renderDetour"
    | "requestEnvironmentPlan"
    | "state"
  > &
  Omit<
    SceneDependencies,
    | "getCurrentRequestPage"
    | "getPageEnvironmentUrl"
    | "promoteCurrentPageEnvironmentPlan"
    | "requestEnvironmentPlan"
    | "state"
  > & {
    preloadArtworkImage: (
      imageUrl: string | null | undefined
    ) => Promise<PreloadedImageSize>;
    state: ExplorerControllerState;
  };

export function createExplorerController(
  dependencies: ExplorerControllerDependencies
) {
  const {
    ENVIRONMENT_PLAN_REQUEST_RETRY_MS,
    ENVIRONMENT_PLAN_RETRY_DELAYS_MS,
    ENVIRONMENT_PLAN_SCHEMA_VERSION,
    apiPath,
    canonicalRouteForNode,
    clamp,
    clamp01,
    clearLoadingPanel,
    elements,
    enterReadyPage,
    environmentPlanNeedsTargetRecovery,
    explorerClient,
    fetchArtworkResource,
    getRenderedImageRect,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    isArtworkJobPending,
    isCurrentEnvironmentPlan,
    listNextArtworkDestinations,
    mergePrefetchedArtwork,
    normalizeEnvironmentPlan,
    preloadArtworkImage,
    prefetchNextDestinations,
    publishExplorerDestinations,
    publishExplorerScene,
    publishExplorerChromeContent,
    publishExplorerChromeState,
    render,
    renderImageGenerationPending,
    renderLoadingPanel,
    renderTransientScrollStatus,
    requestCurrentPageArtwork,
    requestSceneArtwork,
    resolveFlipbookClick,
    setBrowserPath
  } = dependencies;
  const state = dependencies.state;
  const navigationControllerRef: {
    current: ReturnType<
      typeof createExplorerNavigationController
    > | null;
  } = { current: null };
  const detailControllerRef: {
    current: ReturnType<
      typeof createExplorerDetailController
    > | null;
  } = { current: null };
  const environmentController =
    createExplorerEnvironmentController({
      ENVIRONMENT_PLAN_REQUEST_RETRY_MS,
      ENVIRONMENT_PLAN_RETRY_DELAYS_MS,
      ENVIRONMENT_PLAN_SCHEMA_VERSION,
      apiPath,
      environmentPlanNeedsTargetRecovery,
      explorerClient,
      fetchArtworkResource,
      getCurrentRequestPage: () =>
        navigationControllerRef.current?.getCurrentRequestPage() ??
        null,
      getPageArtworkCacheKey,
      isCurrentEnvironmentPlan,
      normalizeEnvironmentPlan,
      render,
      state
    });
  const {
    getPageEnvironmentUrl,
    promoteCurrentPageEnvironmentPlan,
    requestEnvironmentPlan
  } = environmentController;
  const navigationController =
    createExplorerNavigationController({
    canonicalRouteForNode,
    clamp,
    clamp01,
    clearLoadingPanel,
    elements,
    enterReadyPage,
    explorerClient,
    getRenderedImageRect,
    getPageArtworkCacheKey,
    getPageEnvironmentUrl,
    mergePrefetchedArtwork,
    publishExplorerChromeState,
    renderDetour: (detour) =>
      detailControllerRef.current?.renderDetour(detour),
    renderImageGenerationPending,
    renderLoadingPanel,
    renderTransientScrollStatus,
    requestEnvironmentPlan,
    resolveFlipbookClick,
    setBrowserPath,
    state
  });
  navigationControllerRef.current = navigationController;
  const {
    bindPageClick,
    cancelPendingNavigation,
    computeImageClick,
    endNavigationFeedback,
    explainClickError,
    getCurrentRequestPage,
    isRuntimeArtworkPage,
    requestFlipbookPage,
    resolveOverlayTarget,
    runFlipbookResult
  } = navigationController;
  const detailController = createExplorerDetailController({
    endNavigationFeedback,
    state
  });
  detailControllerRef.current = detailController;
  const {
    renderDetour,
    renderNodeDetail
  } = detailController;
  const sceneOrchestrator =
    createExplorerSceneOrchestrator({
      environmentPlanNeedsTargetRecovery,
      getCurrentRequestPage,
      getPageArtworkCacheKey,
      getPageArtworkJobKey,
      getPageEnvironmentUrl,
      isArtworkJobPending,
      listNextArtworkDestinations,
      prefetchNextDestinations,
      promoteCurrentPageEnvironmentPlan,
      publishExplorerChromeContent,
      publishExplorerDestinations,
      publishExplorerScene,
      requestCurrentPageArtwork,
      requestEnvironmentPlan,
      requestSceneArtwork,
      state
    });
  const { canCurrentPageUseSceneArtwork, renderScene } =
    sceneOrchestrator;
  return {
    ...environmentController,
    renderScene,
    canCurrentPageUseSceneArtwork,
    preloadArtworkImage,
    bindPageClick,
    resolveOverlayTarget,
    cancelPendingNavigation,
    requestFlipbookPage,
    getCurrentRequestPage,
    isRuntimeArtworkPage,
    computeImageClick,
    runFlipbookResult,
    renderNodeDetail,
    renderDetour,
    endNavigationFeedback,
    explainClickError
  };
}
