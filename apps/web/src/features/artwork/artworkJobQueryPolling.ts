import {
  QueryObserver,
  type QueryClient
} from "@tanstack/react-query";

type ArtworkJobQueryPollingDependencies = {
  intervalMs: number;
  queryClient: QueryClient;
};

type ArtworkJobPoll = {
  identity: number;
  jobUrl: string;
  poll: () => Promise<void>;
  pollKey: string;
};

type ActivePoll = {
  identity: number;
  observer: QueryObserver<boolean, Error>;
  unsubscribe: () => void;
};

export const artworkJobQueryKeys = {
  all: ["artwork-jobs"] as const,
  status(
    pollKey: string,
    identity: number,
    jobUrl: string
  ) {
    return [
      "artwork-jobs",
      pollKey,
      identity,
      jobUrl
    ] as const;
  }
};

export function createArtworkJobQueryPolling({
  intervalMs,
  queryClient
}: ArtworkJobQueryPollingDependencies) {
  const activePolls = new Map<string, ActivePoll>();

  function start({
    identity,
    jobUrl,
    poll,
    pollKey
  }: ArtworkJobPoll): void {
    stop(pollKey);
    const observer = new QueryObserver<boolean, Error>(
      queryClient,
      {
        gcTime: 0,
        queryFn: async () => {
          await poll();
          return true;
        },
        queryKey: artworkJobQueryKeys.status(
          pollKey,
          identity,
          jobUrl
        ),
        refetchInterval: intervalMs,
        refetchIntervalInBackground: true,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 0
      }
    );
    const activePoll: ActivePoll = {
      identity,
      observer,
      unsubscribe: () => {}
    };
    activePolls.set(pollKey, activePoll);
    activePoll.unsubscribe = observer.subscribe(() => {});
  }

  function stop(
    pollKey: string,
    expectedIdentity: number | null = null
  ): void {
    const activePoll = activePolls.get(pollKey);
    if (
      !activePoll ||
      (expectedIdentity != null &&
        activePoll.identity !== expectedIdentity)
    ) {
      return;
    }
    activePolls.delete(pollKey);
    activePoll.unsubscribe();
    activePoll.observer.destroy();
  }

  function stopAll(): void {
    for (const pollKey of [...activePolls.keys()]) {
      stop(pollKey);
    }
  }

  return {
    start,
    stop,
    stopAll
  };
}

export type ArtworkJobQueryPolling = ReturnType<
  typeof createArtworkJobQueryPolling
>;
