import type { ApplicationState } from "./applicationRuntimeTypes";

type ApplicationStateOptions = {
  defaultCountrySlug: string;
  defaultImageQuality: string;
  experienceConfig: ApplicationState["experienceConfig"];
};

export function createApplicationState({
  defaultCountrySlug,
  defaultImageQuality,
  experienceConfig
}: ApplicationStateOptions): ApplicationState {
  return {
    currentView: "countries",
    selectedCountry: null,
    activeCountrySlug: defaultCountrySlug,
    activePack: null,
    experienceConfig: { ...experienceConfig },
    imageQuality: defaultImageQuality,
    currentPage: null,
    currentSceneId: null,
    selectedNodeId: null,
    detailPanelMode: "hidden",
    detailOverride: null,
    history: [],
    pendingJob: null,
    artworkJobs: new Map(),
    artworkByScene: new Map(),
    artworkByPage: new Map(),
    prefetchRequests: new Set(),
    prefetchJobs: new Map(),
    prefetchSceneId: null,
    environmentPlans: new Map(),
    environmentPlanRequests: new Map(),
    environmentPlanPromotions: new Map(),
    artworkImageLoads: new Map(),
    isResolvingClick: false,
    activeNavigationRequestId: null,
    routeNotice: null
  };
}
