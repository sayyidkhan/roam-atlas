import { rm } from "node:fs/promises";
import path from "node:path";

import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.ts";

export type RuntimeCacheRepository = {
  countryRootFor: (countrySlug: string) => string;
  isInsideCountryRoot: (
    countryCacheRoot: string,
    filePath: string
  ) => boolean;
  removeCountryRoot: (countryCacheRoot: string) => Promise<void>;
  removeFolders: (
    countryCacheRoot: string,
    folders: readonly string[]
  ) => Promise<void>;
};

type RuntimeCacheRepositoryOptions = {
  runtimeCacheRoot: string;
};

export function createRuntimeCacheRepository({
  runtimeCacheRoot
}: RuntimeCacheRepositoryOptions): RuntimeCacheRepository {
  function countryRootFor(countrySlug: string): string {
    return safeChildPath(runtimeCacheRoot, countrySlug);
  }

  async function removeFolders(
    countryCacheRoot: string,
    folders: readonly string[]
  ): Promise<void> {
    await Promise.all(
      folders.map((folder) =>
        rm(safeChildPath(countryCacheRoot, folder), {
          recursive: true,
          force: true
        })
      )
    );
  }

  async function removeCountryRoot(
    countryCacheRoot: string
  ): Promise<void> {
    assertCountryRoot(countryCacheRoot);
    await rm(countryCacheRoot, { recursive: true, force: true });
  }

  function isInsideCountryRoot(
    countryCacheRoot: string,
    filePath: string
  ): boolean {
    return isPathInside(
      path.normalize(countryCacheRoot),
      path.normalize(filePath)
    );
  }

  function assertCountryRoot(countryCacheRoot: string): void {
    const normalizedRoot = path.normalize(countryCacheRoot);
    if (
      normalizedRoot === path.normalize(runtimeCacheRoot) ||
      !isPathInside(runtimeCacheRoot, normalizedRoot)
    ) {
      throw new Error("Unsafe runtime country cache root.");
    }
  }

  return {
    countryRootFor,
    removeFolders,
    removeCountryRoot,
    isInsideCountryRoot
  };
}

function safeChildPath(parentPath: string, childSegment: string): string {
  const childPath = path.normalize(path.join(parentPath, childSegment));
  if (
    childPath === path.normalize(parentPath) ||
    !isPathInside(parentPath, childPath)
  ) {
    throw new Error(`Unsafe runtime cache path for ${childSegment}.`);
  }
  return childPath;
}
