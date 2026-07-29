import { storePrefetchedArtwork } from "./artworkPrefetchCache";
import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkPrefetchState,
  ArtworkTarget
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

type PrefetchPoller = {
  intervalId: number;
  requestEpoch: number;
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
  const prefetchPollers = new Map<string, PrefetchPoller>();
  let prefetchRenderFrame: number | null = null;
  let prefetchEpoch = 0;

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
            requestEpoch,
            requestSceneId
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
        pollPrefetchJob(
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

  function pollPrefetchJob(
    target: ArtworkTarget,
    jobUrl: string,
    page: ArtworkPage,
    requestEpoch: number,
    requestSceneId: string
  ): void {
    stopPrefetchPoller(target.key);
    const tick = async (): Promise<void> => {
      if (
        !isCurrentPrefetchRequest(
          requestEpoch,
          requestSceneId
        )
      ) {
        stopPrefetchPoller(target.key, requestEpoch);
        return;
      }
      const existing = state.prefetchJobs.get(target.key);
      const elapsed =
        Date.now() - (existing?.startedAt ?? Date.now());
      if (
        !existing ||
        elapsed >= artworkPollTimeoutMs ||
        (existing.attempts ?? 0) >= artworkPollMaxAttempts
      ) {
        stopPrefetchPoller(target.key, requestEpoch);
        state.prefetchRequests.delete(target.key);
        if (existing) {
          state.prefetchJobs.set(target.key, {
            ...existing,
            status: "timed_out",
            error: "Background illustration timed out."
          });
        }
        schedulePrefetchRailRender();
        return;
      }
      try {
        const response = await fetchArtworkResource(
          toApiUrl(jobUrl),
          { cache: "no-store" }
        );
        if (
          !isCurrentPrefetchRequest(
            requestEpoch,
            requestSceneId
          )
        ) {
          return;
        }
        const latest = state.prefetchJobs.get(target.key);
        state.prefetchJobs.set(target.key, {
          ...latest,
          attempts: (latest?.attempts ?? 0) + 1
        });
        if (!response.ok) return;
        const job = (await response.json()) as ArtworkJob;
        if (
          !isCurrentPrefetchRequest(
            requestEpoch,
            requestSceneId
          )
        ) {
          return;
        }
        const previous =
          state.prefetchJobs.get(target.key) ?? {};
        const didChange = [
          "status",
          "partialImageUrl",
          "imageUrl",
          "error"
        ].some((field) => previous[field] !== job[field]);
        state.prefetchJobs.set(target.key, {
          ...previous,
          ...job,
          jobKind: job.jobKind ?? "prefetch",
          title:
            job.title ??
            page.plan?.title ??
            target.title
        });
        if (isArtworkJobFailed(job)) {
          stopPrefetchPoller(target.key, requestEpoch);
          state.prefetchRequests.delete(target.key);
          schedulePrefetchRailRender();
          return;
        }
        if (job.status === "ready" && !job.imageUrl) {
          stopPrefetchPoller(target.key, requestEpoch);
          state.prefetchRequests.delete(target.key);
          state.prefetchJobs.set(target.key, {
            ...state.prefetchJobs.get(target.key),
            status: "failed",
            error:
              "Background illustration completed without an image."
          });
          schedulePrefetchRailRender();
          return;
        }
        if (job.status !== "ready" || !job.imageUrl) {
          if (didChange) schedulePrefetchRailRender();
          return;
        }
        stopPrefetchPoller(target.key, requestEpoch);
        state.prefetchRequests.delete(target.key);
        try {
          const stored = await storeCache(
            target,
            page,
            job,
            requestEpoch,
            requestSceneId
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
        } catch (error) {
          state.prefetchJobs.set(target.key, {
            ...state.prefetchJobs.get(target.key),
            status: "failed",
            error: explainClickError(error)
          });
          schedulePrefetchRailRender();
          return;
        }
        state.prefetchJobs.set(target.key, {
          ...state.prefetchJobs.get(target.key),
          status: "ready",
          imageUrl: job.imageUrl
        });
        schedulePrefetchRailRender();
      } catch (error) {
        if (
          !isCurrentPrefetchRequest(
            requestEpoch,
            requestSceneId
          )
        ) {
          return;
        }
        const latest = state.prefetchJobs.get(target.key);
        if (!latest) return;
        state.prefetchJobs.set(target.key, {
          ...latest,
          lastPollError: explainClickError(error)
        });
      }
    };

    let pollInFlight = false;
    const guardedTick = async (): Promise<void> => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        await tick();
      } finally {
        pollInFlight = false;
      }
    };
    void guardedTick();
    prefetchPollers.set(target.key, {
      intervalId: window.setInterval(
        guardedTick,
        artworkPollIntervalMs
      ),
      requestEpoch
    });
  }

  function invalidatePrefetchJobs(): void {
    prefetchEpoch += 1;
    state.prefetchRequests.clear();
    state.prefetchJobs.clear();
    for (const key of [...prefetchPollers.keys()]) {
      stopPrefetchPoller(key);
    }
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

  function stopPrefetchPoller(
    key: string,
    expectedEpoch: number | null = null
  ): void {
    const poller = prefetchPollers.get(key);
    if (
      !poller ||
      (expectedEpoch != null &&
        poller.requestEpoch !== expectedEpoch)
    ) {
      return;
    }
    window.clearInterval(poller.intervalId);
    prefetchPollers.delete(key);
  }

  function storeCache(
    target: ArtworkTarget,
    page: ArtworkPage,
    job: ArtworkJob | null,
    requestEpoch: number,
    requestSceneId: string | null
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
        request: { requestEpoch, requestSceneId },
        target
      }
    );
  }

  return {
    invalidatePrefetchJobs,
    prefetchArtworkTarget
  };
}
