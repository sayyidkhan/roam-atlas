import { singaporeCountryPack } from "./singapore.js";
import { malaysiaCountryPack } from "./malaysia.js";

export const DEFAULT_COUNTRY_SLUG = "singapore";

export const countryPacks = {
  [singaporeCountryPack.countrySlug]: singaporeCountryPack,
  [malaysiaCountryPack.countrySlug]: malaysiaCountryPack
};

export function getCountryPack(countrySlug) {
  return countryPacks[countrySlug] ?? null;
}

export function requireCountryPack(countrySlug) {
  const pack = getCountryPack(countrySlug);
  if (!pack) {
    throw new Error(`No WanderSG country pack is registered for ${countrySlug}.`);
  }
  return pack;
}

export function hasCountryPack(countrySlug) {
  return Boolean(getCountryPack(countrySlug));
}
