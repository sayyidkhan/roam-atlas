const VISUAL_FOLDERS = [
  "image-jobs",
  "flipbook",
  "environment",
  "understanding"
];

const ALL_RUNTIME_FOLDERS = [
  ...VISUAL_FOLDERS,
  "starter-map",
  "country-pack-draft",
  "place-images"
];

export function createRuntimeCacheService({
  repository,
  waitForArtworkCreations,
  cancelArtworkForCountry,
  cancelEnvironmentForCountry,
  clearArtworkRuntimeMemory,
  clearPlaceImageRuntimeMemory,
  clearCountryDraftRuntimeMemory
}) {
  const flushingCountryCacheRoots = new Set();
  const countryCacheFlushRuns = new Map();

  async function flushVisualCache(countrySlug) {
    return runCountryFlush(countrySlug, async (countryCacheRoot) => {
      await stopVisualWork(countrySlug, countryCacheRoot);
      await repository.removeFolders(countryCacheRoot, VISUAL_FOLDERS);
      clearArtworkRuntimeMemory(countryCacheRoot);
      return {
        flushed: true,
        scope: "visuals",
        removedFolders: VISUAL_FOLDERS,
        preservedFolders: [
          "starter-map",
          "country-pack-draft",
          "place-images"
        ],
        factBoundary:
          "Generated visual cache and AI click understanding were cleared. Starter-map, reference photos, and source-controlled country pack data were not changed."
      };
    });
  }

  async function flushRuntimeCache(countrySlug) {
    return runCountryFlush(countrySlug, async (countryCacheRoot) => {
      await stopVisualWork(countrySlug, countryCacheRoot);
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

  async function runCountryFlush(countrySlug, operation) {
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

  async function stopVisualWork(countrySlug, countryCacheRoot) {
    const imageRuns = cancelArtworkForCountry(countryCacheRoot);
    const environmentRuns = cancelEnvironmentForCountry(countryCacheRoot);
    await Promise.allSettled([...imageRuns, ...environmentRuns]);
  }

  function isPathBeingFlushed(filePath) {
    return [...flushingCountryCacheRoots].some((cacheRoot) =>
      repository.isInsideCountryRoot(cacheRoot, filePath)
    );
  }

  function getCountryFlushRun(countrySlug) {
    return countryCacheFlushRuns.get(countrySlug) ?? null;
  }

  return {
    flushVisualCache,
    flushRuntimeCache,
    isPathBeingFlushed,
    getCountryFlushRun
  };
}
