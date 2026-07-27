import type {
  BrowserFeedbackState,
  RuntimePack,
  RuntimePage
} from "./browserRuntime";

export type CountrySummary = {
  code: string;
  name: string;
  slug: string;
  [key: string]: unknown;
};

export type RouteNotice = {
  confidence: string;
  title: string;
  message: string;
};

export type ApplicationState = BrowserFeedbackState & {
  currentView: "countries" | "country" | "explorer";
  selectedCountry: CountrySummary | null;
  experienceConfig: BrowserFeedbackState["experienceConfig"] & Record<string, boolean | number>;
  imageQuality: string;
  countryQuery: string;
  countryDrafts: Map<string, unknown>;
  countryDraftSectionTabs: Map<string, unknown>;
  countryDraftGenAiOpen: Map<string, unknown>;
  countryDraftToolMenuOpen: Map<string, unknown>;
  countryDraftDrag: unknown;
  countryActionLegendOpen: Map<string, unknown>;
  countryCacheFlushes: Map<string, unknown>;
  placeImageRefreshes: Map<string, unknown>;
  placeImageFeedbacks: Map<string, unknown>;
  checkedStoredDrafts: Set<string>;
  artworkJobs: Map<string, unknown>;
  artworkByScene: Map<string, unknown>;
  artworkByPage: Map<string, unknown>;
  prefetchRequests: Set<string>;
  prefetchJobs: Map<string, unknown>;
  prefetchSceneId: string | null;
  environmentPlans: Map<string, unknown>;
  environmentPlanRequests: Map<string, unknown>;
  environmentPlanPromotions: Map<string, unknown>;
  artworkImageLoads: Map<string, unknown>;
  isResolvingClick: boolean;
  activeNavigationRequestId: string | number | null;
  routeNotice: RouteNotice | null;
};

export type AppRoute =
  | { type: "country_landing" }
  | { type: "country_overview"; countrySlug: string; country: CountrySummary; pack: RuntimePack }
  | { type: "curated_place"; countrySlug: string; nodeId: string; pack: RuntimePack }
  | { type: "invalid_place"; countrySlug: string; nodeId: string; pack: RuntimePack }
  | { type: "country_unmapped_place"; countrySlug: string; nodeId: string }
  | { type: "country_config"; countrySlug: string; country: CountrySummary; pack: RuntimePack | null }
  | { type: "country_needs_config"; countrySlug: string; country: CountrySummary }
  | { type: "unknown_country"; slug: string };

export type NavigationOptions = {
  updateUrl?: boolean;
  shouldRender?: boolean;
};

export type CountryShellNavigationOptions = NavigationOptions & {
  replaceUrl?: boolean;
};

export type CuratedPlaceRoute = {
  countrySlug: string;
  nodeId: string;
  pack: RuntimePack;
};

export type RuntimeCallback = (...args: unknown[]) => unknown;

export type LoadingSceneBoardOptions = {
  scene: unknown;
  nodes: Record<string, unknown>;
  targets: unknown[];
  pageTitle: string;
  artworkJobKey: string;
  isArtworkPending: boolean;
};

export type LoadingSceneBoardRenderer = (options: LoadingSceneBoardOptions) => HTMLElement;
export type RegionRailRenderer = (
  scene: unknown,
  nodes: Record<string, unknown>,
  targets: unknown[]
) => HTMLElement;

export type ExplorerController = {
  applyCurrentPageEnvironmentReference: RuntimeCallback;
  bindPageClick: () => void;
  cancelPendingNavigation: () => void;
  canCurrentPageUseSceneArtwork: RuntimeCallback;
  clearEnvironmentState: (countrySlug: string) => void;
  computeImageClick: RuntimeCallback;
  endNavigationFeedback: () => void;
  explainClickError: (error: unknown) => string;
  getCurrentRequestPage: RuntimeCallback;
  getPageEnvironmentUrl: RuntimeCallback;
  isRuntimeArtworkPage: RuntimeCallback;
  preloadArtworkImage: RuntimeCallback;
  promoteCurrentPageEnvironmentPlan: RuntimeCallback;
  renderNodeDetail: () => void;
  renderDetour: (notice: RouteNotice) => void;
  renderScene: () => void;
  requestEnvironmentPlan: RuntimeCallback;
  requestFlipbookPage: RuntimeCallback;
  resolveOverlayTarget: RuntimeCallback;
  runFlipbookResult: RuntimeCallback;
  scheduleSceneImageOverlayLayout: () => void;
};

export type DraftPanelRenderer = (...args: unknown[]) => string;
export type DraftPhotoHydrator = (...args: unknown[]) => void;
export type ScopedDraftMessage = (target: unknown, instruction: string) => string;
export type RuntimeHistoryEntry = {
  page: RuntimePage;
  nodeId: string | null;
};
