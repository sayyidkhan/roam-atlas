/**
 * Browser client for curated country-pack API endpoints. It returns transport
 * payloads only; the registry decides how to retain those packs in memory.
 */
export async function fetchCountryPackRegistry({ fetchFn = fetch } = {}) {
  const response = await fetchFn("/api/country-packs?scope=summary", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RoamAtlas country pack registry failed to load: ${response.status}`);
  }
  return response.json();
}

export async function fetchCountryPack(countrySlug, { fetchFn = fetch } = {}) {
  const response = await fetchFn(
    `/api/country-packs?slug=${encodeURIComponent(countrySlug)}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`RoamAtlas country pack failed to load: ${countrySlug} (${response.status})`);
  }
  return response.json();
}
