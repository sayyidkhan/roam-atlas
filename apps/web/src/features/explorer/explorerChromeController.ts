import type {
  ApplicationState
} from "../../app/applicationRuntimeTypes";
import type { RuntimePack } from "../../app/browserRuntime";
import {
  buildExplorerBreadcrumbs
} from "./explorerBreadcrumbPolicy";
import { explorerChromeStore } from "./explorerChromeStore";

type ExplorerChromeControllerDependencies = {
  cancelPendingNavigation: () => void;
  canonicalRouteForNode: (
    countrySlug: string,
    nodeId: string,
    pack: RuntimePack
  ) => string;
  clearPendingJob: () => void;
  enterCountryLanding: () => void;
  render: () => void;
  setBrowserPath: (
    path: string,
    options?: { replace?: boolean }
  ) => void;
  state: ApplicationState;
};

export function createExplorerChromeController({
  cancelPendingNavigation,
  canonicalRouteForNode,
  clearPendingJob,
  enterCountryLanding,
  render,
  setBrowserPath,
  state
}: ExplorerChromeControllerDependencies) {
  let title = "Country Overview Scroll";

  function publish(): void {
    explorerChromeStore.getState().setSnapshot({
      backDisabled: state.currentView !== "explorer",
      breadcrumbs: buildExplorerBreadcrumbs({
        currentNodeId: state.currentPage?.nodeId,
        pack: state.activePack
      }),
      commands: {
        back,
        countries: enterCountryLanding,
        openBreadcrumb
      },
      isBusy: state.isResolvingClick,
      isVisible: state.currentView === "explorer",
      title
    });
  }

  function publishContent(content: { title: string }): void {
    title = content.title;
    publish();
  }

  function back(): void {
    clearPendingJob();
    cancelPendingNavigation();
    const previous = state.history.pop();
    if (!previous?.page || !state.activePack) {
      const parent = buildExplorerBreadcrumbs({
        currentNodeId: state.currentPage?.nodeId,
        pack: state.activePack
      }).at(-1);
      if (parent) {
        openBreadcrumb(parent.nodeId);
        return;
      }
      enterCountryLanding();
      return;
    }
    restoreHistoryEntry(previous, state.history);
  }

  function openBreadcrumb(nodeId: string): void {
    if (!state.activePack?.nodes[nodeId]) return;
    clearPendingJob();
    cancelPendingNavigation();
    const historyIndex = state.history.findIndex(
      (entry) => entry.page?.nodeId === nodeId
    );
    if (historyIndex >= 0) {
      const entry = state.history[historyIndex];
      if (entry?.page) {
        restoreHistoryEntry(
          { page: entry.page, nodeId: entry.nodeId },
          state.history.slice(0, historyIndex)
        );
      }
      return;
    }
    setBrowserPath(
      canonicalRouteForNode(
        state.activeCountrySlug,
        nodeId,
        state.activePack
      )
    );
  }

  function restoreHistoryEntry(
    entry: NonNullable<ApplicationState["history"][number]>,
    remainingHistory: ApplicationState["history"]
  ): void {
    if (!entry.page || !state.activePack) return;
    state.history = remainingHistory;
    state.currentPage = entry.page;
    state.currentSceneId = entry.page.sceneId;
    state.selectedNodeId = entry.nodeId;
    state.detailOverride = null;
    const nodeId = entry.page.nodeId;
    state.detailPanelMode =
      nodeId && nodeId !== state.activePack.rootNodeId
        ? "compact"
        : "hidden";
    setBrowserPath(
      canonicalRouteForNode(
        state.activeCountrySlug,
        nodeId ?? state.activePack.rootNodeId,
        state.activePack
      ),
      { replace: true }
    );
    render();
  }

  return {
    publishContent,
    publishState: publish
  };
}
