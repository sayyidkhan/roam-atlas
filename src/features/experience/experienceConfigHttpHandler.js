/**
 * Public, non-secret runtime settings consumed by the browser experience.
 * Provider credentials and private configuration must never cross this HTTP
 * boundary.
 */
export function handleExperienceConfigHttpRequest({ response, experienceConfig, defaultImageQuality }) {
  const {
    loadNextDestinationsEarly,
    maxParallelImageJobs,
    providerConcurrency,
    interactiveReservedSlots,
    prefetchDestinationLimit,
    loadCountryPackEarly,
    showLoadingSteps
  } = experienceConfig;
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  });
  response.end(JSON.stringify({
    loadNextDestinationsEarly,
    maxParallelImageJobs,
    providerConcurrency,
    interactiveReservedSlots,
    prefetchDestinationLimit,
    loadCountryPackEarly,
    showLoadingSteps,
    defaultImageQuality,
    imageQualityOptions: ["low", "medium", "high"]
  }));
}
