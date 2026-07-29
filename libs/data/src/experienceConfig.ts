export type RoamAtlasExperienceConfig = {
  loadNextDestinationsEarly: boolean;
  maxParallelImageJobs: number;
  providerConcurrency: number;
  interactiveReservedSlots: number;
  prefetchDestinationLimit: number;
  loadCountryPackEarly: boolean;
  showLoadingSteps: boolean;
};

export type ExperienceEnvironment = Record<
  string,
  string | undefined
>;

/**
 * RoamAtlas loading and prefetch defaults.
 * Override with the environment variables documented beside each field.
 */
export const ROAMATLAS_EXPERIENCE_CONFIG: Readonly<RoamAtlasExperienceConfig> =
  {
    // ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY
    // ROAMATLAS_PREFETCH_ENABLED also works.
    loadNextDestinationsEarly: true,

    // ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS (legacy compatibility only)
    maxParallelImageJobs: 10,

    // ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY
    providerConcurrency: 10,

    // ROAMATLAS_INTERACTIVE_RESERVED_SLOTS
    interactiveReservedSlots: 1,

    // ROAMATLAS_PREFETCH_DESTINATION_LIMIT
    prefetchDestinationLimit: 10,

    // ROAMATLAS_LOAD_COUNTRY_PACK_EARLY
    // ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK also works.
    loadCountryPackEarly: false,

    // ROAMATLAS_SHOW_LOADING_STEPS
    // ROAMATLAS_LOADING_THINKING_UI also works.
    showLoadingSteps: true
  };

export function resolveRoamAtlasExperienceConfig(
  env: ExperienceEnvironment = {}
): RoamAtlasExperienceConfig {
  const legacyMaxParallelOverride =
    env.ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS ??
    env.ROAMATLAS_MAX_IMAGE_JOBS;
  const maxParallelImageJobs = readNonNegativeInt(
    legacyMaxParallelOverride,
    ROAMATLAS_EXPERIENCE_CONFIG.maxParallelImageJobs
  );
  // Preserve the legacy value `0` as an explicit provider-off switch.
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
    env.ROAMATLAS_PREFETCH_DESTINATION_LIMIT ??
      legacyMaxParallelOverride,
    ROAMATLAS_EXPERIENCE_CONFIG.prefetchDestinationLimit
  );

  return {
    loadNextDestinationsEarly: readBool(
      env.ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY ??
        env.ROAMATLAS_PREFETCH_ENABLED,
      ROAMATLAS_EXPERIENCE_CONFIG.loadNextDestinationsEarly
    ),
    maxParallelImageJobs,
    providerConcurrency,
    interactiveReservedSlots,
    prefetchDestinationLimit,
    loadCountryPackEarly: readBool(
      env.ROAMATLAS_LOAD_COUNTRY_PACK_EARLY ??
        env.ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK,
      ROAMATLAS_EXPERIENCE_CONFIG.loadCountryPackEarly
    ),
    showLoadingSteps: readBool(
      env.ROAMATLAS_SHOW_LOADING_STEPS ??
        env.ROAMATLAS_LOADING_THINKING_UI,
      ROAMATLAS_EXPERIENCE_CONFIG.showLoadingSteps
    )
  };
}

function readBool(
  value: unknown,
  fallback: boolean
): boolean {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return fallback;
}

function readNonNegativeInt(
  value: unknown,
  fallback: number
): number {
  const parsed = Number.parseInt(
    String(value ?? "").trim(),
    10
  );
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
}
