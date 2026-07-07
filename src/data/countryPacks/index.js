import { worldCountries } from "../countries.js";
import { compileCountryPackData, createStarterCountryPackData } from "./compiler.js";

export let countryPacks = {};
export let DEFAULT_COUNTRY_SLUG = "singapore";

if (!isBrowserRuntime()) {
  countryPacks = await loadCountryPacksFromDirectory();
  DEFAULT_COUNTRY_SLUG = selectDefaultCountrySlug(countryPacks);
}

export async function initCountryPackRegistry() {
  if (!isBrowserRuntime()) {
    return countryPacks;
  }

  if (registryHasSummaries(countryPacks)) {
    return countryPacks;
  }

  const response = await fetch("/api/country-packs?scope=summary", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RoamAtlas country pack registry failed to load: ${response.status}`);
  }

  const payload = await response.json();
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

  const response = await fetch(`/api/country-packs?slug=${encodeURIComponent(countrySlug)}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`RoamAtlas country pack failed to load: ${countrySlug} (${response.status})`);
  }

  const payload = await response.json();
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

function isBrowserRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function registryHasSummaries(packs) {
  return Object.values(packs).some((pack) => pack?.countrySlug && !pack?.nodes);
}

async function loadCountryPacksFromDirectory() {
  const [{ readdir, readFile }, pathModule, urlModule] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("node:url")
  ]);
  const directory = pathModule.dirname(urlModule.fileURLToPath(import.meta.url));
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));
  const packs = {};

  for (const entry of entries) {
    if (entry.name === "index.js" || entry.name === "compiler.js") continue;

    const extname = pathModule.extname(entry.name);
    if (extname !== ".json") continue;

    const pack = await loadJsonCountryPack({ readFile, pathModule, directory, fileName: entry.name });
    packs[pack.countrySlug] = pack;
  }

  for (const country of worldCountries) {
    if (packs[country.slug]) continue;
    const pack = compileCountryPackData(createStarterCountryPackData(country));
    packs[pack.countrySlug] = pack;
  }

  return packs;
}

async function loadJsonCountryPack({ readFile, pathModule, directory, fileName }) {
  const filePath = pathModule.join(directory, fileName);
  const data = JSON.parse(await readFile(filePath, "utf8"));
  return compileCountryPackData(data);
}

function selectDefaultCountrySlug(packs) {
  const confirmedPack = Object.values(packs).find((pack) => pack.confidence === "confirmed");
  if (confirmedPack) return confirmedPack.countrySlug;

  const firstWorldCountry = worldCountries.find((country) => packs[country.slug]);
  if (firstWorldCountry) return firstWorldCountry.slug;

  return Object.keys(packs)[0] ?? null;
}
