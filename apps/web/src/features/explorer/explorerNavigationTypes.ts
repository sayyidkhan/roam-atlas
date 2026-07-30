import type {
  FlipbookClick as DomainFlipbookClick,
  FlipbookResult as DomainFlipbookResult,
  ResolveFlipbookClickInput
} from "@roamatlas/domain/flipbookPage.js";
import type {
  RuntimePack
} from "../../app/browserRuntime";
import type {
  ExplorerClientRect,
  ImageClick,
  NormalizedPoint
} from "./explorerPageClickAdapter";
import type {
  CachedArtwork,
  ExplorerPage
} from "./explorerNavigationPagePolicy";

export type ExplorerNavigationState = {
  activeCountrySlug: string;
  activeNavigationRequestId: number | string | null;
  activePack: RuntimePack | null;
  artworkByPage: Map<string, CachedArtwork>;
  artworkByScene: Map<string, CachedArtwork>;
  currentPage: ExplorerPage | null;
  currentSceneId: string | null;
  environmentPlans: Map<string, EnvironmentPlan>;
  imageQuality: string;
  isResolvingClick: boolean;
};

export type EnvironmentPlan = {
  status?: string;
  targets?: unknown[];
  [key: string]: unknown;
};

export type OverlayTarget = {
  detourPhrase?: string | null;
  nodeId?: string | null;
  normalizedClick?: NormalizedPoint;
};

export type FlipbookResult = {
  click?:
    | (Partial<DomainFlipbookClick> &
        Record<string, unknown>)
    | undefined;
  page: ExplorerPage;
  [key: string]: unknown;
};

export type { ResolveFlipbookClickInput };

export type RequestFlipbookPageOptions = {
  detourPhrase?: string | null;
  imageClick?: ImageClick | null;
  normalizedClick: NormalizedPoint;
  signal?: AbortSignal;
  targetNodeId?: string | null;
};

export type ExplorerNavigationDependencies = {
  canonicalRouteForNode: (
    countrySlug: string,
    nodeId: string,
    pack: RuntimePack
  ) => string;
  clamp: (
    value: number,
    minimum: number,
    maximum: number
  ) => number;
  clamp01: (value: number) => number;
  clearLoadingPanel: () => void;
  elements: {
    stage: HTMLElement;
    viewport: HTMLElement;
  };
  enterReadyPage: (page: ExplorerPage) => void;
  explorerClient: {
    resolveFlipbookClick: (
      payload: Record<string, unknown>,
      options: { signal?: AbortSignal }
    ) => Promise<FlipbookResult>;
  };
  getContainedImageRect: (
    image: HTMLImageElement
  ) => ExplorerClientRect;
  getPageArtworkCacheKey: (
    page: ExplorerPage | null
  ) => string;
  getPageEnvironmentUrl: (
    page: ExplorerPage | null | undefined
  ) => string | null;
  mergePrefetchedArtwork: (
    page: ExplorerPage
  ) => ExplorerPage;
  publishExplorerChromeState: () => void;
  renderDetour: (detour: {
    confidence: string;
    message: string;
    title: string;
  }) => void;
  renderImageGenerationPending: (
    page: ExplorerPage,
    result: FlipbookResult
  ) => void;
  renderLoadingPanel: (options: {
    fallbackMessage: string;
    pageTitle: string;
  }) => void;
  renderTransientScrollStatus: (message: string) => void;
  requestEnvironmentPlan: (
    environmentUrl: string | null | undefined
  ) => void | Promise<void>;
  resolveFlipbookClick: (
    input: ResolveFlipbookClickInput
  ) => DomainFlipbookResult;
  setBrowserPath: (path: string) => void;
  state: ExplorerNavigationState;
};
