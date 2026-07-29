import type { RuntimePack } from "../../app/browserRuntime";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type CountryPackSummary = {
  countrySlug: string;
  confidence?: string;
  registration?: string;
  title?: string;
  [key: string]: unknown;
};

export type CountryPackRecord = RuntimePack &
  CountryPackSummary &
  Record<string, unknown>;

type CountryPackRegistryResponse = {
  countryPacks?: Record<string, CountryPackSummary>;
  defaultCountrySlug?: string;
};

type CountryPackResponse = {
  countryPack?: CountryPackRecord | null;
};

/**
 * Browser client for curated country-pack API endpoints. It returns transport
 * payloads only; the registry decides how to retain those packs in memory.
 */
export async function fetchCountryPackRegistry({
  fetchFn = fetch
}: { fetchFn?: FetchFn } = {}): Promise<CountryPackRegistryResponse> {
  const response = await fetchFn("/api/country-packs?scope=summary", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RoamAtlas country pack registry failed to load: ${response.status}`);
  }
  return response.json() as Promise<CountryPackRegistryResponse>;
}

export async function fetchCountryPack(
  countrySlug: string,
  { fetchFn = fetch }: { fetchFn?: FetchFn } = {}
): Promise<CountryPackResponse> {
  const response = await fetchFn(
    `/api/country-packs?slug=${encodeURIComponent(countrySlug)}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`RoamAtlas country pack failed to load: ${countrySlug} (${response.status})`);
  }
  return response.json() as Promise<CountryPackResponse>;
}
