import type { RuntimePage } from "../../app/browserRuntime";
import { mergePrefetchedArtwork } from "./artworkPrefetchPolicy";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkPrefetchState,
  ArtworkTarget,
  PrefetchRequestIdentity
} from "./artworkPrefetchTypes";
import type {
  ArtworkCacheEntry
} from "./artworkCacheTypes";

type StorePrefetchedArtworkDependencies = {
  getPageEnvironmentUrl: (
    page: ArtworkPage
  ) => string | null | undefined;
  isCurrentRequest: (
    requestEpoch: number,
    requestSceneId: string | null
  ) => boolean;
  preloadArtworkImage: (imageUrl: string) => Promise<unknown>;
  state: ArtworkPrefetchState;
};

type StorePrefetchedArtworkInput = {
  job?: ArtworkJob | null;
  page: ArtworkPage;
  request?: PrefetchRequestIdentity | null;
  target: ArtworkTarget;
};

export async function storePrefetchedArtwork(
  {
    getPageEnvironmentUrl,
    isCurrentRequest,
    preloadArtworkImage,
    state
  }: StorePrefetchedArtworkDependencies,
  {
    job = null,
    page,
    request = null,
    target
  }: StorePrefetchedArtworkInput
): Promise<boolean> {
  if (!state.activePack) return false;
  const imageUrl = job?.imageUrl ?? page.imageUrl;
  if (!imageUrl) return false;
  await preloadArtworkImage(imageUrl);
  if (
    request &&
    !isCurrentRequest(
      request.requestEpoch,
      request.requestSceneId
    )
  ) {
    return false;
  }

  const environmentUrl =
    job?.environmentStatus === "deferred"
      ? null
      : (job?.environmentUrl as
          | string
          | null
          | undefined) ?? getPageEnvironmentUrl(page);
  const payload: ArtworkCacheEntry = {
    imageUrl,
    environmentUrl,
    page: {
      ...page,
      imageUrl,
      environmentUrl,
      status: "ready",
      artworkDecoded: true
    },
    decoded: true
  };
  const scene = state.activePack.scenes[target.sceneId];
  if (scene && target.nodeId === scene.rootNodeId) {
    state.artworkByScene.set(target.sceneId, payload);
  } else {
    state.artworkByPage.set(target.key, payload);
  }
  return true;
}

export function mergeCachedPrefetchedArtwork<
  T extends RuntimePage
>(page: T, state: ArtworkPrefetchState): T {
  if (!state.activePack) return page;
  return mergePrefetchedArtwork(page, {
    artworkByPage: state.artworkByPage,
    artworkByScene: state.artworkByScene,
    scenes: state.activePack.scenes
  });
}
