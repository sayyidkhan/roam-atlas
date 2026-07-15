/**
 * RoamAtlas loading / prefetch defaults.
 * Override with env vars shown beside each field.
 */
export const ROAMATLAS_EXPERIENCE_CONFIG = {
  // ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY (ROAMATLAS_PREFETCH_ENABLED also works)
  // While you are on a screen, load artwork for the next destinations in the background.
  loadNextDestinationsEarly: true,

  // ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS (legacy compatibility only)
  // Older clients used one value for both prefetch breadth and provider concurrency.
  maxParallelImageJobs: 10,

  // ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY
  // Total image-provider requests that may run at once. Keep this aligned with
  // the direct-child prefetch breadth so entering a parent can draw its whole
  // first layer concurrently.
  providerConcurrency: 10,

  // ROAMATLAS_INTERACTIVE_RESERVED_SLOTS
  // Capacity that speculative/background jobs may never consume.
  interactiveReservedSlots: 1,

  // ROAMATLAS_PREFETCH_DESTINATION_LIMIT
  // Maximum direct-child destinations queued from the current screen.
  // The first Singapore layer has seven destinations; ten leaves headroom for
  // the rest of the demo graph without speculating beyond one level.
  prefetchDestinationLimit: 10,

  // ROAMATLAS_LOAD_COUNTRY_PACK_EARLY (ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK also works)
  // Load country pack artwork early when the server starts.
  loadCountryPackEarly: false,

  // ROAMATLAS_SHOW_LOADING_STEPS (ROAMATLAS_LOADING_THINKING_UI also works)
  // Show step-by-step loading messages while a page image is being generated (UI not wired yet).
  showLoadingSteps: true
};

export function resolveRoamAtlasExperienceConfig(env = {}) {
  const legacyMaxParallelOverride =
    env.ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS ?? env.ROAMATLAS_MAX_IMAGE_JOBS;
  const maxParallelImageJobs = readNonNegativeInt(
    legacyMaxParallelOverride,
    ROAMATLAS_EXPERIENCE_CONFIG.maxParallelImageJobs
  );
  // Preserve the legacy value `0` as an explicit provider-off switch. This is
  // important because turning an old deployment back on could incur paid calls.
  const providerConcurrency = readNonNegativeInt(
    env.ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY ??
      env.ROAMATLAS_PROVIDER_CONCURRENCY ??
      legacyMaxParallelOverride,
    ROAMATLAS_EXPERIENCE_CONFIG.providerConcurrency
  );
  const interactiveReservedSlots = Math.min(
    Math.max(0, providerConcurrency - 1),
    readNonNegativeInt(
      env.ROAMATLAS_INTERACTIVE_RESERVED_SLOTS,
      ROAMATLAS_EXPERIENCE_CONFIG.interactiveReservedSlots
    )
  );
  const prefetchDestinationLimit = readNonNegativeInt(
    env.ROAMATLAS_PREFETCH_DESTINATION_LIMIT ?? legacyMaxParallelOverride,
    ROAMATLAS_EXPERIENCE_CONFIG.prefetchDestinationLimit
  );

  return {
    loadNextDestinationsEarly: readBool(
      env.ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY ?? env.ROAMATLAS_PREFETCH_ENABLED,
      ROAMATLAS_EXPERIENCE_CONFIG.loadNextDestinationsEarly
    ),
    maxParallelImageJobs,
    providerConcurrency,
    interactiveReservedSlots,
    prefetchDestinationLimit,
    loadCountryPackEarly: readBool(
      env.ROAMATLAS_LOAD_COUNTRY_PACK_EARLY ?? env.ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK,
      ROAMATLAS_EXPERIENCE_CONFIG.loadCountryPackEarly
    ),
    showLoadingSteps: readBool(
      env.ROAMATLAS_SHOW_LOADING_STEPS ?? env.ROAMATLAS_LOADING_THINKING_UI,
      ROAMATLAS_EXPERIENCE_CONFIG.showLoadingSteps
    )
  };
}

function readBool(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function readNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
