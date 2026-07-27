/**
 * Browser application policy. Keep tunable timings, limits, storage keys, and
 * version gates here so feature controllers do not accumulate magic values.
 * Secrets and server/provider credentials must never be added to this file.
 */
export const APP_CONFIG = Object.freeze({
  storageKeys: Object.freeze({
    imageQuality: "roamatlas:image-quality"
  }),
  countryCatalog: Object.freeze({
    imageVersion: "country-media-v7",
    imageConcurrency: 2,
    localAssetBasePath: "/country-cards",
    localAssetExtension: "jpg",
    localAssetExtensionOverrides: Object.freeze({
      bahamas: "png",
      kiribati: "png"
    })
  }),
  imageQuality: Object.freeze({
    defaultValue: "high",
    options: Object.freeze([
      Object.freeze({ value: "low", label: "Low", description: "Fastest" }),
      Object.freeze({ value: "medium", label: "Medium", description: "Balanced" }),
      Object.freeze({
        value: "high",
        label: "High",
        description: "Best detail",
        recommended: true
      })
    ])
  }),
  artwork: Object.freeze({
    pollIntervalMs: 1_600,
    pollTimeoutMs: 10 * 60 * 1_000,
    requestTimeoutMs: 15 * 1_000
  }),
  environmentPlan: Object.freeze({
    retryDelaysMs: Object.freeze([0, 2_000, 5_000, 10_000, 20_000, 30_000]),
    requestRetryMs: 3_000,
    schemaVersion: "environment-plan-v4",
    promptVersion: "environment-plan-v7"
  }),
  countryDraft: Object.freeze({
    candidateNameMaxLength: 80,
    placeContextItemLimit: 3
  }),
  placeImages: Object.freeze({
    feedbackMaxLength: 240,
    promptSuggestionLimit: 3
  }),
  notifications: Object.freeze({
    defaultToastDurationMs: 5_200,
    errorToastDurationMs: 8_000,
    promptErrorToastDurationMs: 7_000,
    transientStatusDurationMs: 1_800
  }),
  query: Object.freeze({
    staleTimeMs: 30_000,
    garbageCollectionTimeMs: 5 * 60 * 1_000,
    retryCount: 2
  })
});
