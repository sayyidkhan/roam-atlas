export type CountryArtworkQualityLock = {
  countrySlug: string;
  imageQuality: "low" | "medium" | "high" | null;
  locked: boolean;
};

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function fetchCountryArtworkQualityLock({
  apiPath,
  countrySlug,
  fetchFn = fetch
}: {
  apiPath: (path: string) => string;
  countrySlug: string;
  fetchFn?: FetchFn;
}): Promise<CountryArtworkQualityLock> {
  const query = new URLSearchParams({ countrySlug });
  const response = await fetchFn(
    apiPath(`/api/artwork/quality-lock?${query.toString()}`),
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(
      `Artwork quality lock could not load: ${response.status}`
    );
  }
  return response.json() as Promise<CountryArtworkQualityLock>;
}
