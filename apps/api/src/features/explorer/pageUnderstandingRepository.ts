import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createRuntimeCachePaths } from "../../domain/runtimeCache.ts";
import type {
  PageUnderstanding,
  SemanticPage
} from "./semanticRegionPolicy.ts";

type PageUnderstandingRepositoryDependencies = {
  cacheRoot: string;
  getCountrySlugForPage: (page: SemanticPage) => string;
  imageModel: string;
  outputFormat: string;
  resolveAssetVersionForPage: (
    page: SemanticPage
  ) => string | null | undefined;
};

export type PageUnderstandingRepository = {
  read: (
    page: SemanticPage
  ) => Promise<PageUnderstanding | null>;
  write: (
    page: SemanticPage,
    understanding: PageUnderstanding
  ) => Promise<void>;
};

export function createPageUnderstandingRepository({
  cacheRoot,
  imageModel,
  outputFormat,
  getCountrySlugForPage,
  resolveAssetVersionForPage
}: PageUnderstandingRepositoryDependencies): PageUnderstandingRepository {
  function pathsFor(page: SemanticPage) {
    if (!page.id) {
      throw new Error(
        "Page understanding requires a stable page id."
      );
    }
    return createRuntimeCachePaths({
      cacheRoot,
      pageId: page.id,
      imageModel,
      countrySlug: getCountrySlugForPage(page),
      outputFormat,
      variantKey: resolveAssetVersionForPage(page)
    });
  }

  async function read(
    page: SemanticPage
  ): Promise<PageUnderstanding | null> {
    if (!page?.id) return null;
    try {
      const parsed = JSON.parse(
        await readFile(pathsFor(page).understandingPath, "utf8")
      ) as unknown;
      return isPageUnderstanding(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async function write(
    page: SemanticPage,
    understanding: PageUnderstanding
  ): Promise<void> {
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

function isPageUnderstanding(
  value: unknown
): value is PageUnderstanding {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PageUnderstanding>;
  return (
    typeof candidate.version === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.regions)
  );
}
