import type {
  RuntimeCacheRepository
} from "./runtimeCacheRepository.ts";

const VISUAL_FOLDERS = [
  "image-jobs",
  "flipbook",
  "environment",
  "understanding"
] as const;

const ALL_RUNTIME_FOLDERS = [
  ...VISUAL_FOLDERS,
  "starter-map",
  "country-pack-draft",
  "place-images"
] as const;

const PRESERVED_VISUAL_FLUSH_FOLDERS =
  ALL_RUNTIME_FOLDERS.slice(VISUAL_FOLDERS.length);

export type RuntimeCacheFlushResult =
  | {
      factBoundary: string;
      flushed: true;
      preservedFolders: readonly string[];
      removedFolders: readonly string[];
      scope: "visuals";
    }
  | {
      factBoundary: string;
      flushed: true;
      removedFolders: readonly string[];
      removedRuntimeRoot: string;
    };

type RuntimeCacheServiceDependencies = {
  cancelArtworkForCountry: (
    countryCacheRoot: string
  ) => Promise<unknown>[];
  cancelEnvironmentForCountry: (
    countryCacheRoot: string
  ) => Promise<unknown>[];
  clearArtworkRuntimeMemory: (countryCacheRoot: string) => void;
  clearCountryDraftRuntimeMemory: (countrySlug: string) => void;
  clearPlaceImageRuntimeMemory: (countrySlug: string) => void;
  repository: RuntimeCacheRepository;
  waitForArtworkCreations: (countrySlug: string) => Promise<unknown>;
};

export type RuntimeCacheService = {
  flushRuntimeCache: (
    countrySlug: string
  ) => Promise<RuntimeCacheFlushResult>;
  flushVisualCache: (
    countrySlug: string
  ) => Promise<RuntimeCacheFlushResult>;
  getCountryFlushRun: (
    countrySlug: string
  ) => Promise<RuntimeCacheFlushResult> | null;
  isPathBeingFlushed: (filePath: string) => boolean;
};

export function createRuntimeCacheService({
  repository,
  waitForArtworkCreations,
  cancelArtworkForCountry,
  cancelEnvironmentForCountry,
  clearArtworkRuntimeMemory,
  clearPlaceImageRuntimeMemory,
  clearCountryDraftRuntimeMemory
}: RuntimeCacheServiceDependencies): RuntimeCacheService {
  const flushingCountryCacheRoots = new Set<string>();
  const countryCacheFlushRuns =
    new Map<string, Promise<RuntimeCacheFlushResult>>();

  async function flushVisualCache(
    countrySlug: string
  ): Promise<RuntimeCacheFlushResult> {
    return runCountryFlush(countrySlug, async (countryCacheRoot) => {
      await stopVisualWork(countryCacheRoot);
      await repository.removeFolders(countryCacheRoot, VISUAL_FOLDERS);
      clearArtworkRuntimeMemory(countryCacheRoot);
      return {
        flushed: true,
        scope: "visuals",
        removedFolders: VISUAL_FOLDERS,
        preservedFolders: PRESERVED_VISUAL_FLUSH_FOLDERS,
        factBoundary:
          "Generated visual cache and AI click understanding were cleared. Starter-map, reference photos, and source-controlled country pack data were not changed."
      };
    });
  }

  async function flushRuntimeCache(
    countrySlug: string
  ): Promise<RuntimeCacheFlushResult> {
    return runCountryFlush(countrySlug, async (countryCacheRoot) => {
      await stopVisualWork(countryCacheRoot);
      await repository.removeCountryRoot(countryCacheRoot);
      clearArtworkRuntimeMemory(countryCacheRoot);
      clearPlaceImageRuntimeMemory(countrySlug);
      clearCountryDraftRuntimeMemory(countrySlug);
      return {
        flushed: true,
        removedRuntimeRoot: countryCacheRoot,
        removedFolders: ALL_RUNTIME_FOLDERS,
        factBoundary:
          "Country runtime cache was cleared. Source-controlled country pack data was not changed."
      };
    });
  }

  async function runCountryFlush(
    countrySlug: string,
    operation: (
      countryCacheRoot: string
    ) => Promise<RuntimeCacheFlushResult>
  ): Promise<RuntimeCacheFlushResult> {
    const existingRun = countryCacheFlushRuns.get(countrySlug);
    if (existingRun) return existingRun;
    const countryCacheRoot = repository.countryRootFor(countrySlug);
    const run = (async () => {
      await waitForArtworkCreations(countrySlug);
      flushingCountryCacheRoots.add(countryCacheRoot);
      try {
        return await operation(countryCacheRoot);
      } finally {
        flushingCountryCacheRoots.delete(countryCacheRoot);
      }
    })();
    countryCacheFlushRuns.set(countrySlug, run);
    try {
      return await run;
    } finally {
      if (countryCacheFlushRuns.get(countrySlug) === run) {
        countryCacheFlushRuns.delete(countrySlug);
      }
    }
  }

  async function stopVisualWork(
    countryCacheRoot: string
  ): Promise<void> {
    const imageRuns = cancelArtworkForCountry(countryCacheRoot);
    const environmentRuns =
      cancelEnvironmentForCountry(countryCacheRoot);
    await Promise.allSettled([...imageRuns, ...environmentRuns]);
  }

  function isPathBeingFlushed(filePath: string): boolean {
    return [...flushingCountryCacheRoots].some((cacheRoot) =>
      repository.isInsideCountryRoot(cacheRoot, filePath)
    );
  }

  function getCountryFlushRun(
    countrySlug: string
  ): Promise<RuntimeCacheFlushResult> | null {
    return countryCacheFlushRuns.get(countrySlug) ?? null;
  }

  return {
    flushVisualCache,
    flushRuntimeCache,
    isPathBeingFlushed,
    getCountryFlushRun
  };
}
