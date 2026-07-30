import type { QueryClient } from "@tanstack/react-query";

import type { RuntimePage } from "../../app/browserRuntime";
import { mergeCachedPrefetchedArtwork } from "./artworkPrefetchCache";
import { createArtworkPrefetchJobController } from "./artworkPrefetchJobController";
import {
  getPrefetchDestinationLimit,
  getPrefetchReadinessLabel,
  getPrefetchSceneKey,
  isArtworkTargetReady
} from "./artworkPrefetchPolicy";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkPack,
  ArtworkPrefetchState,
  ArtworkScene,
  ArtworkTarget
} from "./artworkPrefetchTypes";

type ArtworkPrefetchDependencies = {
  ARTWORK_POLL_INTERVAL_MS: number;
  ARTWORK_POLL_MAX_ATTEMPTS: number;
  ARTWORK_POLL_TIMEOUT_MS: number;
  apiPath: (path: string) => string;
  explainClickError: (error: unknown) => string;
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  getPageEnvironmentUrl: (
    page: ArtworkPage
  ) => string | null | undefined;
  isArtworkJobFailed: (job: ArtworkJob) => boolean;
  listNextArtworkDestinations: (input: {
    scene: ArtworkScene;
    scenes: ArtworkPack["scenes"];
    nodes: ArtworkPack["nodes"];
    currentPage: RuntimePage | null;
    limit: number;
  }) => ArtworkTarget[];
  preloadArtworkImage: (imageUrl: string) => Promise<unknown>;
  queryClient: QueryClient;
  render: () => void;
  state: ArtworkPrefetchState;
  toApiUrl: (path: string) => string;
};

export function createArtworkPrefetchController(
  dependencies: ArtworkPrefetchDependencies
) {
  const {
    ARTWORK_POLL_INTERVAL_MS,
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS,
    apiPath,
    explainClickError,
    fetchArtworkResource,
    getPageEnvironmentUrl,
    isArtworkJobFailed,
    listNextArtworkDestinations,
    preloadArtworkImage,
    queryClient,
    render,
    state,
    toApiUrl
  } = dependencies;

  function isTargetReady(target: ArtworkTarget): boolean {
    if (!state.activePack) return false;
    return isArtworkTargetReady(target, {
      artworkByPage: state.artworkByPage,
      artworkByScene: state.artworkByScene,
      scenes: state.activePack.scenes
    });
  }

  const prefetchJobController =
    createArtworkPrefetchJobController({
      artworkPollIntervalMs: ARTWORK_POLL_INTERVAL_MS,
      artworkPollMaxAttempts: ARTWORK_POLL_MAX_ATTEMPTS,
      artworkPollTimeoutMs: ARTWORK_POLL_TIMEOUT_MS,
      apiPath,
      explainClickError,
      fetchArtworkResource,
      getPageEnvironmentUrl,
      isArtworkJobFailed,
      isTargetReady,
      preloadArtworkImage,
      queryClient,
      render,
      state,
      toApiUrl
    });

  function prefetchNextDestinations(): void {
    const sceneId = state.currentSceneId;
    const targets = getCurrentPrefetchTargets(true);
    if (!sceneId || !targets) return;
    resetPrefetchForSceneChange(sceneId);
    for (const target of targets) {
      prefetchJobController.prefetchArtworkTarget(target);
    }
  }

  function resetPrefetchForSceneChange(
    sceneId: string
  ): void {
    const sceneKey = getPrefetchSceneKey({
      countrySlug: state.activeCountrySlug,
      sceneId,
      pageId: state.currentPage?.id,
      nodeId: state.currentPage?.nodeId
    });
    if (state.prefetchSceneId === sceneKey) return;
    invalidatePrefetchState();
    state.prefetchSceneId = sceneKey;
  }

  function invalidatePrefetchState(): void {
    state.prefetchSceneId = null;
    prefetchJobController.invalidatePrefetchJobs();
  }

  function getReadinessLabel(): string | null {
    const targets = getCurrentPrefetchTargets();
    if (!targets) return null;
    return getPrefetchReadinessLabel({
      enabled: state.experienceConfig.loadNextDestinationsEarly,
      readyCount: targets.filter(isTargetReady).length,
      targetCount: targets.length
    });
  }

  function getCurrentPrefetchTargets(
    requireExplorerView = false
  ):
    | ArtworkTarget[]
    | null {
    if (
      !state.experienceConfig.loadNextDestinationsEarly ||
      (requireExplorerView &&
        state.currentView !== "explorer") ||
      !state.activePack ||
      !state.currentSceneId
    ) {
      return null;
    }
    const scene = state.activePack.scenes[state.currentSceneId];
    if (!scene) return null;
    return listNextArtworkDestinations({
      scene,
      scenes: state.activePack.scenes,
      nodes: state.activePack.nodes,
      currentPage: state.currentPage,
      limit: getPrefetchDestinationLimit(
        state.experienceConfig
      )
    });
  }

  function mergeCachedArtwork<T extends RuntimePage>(
    page: T
  ): T {
    return mergeCachedPrefetchedArtwork(page, state);
  }

  return {
    getPrefetchReadinessLabel: getReadinessLabel,
    invalidatePrefetchState,
    isArtworkTargetReady: isTargetReady,
    mergePrefetchedArtwork: mergeCachedArtwork,
    prefetchNextDestinations,
    resetPrefetchForSceneChange
  };
}
