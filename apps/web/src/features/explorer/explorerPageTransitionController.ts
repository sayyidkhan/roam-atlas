import type {
  ApplicationState
} from "../../app/applicationRuntimeTypes";
import type {
  RuntimePack,
  RuntimePage
} from "../../app/browserRuntime";

type ExplorerPageTransitionDependencies = {
  canonicalRouteForNode: (
    countrySlug: string,
    nodeId: string,
    pack: RuntimePack
  ) => string;
  endNavigationFeedback: () => void;
  render: () => void;
  setBrowserPath: (path: string) => void;
  state: ApplicationState;
};

export function createExplorerPageTransitionController({
  canonicalRouteForNode,
  endNavigationFeedback,
  render,
  setBrowserPath,
  state
}: ExplorerPageTransitionDependencies) {
  function clearPendingJob(): void {
    if (state.pendingJob?.intervalId) {
      window.clearInterval(state.pendingJob.intervalId);
    }
    state.pendingJob = null;
    endNavigationFeedback();
  }

  function enterReadyPage(page: RuntimePage): void {
    clearPendingJob();
    if (state.currentPage) {
      state.history.push({
        page: state.currentPage,
        nodeId: state.selectedNodeId
      });
    }
    state.currentPage = page;
    state.currentSceneId = page.sceneId;
    state.selectedNodeId = page.nodeId;
    state.detailOverride = null;
    const activePack = state.activePack;
    if (!activePack) {
      throw new Error(
        "Cannot enter a page without an active country pack."
      );
    }
    const detailNode =
      page.nodeId && page.nodeId !== activePack.rootNodeId
        ? activePack.nodes[page.nodeId]
        : null;
    state.detailPanelMode = detailNode
      ? "compact"
      : "hidden";
    if (page.nodeId) {
      setBrowserPath(
        canonicalRouteForNode(
          state.activeCountrySlug,
          page.nodeId,
          activePack
        )
      );
    }
    render();
  }

  return {
    clearPendingJob,
    enterReadyPage
  };
}
