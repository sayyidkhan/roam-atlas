import { storePrefetchedArtwork } from "./artworkPrefetchCache";
import { createArtworkPrefetchPollingController } from "./artworkPrefetchPollingController";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkPrefetchState,
  ArtworkTarget,
  PrefetchRequestIdentity
} from "./artworkPrefetchTypes";

type ArtworkPrefetchJobDependencies = {
  artworkPollIntervalMs: number;
  artworkPollMaxAttempts: number;
  artworkPollTimeoutMs: number;
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
  isTargetReady: (target: ArtworkTarget) => boolean;
  preloadArtworkImage: (imageUrl: string) => Promise<unknown>;
  render: () => void;
  state: ArtworkPrefetchState;
  toApiUrl: (path: string) => string;
};

export function createArtworkPrefetchJobController(
  dependencies: ArtworkPrefetchJobDependencies
) {
  const {
    artworkPollIntervalMs,
    artworkPollMaxAttempts,
    artworkPollTimeoutMs,
    apiPath,
    explainClickError,
    fetchArtworkResource,
    getPageEnvironmentUrl,
    isArtworkJobFailed,
    isTargetReady,
    preloadArtworkImage,
    render,
    state,
    toApiUrl
  } = dependencies;
  let prefetchRenderFrame: number | null = null;
  let prefetchEpoch = 0;
  const pollingController =
    createArtworkPrefetchPollingController({
      artworkPollIntervalMs,
      artworkPollMaxAttempts,
      artworkPollTimeoutMs,
      explainClickError,
      fetchArtworkResource,
      isArtworkJobFailed,
      isCurrentRequest: isCurrentPrefetchRequest,
      scheduleRender: schedulePrefetchRailRender,
      state,
      storeCache,
      toApiUrl
    });

  function prefetchArtworkTarget(target: ArtworkTarget): void {
    if (
      !state.activePack ||
      !state.currentSceneId ||
      isTargetReady(target) ||
      state.prefetchRequests.has(target.key) ||
      state.prefetchJobs.has(target.key)
    ) {
      return;
    }
    const scene = state.activePack.scenes[target.sceneId];
    const requestEpoch = prefetchEpoch;
    const requestSceneId = state.currentSceneId;
    const isSceneRootTarget =
      scene && target.nodeId === scene.rootNodeId;
    const trackKey = isSceneRootTarget
      ? target.sceneId
      : target.key;
    if (state.artworkJobs.has(trackKey)) return;

    state.prefetchRequests.add(target.key);
    state.prefetchJobs.set(target.key, {
      status: "pending_codex_image_generation",
      jobKind: "prefetch",
      title: target.title,
      requestEpoch,
      startedAt: Date.now(),
      attempts: 0
    });
    schedulePrefetchRailRender();
    const params = new URLSearchParams({
      countrySlug: state.activeCountrySlug,
      sceneId: target.sceneId,
      prefetch: "priority",
      quality: state.imageQuality
    });
    if (!isSceneRootTarget && target.nodeId) {
      params.set("nodeId", target.nodeId);
    }

    void fetchArtworkResource(
      apiPath(`/api/artwork?${params.toString()}`),
      { cache: "no-store" }
    )
      .then(async (response) => {
        if (
          !isCurrentPrefetchRequest(
            requestEpoch,
            requestSceneId
          )
        ) {
          return;
        }
        if (!response.ok) {
          throw new Error(
            `Prefetch artwork failed: ${response.status}`
          );
        }
        const { page } = (await response.json()) as {
          page: ArtworkPage;
        };
        if (
          !isCurrentPrefetchRequest(
            requestEpoch,
            requestSceneId
          )
        ) {
          return;
        }
        if (page.status === "ready" && page.imageUrl) {
          const stored = await storeCache(
            target,
            page,
            null,
            { requestEpoch, requestSceneId }
          );
          if (
            !stored ||
            !isCurrentPrefetchRequest(
              requestEpoch,
              requestSceneId
            )
          ) {
            return;
          }
          state.prefetchRequests.delete(target.key);
          state.prefetchJobs.set(target.key, {
            status: "ready",
            jobKind: "prefetch",
            title: target.title,
            requestEpoch,
            imageUrl: page.imageUrl
          });
          schedulePrefetchRailRender();
          return;
        }
        const jobUrl = page.generated?.jobUrl;
        if (!jobUrl) {
          state.prefetchRequests.delete(target.key);
          state.prefetchJobs.delete(target.key);
          schedulePrefetchRailRender();
          return;
        }
        state.prefetchJobs.set(target.key, {
          ...state.prefetchJobs.get(target.key),
          status:
            page.status ?? "pending_codex_image_generation",
          jobKind: "prefetch",
          title: page.plan?.title ?? target.title,
          requestEpoch,
          generated: page.generated
        });
        schedulePrefetchRailRender();
        pollingController.poll(
          target,
          jobUrl,
          page,
          requestEpoch,
          requestSceneId
        );
      })
      .catch(() => {
        if (
          !isCurrentPrefetchRequest(
            requestEpoch,
            requestSceneId
          )
        ) {
          return;
        }
        state.prefetchRequests.delete(target.key);
        state.prefetchJobs.set(target.key, {
          status: "failed",
          jobKind: "prefetch",
          title: target.title,
          requestEpoch,
          error: "Could not start background illustration."
        });
        schedulePrefetchRailRender();
      });
  }

  function invalidatePrefetchJobs(): void {
    prefetchEpoch += 1;
    state.prefetchRequests.clear();
    state.prefetchJobs.clear();
    pollingController.stopAll();
  }

  function isCurrentPrefetchRequest(
    requestEpoch: number,
    requestSceneId: string | null
  ): boolean {
    return (
      prefetchEpoch === requestEpoch &&
      state.currentView === "explorer" &&
      state.currentSceneId === requestSceneId
    );
  }

  function schedulePrefetchRailRender(): void {
    if (prefetchRenderFrame != null) return;
    prefetchRenderFrame = window.requestAnimationFrame(() => {
      prefetchRenderFrame = null;
      if (state.currentView === "explorer") render();
    });
  }

  function storeCache(
    target: ArtworkTarget,
    page: ArtworkPage,
    job: ArtworkJob | null,
    request: PrefetchRequestIdentity
  ): Promise<boolean> {
    return storePrefetchedArtwork(
      {
        getPageEnvironmentUrl,
        isCurrentRequest: isCurrentPrefetchRequest,
        preloadArtworkImage,
        state
      },
      {
        job,
        page,
        request,
        target
      }
    );
  }

  return {
    invalidatePrefetchJobs,
    prefetchArtworkTarget
  };
}
