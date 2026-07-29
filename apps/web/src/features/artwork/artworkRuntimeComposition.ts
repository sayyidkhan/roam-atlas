import { listNextArtworkDestinations } from "@roamatlas/domain/nextArtworkDestinations.js";
import {
  apiPath,
  fetchArtworkResource,
  toApiUrl
} from "../../app/browserRuntime";
import {
  ARTWORK_POLL_MAX_ATTEMPTS,
  APPLICATION_RUNTIME_CONFIG
} from "../../app/applicationRuntimeConfig";
import { fetchExperienceConfig } from "../experience/experienceConfigClient";
import { normalizeImageQuality } from "../experience/imageQualityPolicy";
import { createArtworkController } from "./artworkController";
import {
  getArtworkFailureMessage,
  getPageArtworkCacheKey,
  getPageArtworkJobKey,
  isArtworkJobFailed
} from "./artworkJobPolicy";

type ArtworkControllerDependencies = Parameters<
  typeof createArtworkController
>[0];

type ArtworkRuntimeDependencies = Pick<
  ArtworkControllerDependencies,
  | "enterReadyPage"
  | "explainClickError"
  | "getPageEnvironmentUrl"
  | "hasStoredImageQualityPreference"
  | "preloadArtworkImage"
  | "render"
  | "state"
>;

export function createArtworkRuntime(
  dependencies: ArtworkRuntimeDependencies
) {
  return createArtworkController({
    ARTWORK_POLL_INTERVAL_MS:
      APPLICATION_RUNTIME_CONFIG.artworkPollIntervalMs,
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS:
      APPLICATION_RUNTIME_CONFIG.artworkPollTimeoutMs,
    apiPath,
    fetchArtworkResource,
    fetchExperienceConfig,
    getArtworkFailureMessage,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    isArtworkJobFailed,
    listNextArtworkDestinations,
    normalizeImageQuality,
    toApiUrl,
    ...dependencies
  });
}
