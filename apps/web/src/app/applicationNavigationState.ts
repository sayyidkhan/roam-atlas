import type {
  ApplicationState,
  CountrySummary,
  CuratedPlaceRoute
} from "./applicationRuntimeTypes";
import type {
  RootPage,
  RuntimeNode,
  RuntimePack
} from "./browserRuntime";

export function activateCountryLanding(
  state: ApplicationState
): void {
  state.currentView = "countries";
  state.selectedCountry = null;
  state.selectedNodeId = null;
  state.routeNotice = null;
}

export function activateMappedCountry(
  state: ApplicationState,
  pack: RuntimePack,
  rootPage: RootPage
): void {
  state.currentView = "explorer";
  state.activeCountrySlug = pack.countrySlug;
  state.activePack = pack;
  state.selectedCountry = null;
  state.currentPage = rootPage;
  state.currentSceneId = pack.overviewSceneId;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
}

export function activateCountryShell(
  state: ApplicationState,
  country: CountrySummary
): void {
  state.currentView = "country";
  state.selectedCountry = country;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
}

export function activateCuratedPlace(
  state: ApplicationState,
  { countrySlug, nodeId, pack }: CuratedPlaceRoute,
  dependencies: {
    findSceneIdForNode: (input: {
      nodeId: string;
      nodes: RuntimePack["nodes"];
      scenes: RuntimePack["scenes"];
    }) => string | null;
    hasUnconfirmedNodeFacts: (node: RuntimeNode) => boolean;
  }
): boolean {
  const node = pack.nodes[nodeId];
  if (!node) return false;
  const sceneId = dependencies.findSceneIdForNode({
    nodeId,
    nodes: pack.nodes,
    scenes: pack.scenes
  });
  state.currentView = "explorer";
  state.activeCountrySlug = countrySlug;
  state.activePack = pack;
  state.selectedCountry = null;
  state.currentSceneId = sceneId;
  state.currentPage = {
    id: nodeId === pack.rootNodeId ? "root" : `node-${nodeId}`,
    countrySlug,
    sceneId,
    nodeId,
    imageUrl: null,
    parentId: null,
    parentClick: null,
    status: "ready",
    plan: {
      title: node.title,
      factMode: dependencies.hasUnconfirmedNodeFacts(node)
        ? "unconfirmed"
        : "verified"
    }
  };
  state.selectedNodeId =
    nodeId === pack.rootNodeId ? null : nodeId;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  return true;
}
