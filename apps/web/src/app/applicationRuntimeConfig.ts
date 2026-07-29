import { buildLoadingStepTrail } from "@roamatlas/domain/loadingSteps.js";

import { APP_CONFIG } from "../config/appConfig";
import type { LoadingJob } from "../features/explorer/explorerFeedbackController";

export const APPLICATION_RUNTIME_CONFIG = {
  artworkPollIntervalMs:
    APP_CONFIG.artwork.pollIntervalMs,
  artworkPollTimeoutMs:
    APP_CONFIG.artwork.pollTimeoutMs,
  environmentPlanRequestRetryMs:
    APP_CONFIG.environmentPlan.requestRetryMs,
  environmentPlanRetryDelaysMs:
    APP_CONFIG.environmentPlan.retryDelaysMs,
  environmentPlanSchemaVersion:
    APP_CONFIG.environmentPlan.schemaVersion,
  imageQualityOptions: APP_CONFIG.imageQuality.options,
  imageQualityStorageKey:
    APP_CONFIG.storageKeys.imageQuality,
  placeImageRequestSession: createRequestSession()
} as const;

export const ARTWORK_POLL_MAX_ATTEMPTS = Math.ceil(
  APPLICATION_RUNTIME_CONFIG.artworkPollTimeoutMs /
    APPLICATION_RUNTIME_CONFIG.artworkPollIntervalMs
);

export function buildBrowserLoadingStepTrail({
  job,
  pageTitle
}: {
  job: LoadingJob;
  pageTitle?: string;
}) {
  return buildLoadingStepTrail({ job, pageTitle });
}

function createRequestSession(): string {
  // An embedded config view may survive a local dev-server restart. A distinct
  // request session prevents a stale thumbnail response from being reused.
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
