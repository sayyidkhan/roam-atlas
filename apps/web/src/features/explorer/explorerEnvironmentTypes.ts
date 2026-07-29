export type EnvironmentPlan = {
  layers?: unknown[];
  retryAt?: number;
  status?: string;
  targets?: unknown[];
  version?: string;
  [key: string]: unknown;
};

export type ExplorerEnvironmentPage = {
  environmentStatus?: string;
  environmentUrl?: string | null;
  generated?: {
    environmentStatus?: string;
    environmentUrl?: string | null;
    [key: string]: unknown;
  };
  id?: string;
  imageUrl?: string | null;
  nodeId?: string | null;
  sceneId?: string | null;
  [key: string]: unknown;
};

export type ExplorerEnvironmentNode = {
  childIds?: string[];
  [key: string]: unknown;
};

export type ExplorerEnvironmentScene = {
  id: string;
  rootNodeId: string;
  [key: string]: unknown;
};

export type EnvironmentArtworkCache = {
  environmentUrl?: string | null;
  page?: ExplorerEnvironmentPage;
  [key: string]: unknown;
};

export type ExplorerEnvironmentState = {
  activeCountrySlug: string;
  activePack: {
    nodes: Record<string, ExplorerEnvironmentNode>;
    scenes: Record<string, ExplorerEnvironmentScene>;
  } | null;
  artworkByPage: Map<string, EnvironmentArtworkCache>;
  artworkByScene: Map<string, EnvironmentArtworkCache>;
  currentPage: ExplorerEnvironmentPage | null;
  currentView: string;
  environmentPlanPromotions: Map<string, Promise<void>>;
  environmentPlanRequests: Map<string, Promise<void>>;
  environmentPlans: Map<string, EnvironmentPlan>;
  imageQuality: string;
};

export type EnvironmentControllerDependencies = {
  ENVIRONMENT_PLAN_REQUEST_RETRY_MS: number;
  ENVIRONMENT_PLAN_RETRY_DELAYS_MS: readonly number[];
  ENVIRONMENT_PLAN_SCHEMA_VERSION: string;
  apiPath: (path: string) => string;
  environmentPlanNeedsTargetRecovery: (
    plan: EnvironmentPlan,
    page: ExplorerEnvironmentPage | null,
    nodes?: Record<string, ExplorerEnvironmentNode>
  ) => boolean;
  explorerClient: {
    getEnvironmentPlan: (
      environmentUrl: string
    ) => Promise<EnvironmentPlan>;
  };
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  getCurrentRequestPage: () => ExplorerEnvironmentPage | null;
  getPageArtworkCacheKey: (
    page: ExplorerEnvironmentPage | null
  ) => string;
  isCurrentEnvironmentPlan: (
    plan: EnvironmentPlan
  ) => boolean;
  normalizeEnvironmentPlan: (
    plan: EnvironmentPlan
  ) => EnvironmentPlan;
  render: () => void;
  state: ExplorerEnvironmentState;
};
