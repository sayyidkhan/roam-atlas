import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { worldCountries } from "@roamatlas/data/countries.js";
import {
  compileCountryPackData,
  createStarterCountryPackData,
  type CountryPackSource
} from "./compiler.ts";

export type CompiledCountryPack = ReturnType<
  typeof compileCountryPackData
>;

export const countryPacks =
  await loadCountryPacksFromDirectory();
export const DEFAULT_COUNTRY_SLUG =
  selectDefaultCountrySlug(countryPacks);

export function getCountryPack(
  countrySlug: string
): CompiledCountryPack | null {
  return countryPacks[countrySlug] ?? null;
}

export function requireCountryPack(
  countrySlug: string
): CompiledCountryPack {
  const pack = getCountryPack(countrySlug);
  if (!pack) {
    throw new Error(
      `No RoamAtlas country pack is registered for ${countrySlug}.`
    );
  }
  return pack;
}

export function hasCountryPack(countrySlug: string): boolean {
  return Boolean(getCountryPack(countrySlug));
}

export function isSourceControlledCountryPack(
  countrySlugOrPack:
    | string
    | CompiledCountryPack
    | null
    | undefined
): boolean {
  const pack =
    typeof countrySlugOrPack === "string"
      ? getCountryPack(countrySlugOrPack)
      : countrySlugOrPack;
  return pack?.registration === "source_controlled";
}

export function isConfiguredCountryPack(
  countrySlugOrPack:
    | string
    | CompiledCountryPack
    | null
    | undefined
): boolean {
  return isSourceControlledCountryPack(countrySlugOrPack);
}

async function loadCountryPacksFromDirectory(): Promise<
  Record<string, CompiledCountryPack>
> {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const entries = (
    await readdir(directory, { withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));
  const packs: Record<string, CompiledCountryPack> = {};

  for (const entry of entries) {
    if (path.extname(entry.name) !== ".json") continue;

    const source = parseCountryPackSource(
      await readFile(path.join(directory, entry.name), "utf8"),
      entry.name
    );
    const pack = compileCountryPackData(source);
    packs[pack.countrySlug] = pack;
  }

  for (const country of worldCountries) {
    if (packs[country.slug]) continue;
    const pack = compileCountryPackData(
      createStarterCountryPackData(country)
    );
    packs[pack.countrySlug] = pack;
  }

  return packs;
}

export function parseCountryPackSource(
  sourceText: string,
  filename: string
): CountryPackSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceText) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid country-pack JSON in ${filename}: ${errorMessage(error)}`
    );
  }
  if (!isRecord(parsed)) {
    throw new Error(
      `Invalid country pack in ${filename}: expected an object.`
    );
  }

  for (const field of [
    "confidence",
    "countryCode",
    "countrySlug",
    "overviewSceneId",
    "rootNodeId",
    "title"
  ] as const) {
    requireNonEmptyString(parsed, field, filename);
  }
  const nodes = requireRecord(parsed, "nodes", filename);
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!isRecord(node)) {
      throw new Error(
        `Invalid country pack in ${filename}: node ${nodeId} must be an object.`
      );
    }
    requireNonEmptyString(
      node,
      "id",
      `${filename} node ${nodeId}`
    );
  }
  const scenes = requireRecord(parsed, "scenes", filename);
  for (const [sceneId, scene] of Object.entries(scenes)) {
    if (!isRecord(scene)) {
      throw new Error(
        `Invalid country pack in ${filename}: scene ${sceneId} must be an object.`
      );
    }
    requireNonEmptyString(
      scene,
      "rootNodeId",
      `${filename} scene ${sceneId}`
    );
    requireNonEmptyString(
      scene,
      "title",
      `${filename} scene ${sceneId}`
    );
    requireNonEmptyString(
      scene,
      "visualContext",
      `${filename} scene ${sceneId}`
    );
  }

  return parsed as CountryPackSource;
}

function selectDefaultCountrySlug(
  packs: Record<string, CompiledCountryPack>
): string {
  const confirmedPack = Object.values(packs).find(
    (pack) => pack.confidence === "confirmed"
  );
  if (confirmedPack) return confirmedPack.countrySlug;

  const firstWorldCountry = worldCountries.find(
    (country) => packs[country.slug]
  );
  if (firstWorldCountry) return firstWorldCountry.slug;

  const firstSlug = Object.keys(packs)[0];
  if (!firstSlug) {
    throw new Error("RoamAtlas requires at least one country pack.");
  }
  return firstSlug;
}

function requireRecord(
  record: Record<string, unknown>,
  field: string,
  context: string
): Record<string, unknown> {
  const value = record[field];
  if (!isRecord(value)) {
    throw new Error(
      `Invalid country pack in ${context}: ${field} must be an object.`
    );
  }
  return value;
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  field: string,
  context: string
): string {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `Invalid country pack in ${context}: ${field} must be a non-empty string.`
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
