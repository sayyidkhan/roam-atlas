// Browser registry. The source-controlled file loader lives in
// serverRegistry.js so Vite never bundles Node filesystem dependencies.
import {
  fetchCountryPack,
  fetchCountryPackRegistry
} from "../../features/countryCatalog/countryPackClient.js";

export let countryPacks = {};
export let DEFAULT_COUNTRY_SLUG = "singapore";

export async function initCountryPackRegistry() {
  if (registryHasSummaries(countryPacks)) {
    return countryPacks;
  }

  const payload = await fetchCountryPackRegistry();
  countryPacks = payload.countryPacks ?? {};
  DEFAULT_COUNTRY_SLUG = payload.defaultCountrySlug ?? DEFAULT_COUNTRY_SLUG;
  return countryPacks;
}

export function getCountryPack(countrySlug) {
  return countryPacks[countrySlug] ?? null;
}

export async function ensureCountryPack(countrySlug) {
  await initCountryPackRegistry();

  const existing = countryPacks[countrySlug];
  if (existing?.nodes && existing?.scenes) {
    return existing;
  }

  const payload = await fetchCountryPack(countrySlug);
  const pack = payload.countryPack ?? null;
  if (pack) {
    countryPacks[countrySlug] = pack;
  }
  return pack;
}

export function requireCountryPack(countrySlug) {
  const pack = getCountryPack(countrySlug);
  if (!pack) {
    throw new Error(`No RoamAtlas country pack is registered for ${countrySlug}.`);
  }
  return pack;
}

export function hasCountryPack(countrySlug) {
  return Boolean(getCountryPack(countrySlug));
}

export function isSourceControlledCountryPack(countrySlugOrPack) {
  const pack = typeof countrySlugOrPack === "string"
    ? getCountryPack(countrySlugOrPack)
    : countrySlugOrPack;
  return pack?.registration === "source_controlled";
}

export function isConfiguredCountryPack(countrySlugOrPack) {
  return isSourceControlledCountryPack(countrySlugOrPack);
}

function registryHasSummaries(packs) {
  return Object.values(packs).some((pack) => pack?.countrySlug && !pack?.nodes);
}
