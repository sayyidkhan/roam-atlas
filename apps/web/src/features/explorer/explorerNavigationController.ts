import { createExplorerPageClickAdapter } from "./explorerPageClickAdapter";
import {
  explainExplorerRequestError,
  isRuntimeArtworkPage
} from "./explorerNavigationPagePolicy";
import { createExplorerNavigationRequestController } from "./explorerNavigationRequestController";
import type {
  ExplorerNavigationDependencies,
  OverlayTarget
} from "./explorerNavigationTypes";
import { createExplorerPageNavigationController } from "./explorerPageNavigationController";

export function createExplorerNavigationController(
  dependencies: ExplorerNavigationDependencies
) {
  const {
    clamp,
    clamp01,
    clearLoadingPanel,
    elements,
    enterReadyPage,
    getContainedImageRect,
    getPageEnvironmentUrl,
    publishExplorerChromeState,
    renderDetour,
    renderLoadingPanel,
    renderTransientScrollStatus,
    requestEnvironmentPlan,
    state
  } = dependencies;
  const pageClickAdapter = createExplorerPageClickAdapter({
    clamp,
    clamp01,
    getContainedImageRect,
    stage: elements.stage,
    viewport: elements.viewport
  });
  const {
    computeImageClick,
    computeNormalizedSceneClick
  } = pageClickAdapter;
  const navigationRequestController =
    createExplorerNavigationRequestController({
      endNavigationFeedback,
      state
    });
  const {
    beginNavigationRequest,
    cancelPendingNavigation,
    finishNavigationRequest,
    isNavigationRequestCurrent
  } = navigationRequestController;
  const pageNavigationController =
    createExplorerPageNavigationController({
      ...dependencies,
      endNavigationFeedback
    });
  const {
    buildImmediatePageFromClick,
    buildImmediatePageFromTarget,
    getCurrentRequestPage,
    requestFlipbookPage,
    runFlipbookResult
  } = pageNavigationController;
  const explainClickError = explainExplorerRequestError;

  function bindPageClick(): () => void {
    return pageClickAdapter.bindPageClick(resolveClickAt);
  }

  async function resolveClickAt(
    event: MouseEvent
  ): Promise<void> {
    if (
      state.isResolvingClick ||
      !state.currentPage ||
      !state.activePack
    ) {
      return;
    }

    const normalizedClick =
      computeNormalizedSceneClick(event);
    const imageClick = computeImageClick(event);
    const requestPage = getCurrentRequestPage();
    if (!requestPage) return;
    const environmentUrl = imageClick
      ? getPageEnvironmentUrl(requestPage)
      : null;
    const environmentPlan = environmentUrl
      ? state.environmentPlans.get(environmentUrl)
      : null;

    // Runtime artwork may navigate only through its image-specific curated
    // target map. A VLM must not promote an arbitrary visual guess to a
    // verified place.
    if (imageClick && isRuntimeArtworkPage(requestPage)) {
      if (
        !environmentUrl ||
        !environmentPlan ||
        environmentPlan.status === "request_failed"
      ) {
        if (environmentUrl) {
          void requestEnvironmentPlan(environmentUrl);
        }
        renderTransientScrollStatus(
          "Preparing accurate location targets…"
        );
        return;
      }
      renderTransientScrollStatus(
        environmentPlan.targets?.length
          ? "Click directly on a mapped location."
          : "Location targets are not ready yet."
      );
      return;
    }

    const immediatePage = imageClick
      ? null
      : buildImmediatePageFromClick(normalizedClick);
    if (immediatePage) {
      enterReadyPage(immediatePage);
      return;
    }

    const navigationRequest = beginNavigationRequest();
    beginNavigationFeedback();
    try {
      const result = await requestFlipbookPage({
        normalizedClick,
        imageClick,
        signal: navigationRequest.signal
      });
      if (
        !isNavigationRequestCurrent(navigationRequest.id)
      ) {
        return;
      }
      runFlipbookResult(result);
      finishNavigationRequest(navigationRequest.id);
    } catch (error) {
      if (
        !isNavigationRequestCurrent(navigationRequest.id)
      ) {
        return;
      }
      cancelPendingNavigation();
      renderDetour({
        confidence: "unconfirmed",
        title: "Click failed",
        message: explainClickError(error)
      });
    }
  }

  async function resolveOverlayTarget(
    target: OverlayTarget
  ): Promise<void> {
    if (
      state.isResolvingClick ||
      !state.activePack
    ) {
      return;
    }

    const immediatePage =
      buildImmediatePageFromTarget(target);
    if (immediatePage) {
      enterReadyPage(immediatePage);
      return;
    }

    const navigationRequest = beginNavigationRequest();
    const node =
      target.nodeId && state.activePack.nodes[target.nodeId]
        ? state.activePack.nodes[target.nodeId]
        : null;
    beginNavigationFeedback(node?.title);
    try {
      const result = await requestFlipbookPage({
        normalizedClick:
          target.normalizedClick ?? { x: 0.5, y: 0.5 },
        targetNodeId: target.nodeId,
        detourPhrase: target.detourPhrase,
        signal: navigationRequest.signal
      });
      if (
        !isNavigationRequestCurrent(navigationRequest.id)
      ) {
        return;
      }
      runFlipbookResult(result);
      finishNavigationRequest(navigationRequest.id);
    } catch (error) {
      if (
        !isNavigationRequestCurrent(navigationRequest.id)
      ) {
        return;
      }
      cancelPendingNavigation();
      renderDetour({
        confidence: "unconfirmed",
        title: "Click failed",
        message: explainClickError(error)
      });
    }
  }

  function beginNavigationFeedback(title?: string): void {
    publishExplorerChromeState();
    renderLoadingPanel({
      pageTitle: title ?? "next page",
      fallbackMessage: title
        ? `Opening ${title}…`
        : "Exploring…"
    });
  }

  function endNavigationFeedback(): void {
    publishExplorerChromeState();
    clearLoadingPanel();
  }

  return {
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
  };
}
