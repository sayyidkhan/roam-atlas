import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import type {
  CountryDraft,
  CountryDraftCountry
} from "@roamatlas/domain/countryDraft.js";

import {
  createCountryStarterMapCachePaths
} from "../../domain/runtimeCache.ts";
import {
  isPathInside
} from "../../platform/runtime/runtimeCacheFiles.ts";
import type {
  StarterMapConfirmation
} from "./countryDraftPolicy.ts";

type CountryDraftRepositoryOptions = {
  cacheRoot: string;
};

type CountryDraftPromotion = {
  confirmation: StarterMapConfirmation;
  country: CountryDraftCountry;
  countryPackDraft: unknown;
};

export function createCountryDraftRepository({
  cacheRoot
}: CountryDraftRepositoryOptions) {
  function pathsFor(countrySlug: string) {
    const paths =
      createCountryStarterMapCachePaths({
        cacheRoot,
        countrySlug
      });
    if (
      !isPathInside(
        cacheRoot,
        paths.countryCacheRoot
      ) ||
      paths.countryCacheRoot === cacheRoot
    ) {
      throw new Error(
        `Unsafe country draft cache path for ${countrySlug}.`
      );
    }
    return paths;
  }

  async function read(
    country: CountryDraftCountry
  ): Promise<unknown | null> {
    const paths = pathsFor(country.slug);
    try {
      return JSON.parse(
        await readFile(
          paths.starterMapPath,
          "utf8"
        )
      ) as unknown;
    } catch {
      return null;
    }
  }

  async function write(
    country: CountryDraftCountry,
    draft: CountryDraft
  ) {
    const paths = pathsFor(country.slug);
    await mkdir(
      path.dirname(paths.starterMapPath),
      { recursive: true }
    );
    await writeFile(
      paths.starterMapPath,
      `${JSON.stringify(
        {
          countrySlug: country.slug,
          countryCode: country.code,
          countryName: country.name,
          draft,
          storageKind:
            "runtime-starter-map",
          factBoundary:
            draft.mode ===
            "curated_pack_snapshot"
              ? "Stored starter map is a runtime snapshot of the curated country pack."
              : "Stored starter maps are ai_generated and unconfirmed until promoted with sources.",
          updatedAt:
            new Date().toISOString()
        },
        null,
        2
      )}\n`
    );
    return paths;
  }

  async function writePromotion({
    country,
    confirmation,
    countryPackDraft
  }: CountryDraftPromotion) {
    const paths = pathsFor(country.slug);
    await mkdir(
      path.dirname(
        paths.starterMapConfirmationPath
      ),
      { recursive: true }
    );
    await mkdir(
      path.dirname(paths.countryPackDraftPath),
      { recursive: true }
    );
    await writeFile(
      paths.starterMapConfirmationPath,
      `${JSON.stringify(
        confirmation,
        null,
        2
      )}\n`
    );
    await writeFile(
      paths.countryPackDraftPath,
      `${JSON.stringify(
        countryPackDraft,
        null,
        2
      )}\n`
    );
    return paths;
  }

  return {
    read,
    write,
    writePromotion
  };
}
