// Browser registry. The source-controlled file loader lives in
// serverRegistry.ts so Vite never bundles Node filesystem dependencies.
import {
  fetchCountryPack,
  fetchCountryPackRegistry,
  type CountryPackRecord,
  type CountryPackSummary
} from "../../features/countryCatalog/countryPackClient.js";

type CountryPackEntry =
  | CountryPackRecord
  | CountryPackSummary;

export let countryPacks: Record<
  string,
  CountryPackEntry
> = {};
export let DEFAULT_COUNTRY_SLUG = "singapore";

export async function initCountryPackRegistry(): Promise<
  Record<string, CountryPackEntry>
> {
  if (registryHasSummaries(countryPacks)) {
    return countryPacks;
  }

  const payload = await fetchCountryPackRegistry();
  countryPacks = payload.countryPacks ?? {};
  DEFAULT_COUNTRY_SLUG = payload.defaultCountrySlug ?? DEFAULT_COUNTRY_SLUG;
  return countryPacks;
}

export function getCountryPack(
  countrySlug: string
): CountryPackEntry | null {
  return countryPacks[countrySlug] ?? null;
}

export async function ensureCountryPack(
  countrySlug: string
): Promise<CountryPackRecord | null> {
  await initCountryPackRegistry();

  const existing = countryPacks[countrySlug];
  if (isLoadedCountryPack(existing)) {
    return existing;
  }

  const payload = await fetchCountryPack(countrySlug);
  const pack = payload.countryPack ?? null;
  if (pack) {
    countryPacks[countrySlug] = pack;
  }
  return pack;
}

export function requireCountryPack(
  countrySlug: string
): CountryPackEntry {
  const pack = getCountryPack(countrySlug);
  if (!pack) {
    throw new Error(`No RoamAtlas country pack is registered for ${countrySlug}.`);
  }
  return pack;
}

export function hasCountryPack(countrySlug: string): boolean {
  return Boolean(getCountryPack(countrySlug));
}

export function isSourceControlledCountryPack(
  countrySlugOrPack: string | CountryPackEntry | null
): boolean {
  const pack = typeof countrySlugOrPack === "string"
    ? getCountryPack(countrySlugOrPack)
    : countrySlugOrPack;
  return pack?.registration === "source_controlled";
}

export function isConfiguredCountryPack(
  countrySlugOrPack: string | CountryPackEntry | null
): boolean {
  return isSourceControlledCountryPack(countrySlugOrPack);
}

function registryHasSummaries(
  packs: Record<string, CountryPackEntry>
): boolean {
  return Object.values(packs).some((pack) => pack?.countrySlug && !pack?.nodes);
}

function isLoadedCountryPack(
  pack: CountryPackEntry | undefined
): pack is CountryPackRecord {
  return Boolean(
    pack &&
      "nodes" in pack &&
      pack.nodes &&
      "scenes" in pack &&
      pack.scenes
  );
}
