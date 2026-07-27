import { rm } from "node:fs/promises";
import path from "node:path";

import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.js";

export function createRuntimeCacheRepository({ runtimeCacheRoot }) {
  function countryRootFor(countrySlug) {
    return safeChildPath(runtimeCacheRoot, countrySlug);
  }

  async function removeFolders(countryCacheRoot, folders) {
    await Promise.all(
      folders.map((folder) =>
        rm(safeChildPath(countryCacheRoot, folder), {
          recursive: true,
          force: true
        })
      )
    );
  }

  async function removeCountryRoot(countryCacheRoot) {
    assertCountryRoot(countryCacheRoot);
    await rm(countryCacheRoot, { recursive: true, force: true });
  }

  function isInsideCountryRoot(countryCacheRoot, filePath) {
    return isPathInside(
      path.normalize(countryCacheRoot),
      path.normalize(filePath)
    );
  }

  return {
    countryRootFor,
    removeFolders,
    removeCountryRoot,
    isInsideCountryRoot
  };

  function assertCountryRoot(countryCacheRoot) {
    const normalizedRoot = path.normalize(countryCacheRoot);
    if (
      normalizedRoot === path.normalize(runtimeCacheRoot) ||
      !isPathInside(runtimeCacheRoot, normalizedRoot)
    ) {
      throw new Error("Unsafe runtime country cache root.");
    }
  }
}

function safeChildPath(parentPath, childSegment) {
  const childPath = path.normalize(path.join(parentPath, childSegment));
  if (
    childPath === path.normalize(parentPath) ||
    !isPathInside(parentPath, childPath)
  ) {
    throw new Error(`Unsafe runtime cache path for ${childSegment}.`);
  }
  return childPath;
}
