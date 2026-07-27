import { jsonResponse } from "../../platform/http/fetchResponses.js";
import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";

export function createExperienceConfigRoutes(dependencies) {
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
}) {
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
