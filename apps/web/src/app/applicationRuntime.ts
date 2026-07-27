// Typed browser composition root for the RoamAtlas application.
import { worldCountries } from "@roamatlas/data/countries.js";
import { APP_CONFIG } from "../config/appConfig.js";
import {
  apiPath,
  createBrowserFeedbackController,
  createRootPage,
  escapeHtml,
  fetchArtworkResource,
  setBrowserPath,
  toApiUrl,
  type LoadingJob,
  type LoadingPanelOptions,
  type RuntimePack,
  type RuntimePage
} from "./browserRuntime";
import type {
  AppRoute,
  ApplicationState,
  CountryShellNavigationOptions,
  CountrySummary,
  CuratedPlaceRoute,
  DraftPanelRenderer,
  DraftPhotoHydrator,
  ExplorerController,
  LoadingSceneBoardOptions,
  NavigationOptions,
  ScopedDraftMessage
} from "./applicationRuntimeTypes";
import { createCountryCatalog } from "../features/countryCatalog/countryCatalog.js";
import { createCountryDraftClient } from "../features/countryDraft/countryDraftClient.js";
import { createDraftChatView } from "../features/countryDraft/draftChatView.js";
import { createDraftMetadataRenderer } from "../features/countryDraft/draftMetadataView.js";
import { createCountryDraftPanelView } from "../features/countryDraft/countryDraftPanelView.js";
import { createDraftReferencePhotoView } from "../features/countryDraft/draftReferencePhotoView.js";
import { createDraftReviewView } from "../features/countryDraft/draftReviewView.js";
import {
  getDraftNodeAtPath,
  removeDraftNodeAtPath,
  reorderArray
} from "../features/countryDraft/draftTree";
import { renderCountryShellView } from "../features/countrySetup/countryShellView";
import { createCountryShellController } from "../features/countrySetup/countryShellController.js";
import { createCountryExperienceController } from "../features/countrySetup/countryExperienceController.js";
import { fetchExperienceConfig } from "../features/experience/experienceConfigClient.js";
import {
  imageQualityLabel,
  normalizeImageQuality
} from "../features/experience/imageQualityPolicy";
import {
  getArtworkFailureMessage,
  getPageArtworkCacheKey,
  getPageArtworkJobKey,
  getPageReadinessLabel,
  isArtworkJobFailed,
  isArtworkJobPending
} from "../features/artwork/artworkJobPolicy";
import { createArtworkController } from "../features/artwork/artworkController.js";
import { createExplorerClient } from "../features/explorer/explorerClient.js";
import { createExplorerController } from "../features/explorer/explorerController.js";
import {
  clamp,
  clamp01,
  getContainedImageRect
} from "../features/explorer/sceneGeometry";
import { renderExplorerDetailPanel } from "../features/explorer/detailPanel.js";
import {
  createDestinationNavigationView,
  renderRegionRailCheck
} from "../features/explorer/destinationNavigationView.js";
import {
  renderEnvironmentLayerNodes
} from "../features/explorer/environmentLayerRenderer.js";
import {
  environmentPlanNeedsTargetRecovery,
  isCurrentEnvironmentPlan,
  normalizeEnvironmentPlan
} from "../features/explorer/environmentPlanPolicy";
import { createPlaceImageClient } from "../features/placeImages/placeImageClient.js";
import { flushCountryRuntimeCache } from "../features/runtimeCache/runtimeCacheClient.js";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  ensureCountryPack,
  getCountryPack,
  initCountryPackRegistry,
  isConfiguredCountryPack,
  isSourceControlledCountryPack
} from "../data/countryPacks/index.js";
import { ROAMATLAS_EXPERIENCE_CONFIG } from "@roamatlas/data/experienceConfig.js";
import { generatedTiles } from "../data/generatedTiles.js";
import { factConfidenceLabel, hasUnconfirmedNodeFacts } from "@roamatlas/domain/guardrails.js";
import { buildLoadingStepTrail } from "@roamatlas/domain/loadingSteps.js";
import { resolveFlipbookClick } from "@roamatlas/domain/flipbookPage.js";
import { PLACE_IMAGE_SELECTION_VERSION } from "@roamatlas/domain/placeImageSelection.js";
import { listNextArtworkDestinations } from "@roamatlas/domain/nextArtworkDestinations.js";
import { createCountryPackStarterMap } from "@roamatlas/domain/countryDraft.js";
import {
  appendUnconfirmedRegionCandidates,
  isDraftItemApproved
} from "@roamatlas/domain/countryDraftReview.js";
import {
  canonicalRouteForNode,
  findSceneIdForNode,
  resolveAppRoute,
  routeForCountryConfig,
  routeForCountryLanding,
} from "@roamatlas/domain/routes.js";

const IMAGE_QUALITY_STORAGE_KEY = APP_CONFIG.storageKeys.imageQuality;
const countryDraftClient = createCountryDraftClient({
  fetchFn: (path, options) => fetch(apiPath(String(path)), options)
});
const placeImageClient = createPlaceImageClient({
  fetchFn: (path, options) => fetch(apiPath(String(path)), options)
});
const explorerClient = createExplorerClient({
  fetchFn: (path, options) => fetch(toApiUrl(String(path)), options)
});
const IMAGE_QUALITY_OPTIONS = APP_CONFIG.imageQuality.options;
const resolveRuntimeRoute = resolveAppRoute as unknown as (
  pathname: string,
  options: {
    countries: CountrySummary[];
    countryPacks: Record<string, RuntimePack>;
  }
) => AppRoute;
const buildBrowserLoadingStepTrail = ({
  job,
  pageTitle
}: {
  job: LoadingJob;
  pageTitle?: string;
}) => buildLoadingStepTrail({ job, pageTitle });

const state: ApplicationState = {
  currentView: "countries",
  selectedCountry: null,
  activeCountrySlug: DEFAULT_COUNTRY_SLUG,
  activePack: null,
  experienceConfig: { ...ROAMATLAS_EXPERIENCE_CONFIG },
  imageQuality: APP_CONFIG.imageQuality.defaultValue,
  countryQuery: "",
  countryDrafts: new Map(),
  countryDraftSectionTabs: new Map(),
  countryDraftGenAiOpen: new Map(),
  countryDraftToolMenuOpen: new Map(),
  countryDraftDrag: null,
  countryActionLegendOpen: new Map(),
  countryCacheFlushes: new Map(),
  placeImageRefreshes: new Map(),
  placeImageFeedbacks: new Map(),
  checkedStoredDrafts: new Set(),
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

const ARTWORK_POLL_INTERVAL_MS = APP_CONFIG.artwork.pollIntervalMs;
// High-quality gpt-image-2 requests can continue producing useful partials for
// more than three minutes. Keep the browser watching beyond the provider's
// longest quality-aware request window so healthy work is not reported as a
// terminal illustration failure.
const ARTWORK_POLL_TIMEOUT_MS = APP_CONFIG.artwork.pollTimeoutMs;
const ARTWORK_REQUEST_TIMEOUT_MS = APP_CONFIG.artwork.requestTimeoutMs;
const ARTWORK_POLL_MAX_ATTEMPTS = Math.ceil(ARTWORK_POLL_TIMEOUT_MS / ARTWORK_POLL_INTERVAL_MS);
// The config view is often kept alive by an embedded browser while a local
// dev server restarts. Give every page instance a distinct image URL so an
// old endpoint response cannot be painted into a newly rendered thumbnail.
const PLACE_IMAGE_REQUEST_SESSION = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ENVIRONMENT_PLAN_RETRY_DELAYS_MS = APP_CONFIG.environmentPlan.retryDelaysMs;
const ENVIRONMENT_PLAN_REQUEST_RETRY_MS = APP_CONFIG.environmentPlan.requestRetryMs;
const ENVIRONMENT_PLAN_SCHEMA_VERSION = APP_CONFIG.environmentPlan.schemaVersion;
const ENVIRONMENT_PLAN_PROMPT_VERSION = APP_CONFIG.environmentPlan.promptVersion;

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`RoamAtlas application shell is missing ${selector}.`);
  return element;
}

const elements = {
  landing: requireElement<HTMLElement>("#country-landing"),
  countryShell: requireElement<HTMLElement>("#country-shell"),
  countryGrid: requireElement<HTMLElement>("#country-grid"),
  countrySearch: requireElement<HTMLInputElement>("#country-search"),
  countryCount: requireElement<HTMLElement>("#country-count"),
  countryNotice: requireElement<HTMLElement>("#country-notice"),
  viewport: requireElement<HTMLElement>("#scroll-viewport"),
  sceneTitle: requireElement<HTMLElement>("#scene-title"),
  breadcrumb: requireElement<HTMLElement>("#breadcrumb"),
  stage: requireElement<HTMLElement>("#scroll-stage"),
  detailSheet: requireElement<HTMLElement>("#detail-sheet"),
  nodeDetail: requireElement<HTMLElement>("#node-detail"),
  countryButton: requireElement<HTMLButtonElement>("#country-button"),
  backButton: requireElement<HTMLButtonElement>("#back-button"),
  closeDetail: requireElement<HTMLButtonElement>("#close-detail")
};

const countryCatalog = createCountryCatalog({
  elements,
  worldCountries,
  getCountryPack,
  apiPath,
  config: APP_CONFIG.countryCatalog
});

let renderCountryDraftPanel: DraftPanelRenderer = () => "";
let hydrateDraftPlacePhotos: DraftPhotoHydrator = () => {};
let scopedDraftMessage: ScopedDraftMessage = (_target, instruction) => instruction;
const clearLoadingPanel = (): void => browserFeedbackController.clearLoadingPanel();
const clearPendingJob = (): void => browserFeedbackController.clearPendingJob();
const clearScrollStatus = (): void => browserFeedbackController.clearScrollStatus();
const enterReadyPage = (page: RuntimePage): void => browserFeedbackController.enterReadyPage(page);
const renderLoadingPanel = (options: LoadingPanelOptions): void => (
  browserFeedbackController.renderLoadingPanel(options)
);
const renderScrollStatus = (message: string): void => browserFeedbackController.renderScrollStatus(message);

const countryExperience = createCountryExperienceController({
  APP_CONFIG,
  IMAGE_QUALITY_OPTIONS,
  IMAGE_QUALITY_STORAGE_KEY,
  PLACE_IMAGE_REQUEST_SESSION,
  PLACE_IMAGE_SELECTION_VERSION,
  appendUnconfirmedRegionCandidates,
  apiPath,
  clamp01,
  clearCountryGeneratedState,
  countryCatalog,
  countryDraftClient,
  createCountryPackStarterMap,
  elements,
  ensureCountryPack,
  enterCountryLanding,
  enterCountryShell,
  enterMappedCountry,
  escapeHtml,
  explainClickError: (error: unknown) => explorerController.explainClickError(error),
  flushCountryRuntimeCache,
  getCountryPack,
  getDraftNodeAtPath,
  hydrateDraftPlacePhotos: (...args: unknown[]) => hydrateDraftPlacePhotos(...args),
  imageQualityLabel,
  isConfiguredCountryPack,
  isDraftItemApproved,
  isSourceControlledCountryPack,
  normalizeImageQuality,
  placeImageClient,
  removeDraftNodeAtPath,
  render,
  renderCountryDraftPanel: (...args: unknown[]) => renderCountryDraftPanel(...args),
  renderCountryShellView,
  renderRegionRailCheck,
  reorderArray,
  scopedDraftMessage: (target: unknown, instruction: string) => scopedDraftMessage(target, instruction),
  state
});

const {
  canOpenCountryExplorer,
  captureCountryShellScroll,
  deleteCurrentDraftItem,
  dismissAppToast,
  editUnconfirmedDraftCandidate,
  getDraftUiState,
  hasStoredImageQualityPreference,
  loadStoredCountryDraft,
  openDraftPhotoLightbox,
  renderCountryLanding,
  renderCountryShell,
  renderDraftButtonTooltip,
  renderGenAiIcon,
  renderResetIcon,
  reorderCurrentDraftItems,
  requestCountryDraft,
  requestCountryDraftApproval,
  requestCountryDraftConfirmation,
  requestCountryDraftInfluence,
  requestCountryRuntimeCacheFlush,
  requestPlaceImageReset,
  resetCountry,
  resetCountryAndOpenMap,
  restoreCountryShellScroll,
  scopeInstructionToCandidate,
  showAppToast,
  storeImageQualityPreference
} = countryExperience;

const renderDraftMetadata = createDraftMetadataRenderer({
  escapeHtml,
  renderTooltip: renderDraftButtonTooltip
});
const draftChatView = createDraftChatView({ escapeHtml });
const {
  getDraftEditModalContext,
  renderDraftEditModal
} = draftChatView;
scopedDraftMessage = draftChatView.scopedDraftMessage;
const { renderDraftConfirmation, renderDraftReview } = createDraftReviewView({ escapeHtml });
const draftReferencePhotoView = createDraftReferencePhotoView({
  buildPlaceImageUrl: countryExperience.buildPlaceImageUrl,
  clamp01,
  escapeHtml,
  renderReadyMark: renderRegionRailCheck
});
const { renderDraftPlacePhoto } = draftReferencePhotoView;
hydrateDraftPlacePhotos = draftReferencePhotoView.hydrateDraftPlacePhotos;
({ renderCountryDraftPanel } = createCountryDraftPanelView({
  escapeHtml,
  getDraftUiState,
  isConfiguredCountryPack,
  isDraftItemApproved,
  isSourceControlledCountryPack,
  renderDraftConfirmation,
  renderDraftEditModal,
  renderDraftMetadata,
  renderDraftPlacePhoto,
  renderDraftReview,
  getDraftEditModalContext,
  renderGenAiIcon,
  renderResetIcon,
  renderTooltip: renderDraftButtonTooltip
}));

state.imageQuality = countryExperience.loadImageQualityPreference();

const { bindCountryShell } = createCountryShellController({
  canOpenCountryExplorer,
  captureCountryShellScroll,
  clearCountryGeneratedState,
  deleteCurrentDraftItem,
  editUnconfirmedDraftCandidate,
  elements,
  ensureCountryPack,
  enterCountryLanding,
  enterMappedCountry,
  imageQualityLabel,
  normalizeImageQuality,
  openDraftPhotoLightbox,
  render,
  reorderCurrentDraftItems,
  requestCountryDraft,
  requestCountryDraftApproval,
  requestCountryDraftConfirmation,
  requestCountryDraftInfluence,
  requestCountryRuntimeCacheFlush,
  requestPlaceImageReset,
  resetCountry,
  resetCountryAndOpenMap,
  restoreCountryShellScroll,
  scopeInstructionToCandidate,
  showAppToast,
  showBootstrapError,
  state,
  storeImageQualityPreference
});

const artworkController = createArtworkController({
  APP_CONFIG,
  ARTWORK_POLL_INTERVAL_MS,
  ARTWORK_POLL_MAX_ATTEMPTS,
  ARTWORK_POLL_TIMEOUT_MS,
  ARTWORK_REQUEST_TIMEOUT_MS,
  apiPath,
  applyCurrentPageEnvironmentReference: (...args: unknown[]) => (
    explorerController.applyCurrentPageEnvironmentReference(...args)
  ),
  canCurrentPageUseSceneArtwork: (...args: unknown[]) => explorerController.canCurrentPageUseSceneArtwork(...args),
  clearLoadingPanel,
  clearPendingJob,
  createRootPage,
  elements,
  enterReadyPage,
  explainClickError: (error: unknown) => explorerController.explainClickError(error),
  explorerClient,
  fetchArtworkResource,
  fetchExperienceConfig,
  getArtworkFailureMessage,
  getCurrentRequestPage: (...args: unknown[]) => explorerController.getCurrentRequestPage(...args),
  getPageArtworkCacheKey,
  getPageArtworkJobKey,
  getPageEnvironmentUrl: (...args: unknown[]) => explorerController.getPageEnvironmentUrl(...args),
  hasStoredImageQualityPreference,
  isArtworkJobFailed,
  isArtworkJobPending,
  isRuntimeArtworkPage: (...args: unknown[]) => explorerController.isRuntimeArtworkPage(...args),
  listNextArtworkDestinations,
  normalizeImageQuality,
  preloadArtworkImage: (...args: unknown[]) => explorerController.preloadArtworkImage(...args),
  promoteCurrentPageEnvironmentPlan: (...args: unknown[]) => (
    explorerController.promoteCurrentPageEnvironmentPlan(...args)
  ),
  render,
  renderScene: () => explorerController.renderScene(),
  renderScrollStatus,
  requestEnvironmentPlan: (...args: unknown[]) => explorerController.requestEnvironmentPlan(...args),
  requestFlipbookPage: (...args: unknown[]) => explorerController.requestFlipbookPage(...args),
  resolveFlipbookClick,
  state,
  toApiUrl
});

const {
  getPrefetchReadinessLabel,
  invalidatePrefetchState,
  isArtworkTargetReady,
  loadExperienceConfig,
  mergePrefetchedArtwork,
  prefetchNextDestinations,
  renderImageGenerationPending,
  requestArtworkForCurrentPage,
  requestCurrentPageArtwork,
  requestSceneArtwork,
  retryArtwork,
  stopArtworkPoller
} = artworkController;

const explorerController = createExplorerController({
  APP_CONFIG,
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_REQUEST_RETRY_MS,
  ENVIRONMENT_PLAN_RETRY_DELAYS_MS,
  ENVIRONMENT_PLAN_SCHEMA_VERSION,
  apiPath,
  canonicalRouteForNode,
  clamp,
  clamp01,
  clearLoadingPanel,
  clearPendingJob,
  clearScrollStatus,
  elements,
  enterReadyPage,
  environmentPlanNeedsTargetRecovery,
  escapeHtml,
  explorerClient,
  factConfidenceLabel,
  fetchArtworkResource,
  findSceneIdForNode,
  generatedTiles,
  getArtworkFailureMessage,
  getContainedImageRect,
  getPageArtworkCacheKey,
  getPageArtworkJobKey,
  getPageReadinessLabel,
  hasUnconfirmedNodeFacts,
  isArtworkJobPending,
  isArtworkTargetReady,
  isCurrentEnvironmentPlan,
  listNextArtworkDestinations,
  mergePrefetchedArtwork,
  normalizeEnvironmentPlan,
  prefetchNextDestinations,
  render,
  renderEnvironmentLayerNodes,
  renderExplorerDetailPanel,
  renderImageGenerationPending,
  renderLoadingPanel,
  renderLoadingSceneBoard: (options: LoadingSceneBoardOptions) => renderLoadingSceneBoard(options),
  renderRegionRail: (
    scene: unknown,
    nodes: Record<string, unknown>,
    targets: unknown[]
  ) => renderRegionRail(scene, nodes, targets),
  renderScrollStatus,
  requestArtworkForCurrentPage,
  requestCurrentPageArtwork,
  requestSceneArtwork,
  resolveFlipbookClick,
  setBrowserPath,
  state,
  toApiUrl
}) as unknown as ExplorerController;

const {
  bindPageClick,
  cancelPendingNavigation,
  clearEnvironmentState,
  endNavigationFeedback,
  explainClickError,
  renderNodeDetail,
  renderDetour,
  renderScene,
  resolveOverlayTarget,
  scheduleSceneImageOverlayLayout
} = explorerController;

const browserFeedbackController = createBrowserFeedbackController({
  buildLoadingStepTrail: buildBrowserLoadingStepTrail,
  canonicalRouteForNode,
  elements,
  endNavigationFeedback,
  render,
  state
});

const { renderLoadingSceneBoard, renderRegionRail } = createDestinationNavigationView({
  buildLoadingStepTrail,
  clamp01,
  enterCountryShell,
  escapeHtml,
  getArtworkFailureMessage,
  getExplorerState: () => state,
  getPrefetchReadinessLabel,
  isArtworkJobFailed,
  isArtworkJobPending,
  isArtworkTargetReady,
  resolveOverlayTarget,
  retryArtwork,
  worldCountries
});

bootstrap();

window.addEventListener("popstate", () => {
  cancelPendingNavigation();
  applyRouteFromLocation().catch(showBootstrapError);
});

window.addEventListener("resize", scheduleSceneImageOverlayLayout);

elements.countryButton.addEventListener("click", () => {
  enterCountryLanding();
});

elements.backButton.addEventListener("click", () => {
  clearPendingJob();
  cancelPendingNavigation();
  const previous = state.history.pop();
  if (!previous?.page || !state.activePack) return;
  state.currentPage = previous.page;
  state.currentSceneId = previous.page.sceneId;
  state.selectedNodeId = previous.nodeId;
  const previousNodeId = previous.page.nodeId ?? state.activePack.rootNodeId;
  setBrowserPath(
    canonicalRouteForNode(state.activeCountrySlug, previousNodeId, state.activePack),
    { replace: true }
  );
  render();
});

elements.closeDetail.addEventListener("click", () => {
  state.detailOverride = null;
  state.detailPanelMode = "hidden";
  renderNodeDetail();
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest("[data-dismiss-app-toast]")) return;
  dismissAppToast();
});

elements.detailSheet.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const action = event.target.closest<HTMLElement>("[data-detail-action]")?.dataset.detailAction;
  if (action === "expand") {
    state.detailPanelMode = "expanded";
    renderNodeDetail();
    return;
  }
  if (action === "collapse") {
    state.detailPanelMode = "compact";
    renderNodeDetail();
  }
});

function render(): void {
  const focusKey = captureExplorerFocusKey();
  const isCountryLanding = state.currentView === "countries";
  const isCountryShell = state.currentView === "country";
  elements.landing.classList.toggle("is-hidden", !isCountryLanding);
  elements.countryShell.classList.toggle("is-hidden", !isCountryShell);
  elements.viewport.classList.toggle("is-hidden", isCountryLanding || isCountryShell);

  if (isCountryLanding) {
    renderCountryLanding();
    return;
  }

  if (isCountryShell) {
    renderCountryShell();
    return;
  }

  if (!state.activePack) {
    elements.countryCount.textContent = "Loading country…";
    return;
  }

  renderScene();
  renderNodeDetail();
  if (state.routeNotice) {
    renderDetour(state.routeNotice);
  }
  elements.backButton.disabled = state.history.length === 0;
  elements.viewport.classList.toggle("is-busy", state.isResolvingClick || Boolean(state.pendingJob));
  restoreExplorerFocus(focusKey);
}

function captureExplorerFocusKey(): string | null {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !elements.viewport.contains(activeElement)) return null;
  return activeElement.dataset.roamFocusKey ?? null;
}

function restoreExplorerFocus(focusKey: string | null): void {
  if (!focusKey) return;
  const target = [...elements.viewport.querySelectorAll<HTMLElement>("[data-roam-focus-key]")]
    .find((element) => element.dataset.roamFocusKey === focusKey);
  target?.focus({ preventScroll: true });
}

function bindCountryLanding(): void {
  elements.countrySearch.addEventListener("input", (event) => {
    state.countryQuery = (event.currentTarget as HTMLInputElement).value;
    renderCountryLanding();
  });

  elements.countryGrid.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const cardAction = event.target.closest<HTMLElement>("[data-country-card-action]");
    const card = event.target.closest<HTMLElement>("[data-country-code]");
    if (!card) return;
    const country = worldCountries.find((item) => item.code === card.dataset.countryCode);
    if (!country) return;

    if (event.target.closest(".country-card-menu") && !cardAction) {
      return;
    }

    if (cardAction) {
      const action = cardAction.dataset.countryCardAction;
      if (action === "config") {
        enterCountryShell(country);
        return;
      }
      if (action === "open") {
        openCountryFromLanding(country);
        return;
      }
    }

    openCountryFromLanding(country);
  });
}

function openCountryFromLanding(country: CountrySummary): void {
  if (isConfiguredCountryPack(country.slug)) {
    ensureCountryPack(country.slug)
      .then((pack) => enterMappedCountry(pack))
      .catch(showBootstrapError);
    return;
  }
  enterCountryShell(country);
}

function clearCountryGeneratedState(countrySlug: string): void {
  const pack = getCountryPack(countrySlug);
  clearPendingJob();
  cancelPendingNavigation();
  for (const artworkJobKey of [...state.artworkJobs.keys()]) {
    stopArtworkPoller(artworkJobKey);
  }
  state.artworkJobs.clear();
  state.artworkByScene.clear();
  state.artworkByPage.clear();
  state.artworkImageLoads.clear();
  invalidatePrefetchState();
  clearEnvironmentState(countrySlug);
  if (state.currentPage?.countrySlug === countrySlug) {
    state.currentPage = {
      ...state.currentPage,
      imageUrl: null,
      environmentUrl: null,
      artworkDecoded: false
    };
  }
  if (!pack) return;
}

function enterMappedCountry(
  pack: RuntimePack | null,
  { updateUrl = true, shouldRender = true }: NavigationOptions = {}
): void {
  if (!pack) return;
  clearPendingJob();
  cancelPendingNavigation();
  invalidatePrefetchState();
  state.currentView = "explorer";
  state.activeCountrySlug = pack.countrySlug;
  state.activePack = pack;
  state.selectedCountry = null;
  state.currentPage = createRootPage(pack);
  state.currentSceneId = pack.overviewSceneId;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(`/${pack.countrySlug}`);
  if (shouldRender) render();
}

function enterCountryShell(
  country: CountrySummary,
  {
    updateUrl = true,
    shouldRender = true,
    replaceUrl = false
  }: CountryShellNavigationOptions = {}
): void {
  clearPendingJob();
  cancelPendingNavigation();
  invalidatePrefetchState();
  state.currentView = "country";
  state.selectedCountry = country;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(routeForCountryConfig(country), { replace: replaceUrl });
  if (shouldRender) render();
  loadStoredCountryDraft(country);
}

function enterCuratedPlace(
  { countrySlug, nodeId, pack }: CuratedPlaceRoute,
  { updateUrl = true, shouldRender = true }: NavigationOptions = {}
): void {
  cancelPendingNavigation();
  invalidatePrefetchState();
  const node = pack?.nodes[nodeId];
  if (!node) {
    if (pack) enterMappedCountry(pack, { updateUrl: false, shouldRender: false });
    state.routeNotice = {
      confidence: "unconfirmed",
      title: "Unknown RoamAtlas node",
      message: `${nodeId} is not mapped in RoamAtlas' verified ${pack?.title ?? countrySlug} graph.`
    };
    if (shouldRender) render();
    return;
  }

  const sceneId = findSceneIdForNode({ nodeId, nodes: pack.nodes, scenes: pack.scenes });
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
      factMode: hasUnconfirmedNodeFacts(node) ? "unconfirmed" : "verified"
    }
  };
  state.selectedNodeId = nodeId === pack.rootNodeId ? null : nodeId;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(canonicalRouteForNode(countrySlug, nodeId, pack));
  if (shouldRender) render();
}

async function applyRouteFromLocation(
  { shouldRender = true }: Pick<NavigationOptions, "shouldRender"> = {}
): Promise<void> {
  let route = resolveRuntimeRoute(window.location.pathname, {
    countries: worldCountries,
    countryPacks: countryPacks as Record<string, RuntimePack>
  }) as AppRoute;

  if (
    route.type === "country_overview" ||
    route.type === "curated_place" ||
    route.type === "invalid_place"
  ) {
    const pack = await ensureCountryPack(route.countrySlug);
    route = resolveRuntimeRoute(window.location.pathname, {
      countries: worldCountries,
      countryPacks: (pack
        ? { ...countryPacks, [route.countrySlug]: pack }
        : countryPacks) as Record<string, RuntimePack>
    }) as AppRoute;
  }

  if (route.type === "country_landing") {
    enterCountryLanding({ updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "country_overview") {
    enterMappedCountry(route.pack, { updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "curated_place") {
    enterCuratedPlace(route, { updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "invalid_place") {
    enterMappedCountry(route.pack, { updateUrl: false, shouldRender: false });
    state.routeNotice = {
      confidence: "unconfirmed",
      title: "Unknown RoamAtlas node",
      message: `${route.nodeId} is not mapped in RoamAtlas' verified ${route.pack.title} graph.`
    };
    if (shouldRender) render();
    return;
  }

  if (route.type === "country_config") {
    enterCountryShell(route.country, { updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "country_needs_config") {
    enterCountryShell(route.country, { updateUrl: true, shouldRender, replaceUrl: true });
    return;
  }

  enterCountryLanding({ updateUrl: false, shouldRender: false });
  if (shouldRender) render();
}

async function bootstrap(): Promise<void> {
  bindCountryLanding();
  bindCountryShell();
  bindPageClick();
  state.currentView = "countries";
  renderCountryLanding();

  try {
    await initCountryPackRegistry();
    await applyRouteFromLocation({ shouldRender: false });
    render();
    loadExperienceConfig();
  } catch (error) {
    showBootstrapError(error);
  }
}

function showBootstrapError(error: unknown): void {
  elements.countryCount.textContent = "Could not load RoamAtlas";
  elements.countryNotice.classList.add("is-open");
  elements.countryNotice.textContent = explainClickError(error);
}

function enterCountryLanding(
  { updateUrl = true, shouldRender = true }: NavigationOptions = {}
): void {
  clearPendingJob();
  cancelPendingNavigation();
  invalidatePrefetchState();
  state.currentView = "countries";
  state.selectedCountry = null;
  state.selectedNodeId = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(routeForCountryLanding());
  if (shouldRender) render();
}
