import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createRuntimeCachePaths } from "../../domain/runtimeCache.js";

export function createPageUnderstandingRepository({
  cacheRoot,
  imageModel,
  outputFormat,
  getCountrySlugForPage,
  resolveAssetVersionForPage
}) {
  function pathsFor(page) {
    return createRuntimeCachePaths({
      cacheRoot,
      pageId: page.id,
      imageModel,
      countrySlug: getCountrySlugForPage(page),
      outputFormat,
      variantKey: resolveAssetVersionForPage(page)
    });
  }

  async function read(page) {
    if (!page?.id) return null;
    try {
      return JSON.parse(
        await readFile(pathsFor(page).understandingPath, "utf8")
      );
    } catch {
      return null;
    }
  }

  async function write(page, understanding) {
    if (!page?.id) return;
    const paths = pathsFor(page);
    await mkdir(path.dirname(paths.understandingPath), { recursive: true });
    await writeFile(
      paths.understandingPath,
      `${JSON.stringify(
        {
          ...understanding,
          pageId: page.id,
          countrySlug: getCountrySlugForPage(page),
          sceneId: page.sceneId ?? understanding.sceneId,
          nodeId: page.nodeId ?? understanding.nodeId,
          imageUrl: page.imageUrl ?? understanding.imageUrl,
          assetVersion:
            resolveAssetVersionForPage(page) ?? understanding.assetVersion,
          updatedAt: new Date().toISOString()
        },
        null,
        2
      )}\n`
    );
  }

  return { read, write };
}
