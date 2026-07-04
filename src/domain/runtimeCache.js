import os from "node:os";
import path from "node:path";

export const RUNTIME_CACHE_URL_PREFIX = "/runtime-cache";
export const DEFAULT_RUNTIME_COUNTRY_SLUG = "singapore";

export function resolveRuntimeCacheRoot(env = process.env) {
  return path.resolve(env.WANDERSG_RUNTIME_CACHE_DIR || path.join(os.tmpdir(), "wandersg-runtime-cache"));
}

export function sanitizeCacheSlug(value) {
  return String(value).replace(/[^a-z0-9.-]+/gi, "-");
}

export function createRuntimeCachePaths({
  cacheRoot,
  pageId,
  imageModel,
  countrySlug = DEFAULT_RUNTIME_COUNTRY_SLUG
}) {
  const countryCacheSlug = sanitizeCacheSlug(countrySlug || DEFAULT_RUNTIME_COUNTRY_SLUG);
  const pageSlug = sanitizeCacheSlug(pageId);
  const modelSlug = sanitizeCacheSlug(imageModel);
  const imageFileName = `${pageSlug}.${modelSlug}.png`;
  const metadataFileName = `${pageSlug}.${modelSlug}.json`;
  const environmentFileName = `${pageSlug}.${modelSlug}.json`;
  const jobFileName = `${pageSlug}.json`;
  const countryUrlPrefix = `${RUNTIME_CACHE_URL_PREFIX}/${countryCacheSlug}`;
  const countryCacheRoot = path.join(cacheRoot, countryCacheSlug);

  return {
    countrySlug: countryCacheSlug,
    pageSlug,
    modelSlug,
    countryCacheRoot,
    jobPath: path.join(countryCacheRoot, "image-jobs", jobFileName),
    jobUrl: `${countryUrlPrefix}/image-jobs/${jobFileName}`,
    imagePath: path.join(countryCacheRoot, "flipbook", imageFileName),
    imageUrl: `${countryUrlPrefix}/flipbook/${imageFileName}`,
    metadataPath: path.join(countryCacheRoot, "flipbook", metadataFileName),
    metadataUrl: `${countryUrlPrefix}/flipbook/${metadataFileName}`,
    environmentPath: path.join(countryCacheRoot, "environment", environmentFileName),
    environmentUrl: `${countryUrlPrefix}/environment/${environmentFileName}`,
    understandingPath: path.join(countryCacheRoot, "understanding", `${pageSlug}.json`),
    understandingUrl: `${countryUrlPrefix}/understanding/${pageSlug}.json`
  };
}

export function createCountryStarterMapCachePaths({
  cacheRoot,
  countrySlug = DEFAULT_RUNTIME_COUNTRY_SLUG
}) {
  const countryCacheSlug = sanitizeCacheSlug(countrySlug || DEFAULT_RUNTIME_COUNTRY_SLUG);
  const countryUrlPrefix = `${RUNTIME_CACHE_URL_PREFIX}/${countryCacheSlug}`;
  const countryCacheRoot = path.join(cacheRoot, countryCacheSlug);

  return {
    countrySlug: countryCacheSlug,
    countryCacheRoot,
    starterMapPath: path.join(countryCacheRoot, "starter-map", "country.json"),
    starterMapUrl: `${countryUrlPrefix}/starter-map/country.json`,
    starterMapConfirmationPath: path.join(countryCacheRoot, "starter-map", "confirmation.json"),
    starterMapConfirmationUrl: `${countryUrlPrefix}/starter-map/confirmation.json`,
    countryPackDraftPath: path.join(countryCacheRoot, "country-pack-draft", "country.json"),
    countryPackDraftUrl: `${countryUrlPrefix}/country-pack-draft/country.json`
  };
}
