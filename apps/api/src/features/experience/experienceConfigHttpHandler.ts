import type {
  RoamAtlasExperienceConfig
} from "@roamatlas/data/experienceConfig.js";
import { jsonResponse } from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";

type ExperienceConfigHttpDependencies = {
  defaultImageQuality: string;
  experienceConfig: RoamAtlasExperienceConfig;
};

export function createExperienceConfigRoutes(
  dependencies: ExperienceConfigHttpDependencies
): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(app, "GET", "/api/experience-config", () =>
      handleExperienceConfigHttpRequest(dependencies)
    );
  };
}

/**
 * Public, non-secret runtime settings consumed by the browser experience.
 * Provider credentials and private configuration must never cross this HTTP
 * boundary.
 */
export function handleExperienceConfigHttpRequest({
  experienceConfig,
  defaultImageQuality
}: ExperienceConfigHttpDependencies): Response {
  const {
    loadNextDestinationsEarly,
    maxParallelImageJobs,
    providerConcurrency,
    interactiveReservedSlots,
    prefetchDestinationLimit,
    loadCountryPackEarly,
    showLoadingSteps
  } = experienceConfig;
  return jsonResponse({
    loadNextDestinationsEarly,
    maxParallelImageJobs,
    providerConcurrency,
    interactiveReservedSlots,
    prefetchDestinationLimit,
    loadCountryPackEarly,
    showLoadingSteps,
    defaultImageQuality,
    imageQualityOptions: ["low", "medium", "high"]
  }, 200, { "Cache-Control": "no-cache" });
}
