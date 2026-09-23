import { createConfirmedExplorerPackSource } from "@roamatlas/domain/countryDraft.js";

import { compileCountryPackData } from "../../data/countryPacks/compiler.ts";
import type { CompiledCountryPack } from "../../data/countryPacks/compiler.ts";
import type { CountryPackSource } from "../../data/countryPacks/countryPackTypes.ts";

type ExplorerCountry = {
  code: string;
  name: string;
  slug: string;
};

type ConfirmedExplorerPackDependencies = {
  getCountryBySlug: (
    countrySlug: string
  ) => ExplorerCountry | null;
  readStoredDraft: (
    country: ExplorerCountry
  ) => Promise<unknown | null>;
};

export function createConfirmedExplorerPackResolver({
  getCountryBySlug,
  readStoredDraft
}: ConfirmedExplorerPackDependencies) {
  return async function resolveConfirmedExplorerPack(
    countrySlug: string
  ): Promise<CompiledCountryPack | null> {
    const country = getCountryBySlug(countrySlug);
    if (!country) return null;
    const stored = await readStoredDraft(country);
    const source = createConfirmedExplorerPackSource(stored);
    if (!source) return null;
    return compileCountryPackData(source as CountryPackSource);
  };
}
