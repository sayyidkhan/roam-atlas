import { resolveFlipbookClick } from "@roamatlas/domain/flipbookPage.js";
import { listNextArtworkDestinations } from "@roamatlas/domain/nextArtworkDestinations.js";
import { canonicalRouteForNode } from "@roamatlas/domain/routes.js";
import {
  APPLICATION_RUNTIME_CONFIG
} from "../../app/applicationRuntimeConfig";
import {
  apiPath,
  fetchArtworkResource,
  setBrowserPath
} from "../../app/browserRuntime";
import {
  getPageArtworkCacheKey,
  getPageArtworkJobKey,
  isArtworkJobPending
} from "../artwork/artworkJobPolicy";
import {
  environmentPlanNeedsTargetRecovery,
  isCurrentEnvironmentPlan,
  normalizeEnvironmentPlan
} from "./environmentPlanPolicy";
import { createExplorerController } from "./explorerController";
import {
  clamp,
  clamp01,
  getContainedImageRect
} from "./sceneGeometry";

type ExplorerControllerDependencies = Parameters<
  typeof createExplorerController
>[0];

type ExplorerRuntimeDependencies = Pick<
  ExplorerControllerDependencies,
  | "clearLoadingPanel"
  | "elements"
  | "enterReadyPage"
  | "explorerClient"
  | "mergePrefetchedArtwork"
  | "prefetchNextDestinations"
  | "preloadArtworkImage"
  | "publishExplorerChromeContent"
  | "publishExplorerChromeState"
  | "publishExplorerDestinations"
  | "publishExplorerScene"
  | "render"
  | "renderImageGenerationPending"
  | "renderLoadingPanel"
  | "renderTransientScrollStatus"
  | "requestCurrentPageArtwork"
  | "requestSceneArtwork"
  | "state"
>;

export function createExplorerRuntime(
  dependencies: ExplorerRuntimeDependencies
) {
  return createExplorerController({
    ENVIRONMENT_PLAN_REQUEST_RETRY_MS:
      APPLICATION_RUNTIME_CONFIG
        .environmentPlanRequestRetryMs,
    ENVIRONMENT_PLAN_RETRY_DELAYS_MS:
      APPLICATION_RUNTIME_CONFIG
        .environmentPlanRetryDelaysMs,
    ENVIRONMENT_PLAN_SCHEMA_VERSION:
      APPLICATION_RUNTIME_CONFIG
        .environmentPlanSchemaVersion,
    apiPath,
    canonicalRouteForNode,
    clamp,
    clamp01,
    environmentPlanNeedsTargetRecovery,
    fetchArtworkResource,
    getContainedImageRect,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    isArtworkJobPending,
    isCurrentEnvironmentPlan,
    listNextArtworkDestinations,
    normalizeEnvironmentPlan,
    resolveFlipbookClick,
    setBrowserPath,
    ...dependencies
  });
}
