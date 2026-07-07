/**
 * RoamAtlas loading / prefetch defaults.
 * Override with env vars shown beside each field.
 */
export const ROAMATLAS_EXPERIENCE_CONFIG = {
  // ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY (ROAMATLAS_PREFETCH_ENABLED also works)
  // While you are on a screen, load artwork for the next destinations in the background.
  loadNextDestinationsEarly: true,

  // ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS
  // Max image jobs to queue ahead per screen, and max the server runs in parallel.
  maxParallelImageJobs: 10,

  // ROAMATLAS_LOAD_COUNTRY_PACK_EARLY (ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK also works)
  // Load country pack artwork early when the server starts.
  loadCountryPackEarly: false,

  // ROAMATLAS_SHOW_LOADING_STEPS (ROAMATLAS_LOADING_THINKING_UI also works)
  // Show step-by-step loading messages while a page image is being generated (UI not wired yet).
  showLoadingSteps: true
};

export function resolveRoamAtlasExperienceConfig(env = {}) {
  const maxParallelImageJobs = readInt(
    env.ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS ?? env.ROAMATLAS_MAX_IMAGE_JOBS,
    ROAMATLAS_EXPERIENCE_CONFIG.maxParallelImageJobs
  );

  return {
    loadNextDestinationsEarly: readBool(
      env.ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY ?? env.ROAMATLAS_PREFETCH_ENABLED,
      ROAMATLAS_EXPERIENCE_CONFIG.loadNextDestinationsEarly
    ),
    maxParallelImageJobs,
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

function readInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
