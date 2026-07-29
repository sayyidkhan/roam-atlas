type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type BrowserExperienceConfig = {
  defaultImageQuality: string;
  imageQualityOptions?: string[];
  interactiveReservedSlots?: number;
  loadCountryPackEarly?: boolean;
  loadNextDestinationsEarly: boolean;
  maxParallelImageJobs: number;
  prefetchDestinationLimit?: number;
  providerConcurrency?: number;
  showLoadingSteps?: boolean;
  [key: string]: unknown;
};

export async function fetchExperienceConfig({
  fetchFn = fetch
}: { fetchFn?: FetchFn } = {}): Promise<BrowserExperienceConfig> {
  const response = await fetchFn("/api/experience-config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Experience config request failed: ${response.status}`);
  }
  return response.json() as Promise<BrowserExperienceConfig>;
}
