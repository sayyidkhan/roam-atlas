import {
  materializeExplorerRequestPage,
  type ExplorerPage
} from "./explorerNavigationPagePolicy";
import type {
  ExplorerNavigationDependencies,
  FlipbookResult,
  OverlayTarget,
  RequestFlipbookPageOptions
} from "./explorerNavigationTypes";
import type { NormalizedPoint } from "./explorerPageClickAdapter";

type ExplorerPageNavigationDependencies = Pick<
  ExplorerNavigationDependencies,
  | "canonicalRouteForNode"
  | "enterReadyPage"
  | "explorerClient"
  | "getPageArtworkCacheKey"
  | "mergePrefetchedArtwork"
  | "renderDetour"
  | "renderImageGenerationPending"
  | "resolveFlipbookClick"
  | "setBrowserPath"
  | "state"
> & {
  endNavigationFeedback: () => void;
};

export function createExplorerPageNavigationController(
  dependencies: ExplorerPageNavigationDependencies
) {
  const {
    canonicalRouteForNode,
    endNavigationFeedback,
    enterReadyPage,
    explorerClient,
    getPageArtworkCacheKey,
    mergePrefetchedArtwork,
    renderDetour,
    renderImageGenerationPending,
    resolveFlipbookClick,
    setBrowserPath,
    state
  } = dependencies;

  function buildImmediatePageFromClick(
    normalizedClick: NormalizedPoint
  ): ExplorerPage | null {
    if (!state.activePack || !state.currentPage) return null;
    const currentPage = getCurrentRequestPage();
    if (!currentPage) return null;

    const result = resolveFlipbookClick({
      currentPage,
      normalizedClick,
      scenes: state.activePack.scenes,
      nodes: state.activePack.nodes,
      sceneArtwork: {},
      countryName: state.activePack.title
    });

    return result.click?.status === "matched"
      ? mergePrefetchedArtwork(result.page)
      : null;
  }

  function buildImmediatePageFromTarget(
    target: OverlayTarget
  ): ExplorerPage | null {
    if (
      !target.nodeId ||
      !state.activePack?.nodes[target.nodeId]
    ) {
      return null;
    }
    const currentPage = getCurrentRequestPage();
    if (!currentPage) return null;

    const result = resolveFlipbookClick({
      currentPage,
      normalizedClick:
        target.normalizedClick ?? { x: 0.5, y: 0.5 },
      targetNodeId: target.nodeId,
      scenes: state.activePack.scenes,
      nodes: state.activePack.nodes,
      sceneArtwork: {},
      countryName: state.activePack.title
    });

    return mergePrefetchedArtwork(result.page);
  }

  async function requestFlipbookPage({
    normalizedClick,
    imageClick = null,
    targetNodeId = null,
    detourPhrase = null,
    signal
  }: RequestFlipbookPageOptions): Promise<FlipbookResult> {
    const currentPage = getCurrentRequestPage();
    if (!currentPage) {
      throw new Error(
        "No active explorer page is available."
      );
    }
    return explorerClient.resolveFlipbookClick(
      {
        currentPage,
        normalizedClick,
        imageClick,
        targetNodeId,
        detourPhrase,
        imageQuality: state.imageQuality
      },
      { signal }
    );
  }

  function getCurrentRequestPage(): ExplorerPage | null {
    return materializeExplorerRequestPage({
      activePack: state.activePack,
      artworkByPage: state.artworkByPage,
      artworkByScene: state.artworkByScene,
      currentPage: state.currentPage,
      currentSceneId: state.currentSceneId,
      getPageArtworkCacheKey
    });
  }

  function runFlipbookResult(result: FlipbookResult): void {
    if (result.click?.resolver === "vlm_guard") {
      endNavigationFeedback();
      renderDetour({
        confidence: "unresolved",
        title: "Click not resolved",
        message:
          "RoamAtlas could not identify that exact image region confidently enough, so it did not turn to the wrong page."
      });
      return;
    }
    const page = mergePrefetchedArtwork(result.page);
    if (page.nodeId && state.activePack) {
      setBrowserPath(
        canonicalRouteForNode(
          state.activeCountrySlug,
          page.nodeId,
          state.activePack
        )
      );
    }
    if (
      page.status === "generation_required" ||
      page.status === "pending_codex_image_generation" ||
      (page.imageUrl && !page.artworkDecoded)
    ) {
      renderImageGenerationPending(page, result);
      return;
    }

    enterReadyPage(page);
  }

  return {
    buildImmediatePageFromClick,
    buildImmediatePageFromTarget,
    getCurrentRequestPage,
    requestFlipbookPage,
    runFlipbookResult
  };
}
