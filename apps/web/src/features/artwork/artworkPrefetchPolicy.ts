type PrefetchConfig = {
  maxParallelImageJobs?: unknown;
  prefetchDestinationLimit?: unknown;
};

type ArtworkTarget = {
  key: string;
  nodeId?: string | null;
  sceneId: string;
};

type ArtworkScene = {
  rootNodeId: string;
};

type ArtworkCacheEntry = {
  environmentUrl?: string | null;
  imageUrl?: string | null;
};

type PrefetchPage = {
  nodeId?: string | null;
  sceneId?: string | null;
  [key: string]: unknown;
};

type PrefetchCacheState = {
  artworkByPage: ReadonlyMap<string, ArtworkCacheEntry>;
  artworkByScene: ReadonlyMap<string, ArtworkCacheEntry>;
  scenes: Readonly<Record<string, ArtworkScene>>;
};

export function getPrefetchDestinationLimit(
  config: PrefetchConfig
): number {
  const preferred = Number(config.prefetchDestinationLimit);
  const fallback = Number(config.maxParallelImageJobs);
  const limit = Number.isFinite(preferred) ? preferred : fallback;
  return Math.max(
    0,
    Math.floor(Number.isFinite(limit) ? limit : 0)
  );
}

export function getPrefetchSceneKey(input: {
  countrySlug: string;
  sceneId: string;
  pageId?: unknown;
  nodeId?: unknown;
}): string {
  return [
    input.countrySlug,
    input.sceneId,
    input.pageId ?? "",
    input.nodeId ?? ""
  ].join(":");
}

export function isArtworkTargetReady(
  target: ArtworkTarget,
  state: PrefetchCacheState
): boolean {
  const scene = state.scenes[target.sceneId];
  if (scene && target.nodeId === scene.rootNodeId) {
    return Boolean(
      state.artworkByScene.get(target.sceneId)?.imageUrl
    );
  }
  return Boolean(state.artworkByPage.get(target.key)?.imageUrl);
}

export function getPrefetchReadinessLabel(input: {
  enabled: boolean;
  readyCount: number;
  targetCount: number;
}): string | null {
  if (
    !input.enabled ||
    input.targetCount < 1 ||
    input.readyCount < 1
  ) {
    return null;
  }
  return `${input.readyCount} of ${input.targetCount} destinations ready`;
}

export function mergePrefetchedArtwork<T extends PrefetchPage>(
  page: T,
  state: PrefetchCacheState
): T {
  if (!page.sceneId) return page;
  const scene = state.scenes[page.sceneId];
  if (scene && page.nodeId === scene.rootNodeId) {
    const cached = state.artworkByScene.get(page.sceneId);
    if (cached?.imageUrl) return mergeCacheEntry(page, cached);
  }
  if (page.nodeId) {
    const cached = state.artworkByPage.get(`node:${page.nodeId}`);
    if (cached?.imageUrl) return mergeCacheEntry(page, cached);
  }
  return page;
}

function mergeCacheEntry<T extends PrefetchPage>(
  page: T,
  cached: ArtworkCacheEntry
): T {
  return {
    ...page,
    imageUrl: cached.imageUrl,
    environmentUrl: cached.environmentUrl,
    artworkDecoded: true,
    status: "ready"
  };
}
