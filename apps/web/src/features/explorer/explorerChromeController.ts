import type {
  ApplicationState
} from "../../app/applicationRuntimeTypes";
import type { RuntimePack } from "../../app/browserRuntime";
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
  let breadcrumb = "Curated facts. Generated-style visuals.";

  function publish(): void {
    explorerChromeStore.getState().setSnapshot({
      backDisabled: state.history.length === 0,
      breadcrumb,
      commands: {
        back,
        countries: enterCountryLanding
      },
      isBusy: state.isResolvingClick,
      isVisible: state.currentView === "explorer",
      title
    });
  }

  function publishContent(content: {
    breadcrumb: string;
    title: string;
  }): void {
    title = content.title;
    breadcrumb = content.breadcrumb;
    publish();
  }

  function back(): void {
    clearPendingJob();
    cancelPendingNavigation();
    const previous = state.history.pop();
    if (!previous?.page || !state.activePack) {
      publish();
      return;
    }
    state.currentPage = previous.page;
    state.currentSceneId = previous.page.sceneId;
    state.selectedNodeId = previous.nodeId;
    const previousNodeId =
      previous.page.nodeId ?? state.activePack.rootNodeId;
    setBrowserPath(
      canonicalRouteForNode(
        state.activeCountrySlug,
        previousNodeId,
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
