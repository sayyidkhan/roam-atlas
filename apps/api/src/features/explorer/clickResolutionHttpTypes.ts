import type {
  FlipbookClick,
  FlipbookPoint,
  FlipbookResult,
  ResolveFlipbookClickInput
} from "@roamatlas/domain/flipbookPage.js";
import type {
  CompiledCountryPack
} from "../../data/countryPacks/serverRegistry.ts";
import type {
  ClickPhraseRequest,
  ClickPhraseResult,
  ImageClick
} from "./openAIClickResolver.ts";
import type {
  SemanticRegion,
  VlmResult
} from "./semanticRegionPolicy.ts";

export type ExplorerClickPage =
  ResolveFlipbookClickInput["currentPage"] &
  Record<string, unknown> & {
    id?: string;
    status?: string;
  };

export type FlipbookClickBody = {
  currentPage: ExplorerClickPage;
  detourPhrase?: string | null;
  imageClick?: ImageClick | null;
  imageQuality?: string;
  normalizedClick: FlipbookPoint;
  targetNodeId?: string | null;
};

export type ExplorerResultPage = {
  assetVersion?: string;
  countryName?: string;
  countrySlug?: string;
  environmentUrl?: string | null;
  generated?: unknown;
  id?: string;
  imageUrl?: string | null;
  nodeId?: string | null;
  parentClick?: FlipbookPoint | null;
  parentId?: string | null;
  partialImageUrl?: string | null;
  plan?: unknown;
  sceneId?: string | null;
  status: string;
};

export type ExplorerClickResult = {
  click: Partial<FlipbookClick> & {
    status: string;
  };
  page: ExplorerResultPage;
  semanticCache?: SemanticRegion;
  vlm?: {
    confidence: string | null;
    fallbackReason: string | null;
    imageMarked: boolean | null;
    matchedNodeId: string | null;
    phrase: string | null;
    reason: string | null;
    status: string;
  };
};

type VlmPhraseMatch = {
  confidence: string;
  nodeId: string | null;
  status: string;
};

export type ClickResolutionRouteDependencies = {
  handleFlipbookClick: (request: Request) => Promise<Response>;
  handleResolveClick: (request: Request) => Promise<Response>;
};

export type ResolveClickHttpDependencies = {
  defaultCountrySlug: string;
  request: Request;
  resolveClickPhrase: (
    request: ClickPhraseRequest
  ) => Promise<ClickPhraseResult>;
};

export type FlipbookClickHttpDependencies = {
  appendSemanticRegionFromResult: (input: {
    currentPage: ExplorerClickPage;
    normalizedClick: FlipbookPoint;
    result: ExplorerClickResult;
    vlm: ClickPhraseResult;
  }) => Promise<void>;
  attachArtwork: (
    page: ExplorerResultPage,
    pack: CompiledCountryPack,
    imageQuality?: string
  ) => Promise<ExplorerResultPage>;
  centerOfBox: (
    box: SemanticRegion["bbox"] | null | undefined
  ) => FlipbookPoint | null;
  createUnresolvedClickResult: (input: {
    currentPage: ExplorerClickPage;
    normalizedClick: FlipbookPoint;
    vlm: VlmResult;
  }) => ExplorerClickResult;
  getCountryPackForPage: (
    page: ExplorerClickPage
  ) => CompiledCountryPack;
  getCountrySlugForPage: (
    page: ExplorerClickPage
  ) => string;
  hasRuntimeGeneratedPage: (
    page: ExplorerClickPage
  ) => boolean;
  matchVlmPhraseForCurrentPage: (input: {
    currentPage: ExplorerClickPage;
    phrase: string;
  }) => VlmPhraseMatch;
  request: Request;
  resolveClickPhrase: (
    request: ClickPhraseRequest
  ) => Promise<ClickPhraseResult>;
  resolveDeterministicClick: (input: {
    currentPage: ExplorerClickPage;
    normalizedClick: FlipbookPoint;
  }) => ExplorerClickResult | null;
  resolveFlipbookClick: (
    input: ResolveFlipbookClickInput
  ) => FlipbookResult;
  resolveSemanticRegionHit: (input: {
    currentPage: ExplorerClickPage;
    normalizedClick: FlipbookPoint;
  }) => Promise<SemanticRegion | null>;
  sceneArtwork:
    ResolveFlipbookClickInput["sceneArtwork"];
};
