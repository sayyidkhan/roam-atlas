import type {
  ArtworkJob,
  ArtworkPage,
  ArtworkPrefetchState,
  ArtworkTarget,
  PrefetchRequestIdentity
} from "./artworkPrefetchTypes";

type StorePrefetchCache = (
  target: ArtworkTarget,
  page: ArtworkPage,
  job: ArtworkJob | null,
  request: PrefetchRequestIdentity
) => Promise<boolean>;

type ArtworkPrefetchPollingDependencies = {
  artworkPollIntervalMs: number;
  artworkPollMaxAttempts: number;
  artworkPollTimeoutMs: number;
  explainClickError: (error: unknown) => string;
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  isArtworkJobFailed: (job: ArtworkJob) => boolean;
  isCurrentRequest: (
    requestEpoch: number,
    requestSceneId: string | null
  ) => boolean;
  scheduleRender: () => void;
  state: ArtworkPrefetchState;
  storeCache: StorePrefetchCache;
  toApiUrl: (path: string) => string;
};

type PrefetchPoller = {
  intervalId: number;
  requestEpoch: number;
};

export function createArtworkPrefetchPollingController({
  artworkPollIntervalMs,
  artworkPollMaxAttempts,
  artworkPollTimeoutMs,
  explainClickError,
  fetchArtworkResource,
  isArtworkJobFailed,
  isCurrentRequest,
  scheduleRender,
  state,
  storeCache,
  toApiUrl
}: ArtworkPrefetchPollingDependencies) {
  const pollers = new Map<string, PrefetchPoller>();

  function poll(
    target: ArtworkTarget,
    jobUrl: string,
    page: ArtworkPage,
    requestEpoch: number,
    requestSceneId: string
  ): void {
    stop(target.key);
    const tick = async (): Promise<void> => {
      if (
        !isCurrentRequest(
          requestEpoch,
          requestSceneId
        )
      ) {
        stop(target.key, requestEpoch);
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
        stop(target.key, requestEpoch);
        state.prefetchRequests.delete(target.key);
        if (existing) {
          state.prefetchJobs.set(target.key, {
            ...existing,
            status: "timed_out",
            error: "Background illustration timed out."
          });
        }
        scheduleRender();
        return;
      }
      try {
        const response = await fetchArtworkResource(
          toApiUrl(jobUrl),
          { cache: "no-store" }
        );
        if (
          !isCurrentRequest(
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
          !isCurrentRequest(
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
          stop(target.key, requestEpoch);
          state.prefetchRequests.delete(target.key);
          scheduleRender();
          return;
        }
        if (job.status === "ready" && !job.imageUrl) {
          stop(target.key, requestEpoch);
          state.prefetchRequests.delete(target.key);
          state.prefetchJobs.set(target.key, {
            ...state.prefetchJobs.get(target.key),
            status: "failed",
            error:
              "Background illustration completed without an image."
          });
          scheduleRender();
          return;
        }
        if (job.status !== "ready" || !job.imageUrl) {
          if (didChange) scheduleRender();
          return;
        }
        stop(target.key, requestEpoch);
        state.prefetchRequests.delete(target.key);
        try {
          const stored = await storeCache(
            target,
            page,
            job,
            { requestEpoch, requestSceneId }
          );
          if (
            !stored ||
            !isCurrentRequest(
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
          scheduleRender();
          return;
        }
        state.prefetchJobs.set(target.key, {
          ...state.prefetchJobs.get(target.key),
          status: "ready",
          imageUrl: job.imageUrl
        });
        scheduleRender();
      } catch (error) {
        if (
          !isCurrentRequest(
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
    pollers.set(target.key, {
      intervalId: window.setInterval(
        guardedTick,
        artworkPollIntervalMs
      ),
      requestEpoch
    });
  }

  function stop(
    key: string,
    expectedEpoch: number | null = null
  ): void {
    const poller = pollers.get(key);
    if (
      !poller ||
      (expectedEpoch != null &&
        poller.requestEpoch !== expectedEpoch)
    ) {
      return;
    }
    window.clearInterval(poller.intervalId);
    pollers.delete(key);
  }

  function stopAll(): void {
    for (const key of [...pollers.keys()]) {
      stop(key);
    }
  }

  return { poll, stopAll };
}
