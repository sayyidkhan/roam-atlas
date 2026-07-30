import type { RuntimePage } from "../../app/browserRuntime";
import type {
  ArtworkCacheEntry
} from "./artworkCacheTypes";

export type ArtworkTarget = {
  key: string;
  nodeId?: string | null;
  sceneId: string;
  title: string;
};

export type ArtworkPage = {
  generated?: {
    jobUrl?: string;
    [key: string]: unknown;
  };
  imageUrl?: string | null;
  plan?: {
    title?: string;
  };
  status?: string;
  [key: string]: unknown;
};

export type ArtworkJob = {
  attempts?: number;
  error?: string;
  generated?: unknown;
  imageUrl?: string | null;
  jobKind?: string;
  lastPollError?: string;
  partialImageUrl?: string | null;
  requestEpoch?: number;
  startedAt?: number;
  status?: string;
  title?: string;
  [key: string]: unknown;
};

export type ArtworkScene = {
  id: string;
  rootNodeId: string;
  [key: string]: unknown;
};

export type ArtworkPack = {
  nodes: Record<string, unknown>;
  scenes: Record<string, ArtworkScene>;
};

export type PrefetchExperienceConfig = {
  loadNextDestinationsEarly: boolean;
  maxParallelImageJobs?: unknown;
  prefetchDestinationLimit?: unknown;
};

export type ArtworkPrefetchState = {
  activeCountrySlug: string;
  activePack: ArtworkPack | null;
  artworkByPage: Map<string, ArtworkCacheEntry>;
  artworkByScene: Map<string, ArtworkCacheEntry>;
  artworkJobs: Map<string, unknown>;
  currentPage: RuntimePage | null;
  currentSceneId: string | null;
  currentView: string;
  experienceConfig: PrefetchExperienceConfig;
  imageQuality: string;
  prefetchJobs: Map<string, ArtworkJob>;
  prefetchRequests: Set<string>;
  prefetchSceneId: string | null;
};

export type PrefetchRequestIdentity = {
  requestEpoch: number;
  requestSceneId: string | null;
};
