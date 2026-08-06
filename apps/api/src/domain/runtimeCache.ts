import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

export const RUNTIME_CACHE_URL_PREFIX = "/runtime-cache";
export const DEFAULT_RUNTIME_COUNTRY_SLUG = "default-country";

export type RuntimeImageFormat = "jpeg" | "png" | "webp";

export type ImageVariantKeyInput = {
  dataVersion?: unknown;
  fallbackImageModel?: unknown;
  imageModel?: unknown;
  outputCompression?: unknown;
  outputFormat?: unknown;
  prompt?: unknown;
  promptVersion?: unknown;
  quality?: unknown;
  size?: unknown;
  styleVersion?: unknown;
};

export type RuntimeCachePathsOptions = {
  cacheRoot: string;
  countrySlug?: string;
  imageModel: string;
  outputFormat?: unknown;
  pageId: string;
  variantKey?: string | null;
};

export type PlaceImageCachePathsOptions = {
  cacheRoot: string;
  countrySlug?: string;
  place: string;
};

export type CountryStarterMapCachePathsOptions = {
  cacheRoot: string;
  countrySlug?: string;
};

export type CountryArtworkQualityLockPathsOptions = {
  cacheRoot: string;
  countrySlug?: string;
};

export function resolveRuntimeCacheRoot(
  environment: Record<string, string | undefined> = process.env
): string {
  return path.resolve(
    environment.ROAMATLAS_RUNTIME_CACHE_DIR ||
      path.join(os.tmpdir(), "roamatlas-runtime-cache")
  );
}

export function sanitizeCacheSlug(value: unknown): string {
  return String(value).replace(/[^a-z0-9.-]+/gi, "-");
}

export function normalizeRuntimeImageFormat(
  value: unknown = "png"
): RuntimeImageFormat {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "jpg") return "jpeg";
  return isRuntimeImageFormat(normalized) ? normalized : "png";
}

export function createImageVariantKey({
  prompt,
  imageModel,
  fallbackImageModel,
  size,
  quality,
  outputFormat,
  outputCompression,
  promptVersion,
  styleVersion,
  dataVersion
}: ImageVariantKeyInput): string {
  const payload = JSON.stringify({
    prompt: String(prompt ?? ""),
    imageModel: String(imageModel ?? ""),
    fallbackImageModel: String(fallbackImageModel ?? ""),
    size: String(size ?? ""),
    quality: String(quality ?? ""),
    outputFormat: normalizeRuntimeImageFormat(outputFormat),
    outputCompression: Number(outputCompression ?? 0),
    promptVersion: String(promptVersion ?? ""),
    styleVersion: String(styleVersion ?? ""),
    dataVersion: String(dataVersion ?? "")
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function createRuntimeCachePaths({
  cacheRoot,
  pageId,
  imageModel,
  countrySlug = DEFAULT_RUNTIME_COUNTRY_SLUG,
  outputFormat = "png",
  variantKey = null
}: RuntimeCachePathsOptions) {
  const countryCacheSlug = sanitizeCacheSlug(
    countrySlug || DEFAULT_RUNTIME_COUNTRY_SLUG
  );
  const pageSlug = sanitizeCacheSlug(pageId);
  const modelSlug = sanitizeCacheSlug(imageModel);
  const format = normalizeRuntimeImageFormat(outputFormat);
  const extension = format === "jpeg" ? "jpg" : format;
  const safeVariantKey = variantKey ? sanitizeCacheSlug(variantKey) : null;
  const variantSuffix = safeVariantKey ? `.${safeVariantKey}` : "";
  const imageFileName =
    `${pageSlug}.${modelSlug}${variantSuffix}.${extension}`;
  const partialImageFileName =
    `${pageSlug}.${modelSlug}${variantSuffix}.partial.${extension}`;
  const metadataFileName = `${pageSlug}.${modelSlug}${variantSuffix}.json`;
  const environmentFileName = `${pageSlug}.${modelSlug}${variantSuffix}.json`;
  const jobFileName = `${pageSlug}${variantSuffix}.json`;
  const countryUrlPrefix =
    `${RUNTIME_CACHE_URL_PREFIX}/${countryCacheSlug}`;
  const countryCacheRoot = path.join(cacheRoot, countryCacheSlug);

  return {
    countrySlug: countryCacheSlug,
    pageSlug,
    modelSlug,
    countryCacheRoot,
    variantKey: safeVariantKey,
    outputFormat: format,
    jobPath: path.join(countryCacheRoot, "image-jobs", jobFileName),
    jobUrl: `${countryUrlPrefix}/image-jobs/${jobFileName}`,
    imagePath: path.join(countryCacheRoot, "flipbook", imageFileName),
    imageUrl: `${countryUrlPrefix}/flipbook/${imageFileName}`,
    partialImagePath: path.join(
      countryCacheRoot,
      "flipbook",
      partialImageFileName
    ),
    partialImageUrl:
      `${countryUrlPrefix}/flipbook/${partialImageFileName}`,
    metadataPath: path.join(countryCacheRoot, "flipbook", metadataFileName),
    metadataUrl: `${countryUrlPrefix}/flipbook/${metadataFileName}`,
    environmentPath: path.join(
      countryCacheRoot,
      "environment",
      environmentFileName
    ),
    environmentUrl:
      `${countryUrlPrefix}/environment/${environmentFileName}`,
    understandingPath: path.join(
      countryCacheRoot,
      "understanding",
      `${pageSlug}${variantSuffix}.json`
    ),
    understandingUrl:
      `${countryUrlPrefix}/understanding/${pageSlug}${variantSuffix}.json`
  };
}

export function createPlaceImageCachePaths({
  cacheRoot,
  countrySlug = DEFAULT_RUNTIME_COUNTRY_SLUG,
  place
}: PlaceImageCachePathsOptions) {
  const countryCacheSlug = sanitizeCacheSlug(
    countrySlug || DEFAULT_RUNTIME_COUNTRY_SLUG
  );
  const placeSlug =
    sanitizeCacheSlug(place.trim().toLowerCase()) || "place";
  const countryUrlPrefix =
    `${RUNTIME_CACHE_URL_PREFIX}/${countryCacheSlug}`;
  const countryCacheRoot = path.join(cacheRoot, countryCacheSlug);

  return {
    countrySlug: countryCacheSlug,
    placeSlug,
    countryCacheRoot,
    metadataPath: path.join(
      countryCacheRoot,
      "place-images",
      `${placeSlug}.json`
    ),
    metadataUrl: `${countryUrlPrefix}/place-images/${placeSlug}.json`,
    historyRoot: path.join(
      countryCacheRoot,
      "place-images",
      `${placeSlug}.history`
    ),
    historyMetadataPath: path.join(
      countryCacheRoot,
      "place-images",
      `${placeSlug}.history.json`
    ),
    historyMetadataUrl:
      `${countryUrlPrefix}/place-images/${placeSlug}.history.json`,
    imagePathForExtension: (extension: string) =>
      path.join(
        countryCacheRoot,
        "place-images",
        `${placeSlug}${extension}`
      ),
    imageUrlForExtension: (extension: string) =>
      `${countryUrlPrefix}/place-images/${placeSlug}${extension}`,
    historyImagePathForExtension: (
      entryId: string,
      extension: string
    ) =>
      path.join(
        countryCacheRoot,
        "place-images",
        `${placeSlug}.history`,
        `${sanitizeCacheSlug(entryId)}${extension}`
      ),
    historyImageUrlForExtension: (
      entryId: string,
      extension: string
    ) =>
      `${countryUrlPrefix}/place-images/${placeSlug}.history/` +
      `${sanitizeCacheSlug(entryId)}${extension}`
  };
}

export function createCountryStarterMapCachePaths({
  cacheRoot,
  countrySlug = DEFAULT_RUNTIME_COUNTRY_SLUG
}: CountryStarterMapCachePathsOptions) {
  const countryCacheSlug = sanitizeCacheSlug(
    countrySlug || DEFAULT_RUNTIME_COUNTRY_SLUG
  );
  const countryUrlPrefix =
    `${RUNTIME_CACHE_URL_PREFIX}/${countryCacheSlug}`;
  const countryCacheRoot = path.join(cacheRoot, countryCacheSlug);

  return {
    countrySlug: countryCacheSlug,
    countryCacheRoot,
    starterMapPath: path.join(
      countryCacheRoot,
      "starter-map",
      "country.json"
    ),
    starterMapUrl: `${countryUrlPrefix}/starter-map/country.json`,
    starterMapConfirmationPath: path.join(
      countryCacheRoot,
      "starter-map",
      "confirmation.json"
    ),
    starterMapConfirmationUrl:
      `${countryUrlPrefix}/starter-map/confirmation.json`,
    countryPackDraftPath: path.join(
      countryCacheRoot,
      "country-pack-draft",
      "country.json"
    ),
    countryPackDraftUrl:
      `${countryUrlPrefix}/country-pack-draft/country.json`
  };
}

export function createCountryArtworkQualityLockPaths({
  cacheRoot,
  countrySlug = DEFAULT_RUNTIME_COUNTRY_SLUG
}: CountryArtworkQualityLockPathsOptions) {
  const countryCacheSlug = sanitizeCacheSlug(
    countrySlug || DEFAULT_RUNTIME_COUNTRY_SLUG
  );
  const countryCacheRoot = path.join(cacheRoot, countryCacheSlug);

  return {
    countrySlug: countryCacheSlug,
    countryCacheRoot,
    qualityLockPath: path.join(
      countryCacheRoot,
      "image-jobs",
      "quality-lock.json"
    )
  };
}

function isRuntimeImageFormat(value: string): value is RuntimeImageFormat {
  return value === "png" || value === "jpeg" || value === "webp";
}
