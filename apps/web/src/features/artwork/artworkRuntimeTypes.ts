export type ArtworkPage = {
  artworkDecoded?: boolean;
  countrySlug?: string;
  environmentStatus?: string;
  environmentUrl?: string | null;
  generated?: {
    environmentStatus?: string;
    environmentUrl?: string | null;
    jobUrl?: string | null;
    [key: string]: unknown;
  };
  id?: string;
  imageUrl?: string | null;
  nodeId: string | null;
  plan?: {
    title?: string;
    [key: string]: unknown;
  } | null;
  sceneId: string | null;
  status?: string;
  [key: string]: unknown;
};

export type ArtworkJob = {
  attemptId?: number;
  attempts?: number;
  countrySlug?: string;
  decodedPartialImageUrl?: string | null;
  environmentStatus?: string;
  environmentUrl?: string | null;
  error?: unknown;
  imageUrl?: string | null;
  intervalId?: number | null;
  jobKind?: string;
  jobUrl?: string | null;
  lastPollError?: string;
  loadingPartialImageUrl?: string | null;
  page?: ArtworkPage;
  partialImageFailed?: boolean;
  partialImageUrl?: string | null;
  result?: unknown;
  serverStatus?: string;
  startedAt?: number;
  status?: string;
  targetPage?: ArtworkPage;
  [key: string]: unknown;
};

export type ArtworkCacheEntry = {
  decoded: boolean;
  environmentUrl?: string | null;
  imageUrl: string;
  page: ArtworkPage;
};

export type ArtworkScene = {
  id: string;
  rootNodeId: string;
};

export type ArtworkState = {
  activeCountrySlug: string;
  activePack: {
    scenes: Record<string, ArtworkScene>;
  } | null;
  artworkByPage: Map<string, ArtworkCacheEntry>;
  artworkByScene: Map<string, ArtworkCacheEntry>;
  artworkJobs: Map<string, ArtworkJob>;
  currentPage: ArtworkPage | null;
  currentSceneId: string | null;
  currentView: string;
  imageQuality: string;
};

export type ArtworkJobKind = "interactive" | "prefetch" | string;
