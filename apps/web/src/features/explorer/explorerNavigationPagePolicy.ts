import type {
  RuntimePack,
  RuntimePage
} from "../../app/browserRuntime";

export type ExplorerPage = RuntimePage & {
  countryName?: string;
  generated?: {
    imageUrl?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CachedArtwork = {
  decoded?: boolean;
  environmentUrl?: string | null;
  imageUrl?: string | null;
  [key: string]: unknown;
};

export function materializeExplorerRequestPage({
  activePack,
  artworkByPage,
  artworkByScene,
  currentPage,
  currentSceneId,
  getPageArtworkCacheKey
}: {
  activePack: RuntimePack | null;
  artworkByPage: Map<string, CachedArtwork>;
  artworkByScene: Map<string, CachedArtwork>;
  currentPage: ExplorerPage | null;
  currentSceneId: string | null;
  getPageArtworkCacheKey: (
    page: ExplorerPage | null
  ) => string;
}): ExplorerPage | null {
  if (!currentPage) return null;
  const sceneArtwork = currentSceneId
    ? artworkByScene.get(currentSceneId)
    : null;
  const pageArtwork = artworkByPage.get(
    getPageArtworkCacheKey(currentPage)
  );
  const scene = currentSceneId
    ? activePack?.scenes?.[currentSceneId]
    : null;
  const cachedArtwork =
    scene && currentPage.nodeId === scene.rootNodeId
      ? sceneArtwork
      : pageArtwork;
  const imageUrl =
    currentPage.imageUrl ?? cachedArtwork?.imageUrl ?? null;

  return imageUrl === currentPage.imageUrl
    ? currentPage
    : {
        ...currentPage,
        imageUrl,
        environmentUrl: cachedArtwork?.environmentUrl,
        artworkDecoded: Boolean(cachedArtwork?.decoded),
        status: imageUrl ? "ready" : currentPage.status
      };
}

export function isRuntimeArtworkPage(
  page: ExplorerPage | null | undefined
): boolean {
  const imageUrl = page?.imageUrl ?? page?.generated?.imageUrl;
  return (
    typeof imageUrl === "string" &&
    imageUrl.includes("/runtime-cache/")
  );
}

export function explainExplorerRequestError(
  error: unknown
): string {
  const message =
    error instanceof Error ? error.message : String(error);
  if (
    message === "Failed to fetch" ||
    (error instanceof Error && error.name === "TypeError")
  ) {
    return "The browser could not reach the RoamAtlas dev server. Open the app through npm run dev, not as a file, and make sure the server is still running.";
  }
  return message;
}
