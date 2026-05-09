import os from "node:os";
import path from "node:path";

export const RUNTIME_CACHE_URL_PREFIX = "/runtime-cache";

export function resolveRuntimeCacheRoot(env = process.env) {
  return path.resolve(env.WANDERSG_RUNTIME_CACHE_DIR ?? path.join(os.tmpdir(), "wandersg-runtime-cache"));
}

export function sanitizeCacheSlug(value) {
  return String(value).replace(/[^a-z0-9.-]+/gi, "-");
}

export function createRuntimeCachePaths({ cacheRoot, pageId, imageModel }) {
  const pageSlug = sanitizeCacheSlug(pageId);
  const modelSlug = sanitizeCacheSlug(imageModel);
  const imageFileName = `${pageSlug}.${modelSlug}.png`;
  const metadataFileName = `${pageSlug}.${modelSlug}.json`;
  const jobFileName = `${pageSlug}.json`;

  return {
    pageSlug,
    modelSlug,
    jobPath: path.join(cacheRoot, "image-jobs", jobFileName),
    jobUrl: `${RUNTIME_CACHE_URL_PREFIX}/image-jobs/${jobFileName}`,
    imagePath: path.join(cacheRoot, "flipbook", imageFileName),
    imageUrl: `${RUNTIME_CACHE_URL_PREFIX}/flipbook/${imageFileName}`,
    metadataPath: path.join(cacheRoot, "flipbook", metadataFileName),
    metadataUrl: `${RUNTIME_CACHE_URL_PREFIX}/flipbook/${metadataFileName}`,
    understandingPath: path.join(cacheRoot, "understanding", `${pageSlug}.json`),
    understandingUrl: `${RUNTIME_CACHE_URL_PREFIX}/understanding/${pageSlug}.json`
  };
}
