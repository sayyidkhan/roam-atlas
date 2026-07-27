import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { worldCountries } from "@roamatlas/data/countries.js";
import { compileCountryPackData, createStarterCountryPackData } from "./compiler.js";

export const countryPacks = await loadCountryPacksFromDirectory();
export const DEFAULT_COUNTRY_SLUG = selectDefaultCountrySlug(countryPacks);

export function getCountryPack(countrySlug) {
  return countryPacks[countrySlug] ?? null;
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

async function loadCountryPacksFromDirectory() {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));
  const packs = {};

  for (const entry of entries) {
    if (entry.name === "index.js" || entry.name === "compiler.js" || entry.name === "serverRegistry.js") {
      continue;
    }

    if (path.extname(entry.name) !== ".json") continue;

    const data = JSON.parse(await readFile(path.join(directory, entry.name), "utf8"));
    const pack = compileCountryPackData(data);
    packs[pack.countrySlug] = pack;
  }

  for (const country of worldCountries) {
    if (packs[country.slug]) continue;
    const pack = compileCountryPackData(createStarterCountryPackData(country));
    packs[pack.countrySlug] = pack;
  }

  return packs;
}

function selectDefaultCountrySlug(packs) {
  const confirmedPack = Object.values(packs).find((pack) => pack.confidence === "confirmed");
  if (confirmedPack) return confirmedPack.countrySlug;

  const firstWorldCountry = worldCountries.find((country) => packs[country.slug]);
  if (firstWorldCountry) return firstWorldCountry.slug;

  return Object.keys(packs)[0] ?? null;
}
