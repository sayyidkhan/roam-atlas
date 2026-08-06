import {
  createCountryArtworkQualityLockPaths,
  sanitizeCacheSlug
} from "../../domain/runtimeCache.ts";
import type {
  ArtworkJobRepository
} from "./artworkJobRepository.ts";

export type ArtworkImageQuality = "low" | "medium" | "high";

type CountryArtworkQualityLockServiceDependencies = {
  jobRepository: ArtworkJobRepository;
  normalizeImageQuality: (value: unknown) => string;
  runtimeCacheRoot: string;
};

/**
 * Keeps a country's generated artwork on one quality tier. The lock lives
 * inside image-jobs so a visual-cache reset deliberately removes it.
 */
export function createCountryArtworkQualityLockService({
  jobRepository,
  normalizeImageQuality,
  runtimeCacheRoot
}: CountryArtworkQualityLockServiceDependencies) {
  async function getLockedImageQuality(
    countrySlug: string
  ): Promise<ArtworkImageQuality | null> {
    const explicitLock = await readExplicitLock(countrySlug);
    if (explicitLock) return explicitLock;
    return findExistingArtworkQuality(countrySlug);
  }

  async function lockImageQuality(
    countrySlug: string,
    requestedImageQuality: unknown
  ): Promise<ArtworkImageQuality> {
    const imageQuality = asArtworkImageQuality(
      normalizeImageQuality(requestedImageQuality)
    );
    if (!imageQuality) {
      throw new Error("Artwork quality must be low, medium, or high.");
    }
    const paths = createCountryArtworkQualityLockPaths({
      cacheRoot: runtimeCacheRoot,
      countrySlug
    });
    const explicitLock = await readExplicitLock(countrySlug);
    const inheritedLock = explicitLock
      ? null
      : await findExistingArtworkQuality(countrySlug);
    const lockedImageQuality = explicitLock ?? inheritedLock;

    if (lockedImageQuality) return lockedImageQuality;

    await jobRepository.writeJsonArtifact(
      paths.qualityLockPath,
      {
        countrySlug: paths.countrySlug,
        imageQuality,
        lockedAt: new Date().toISOString(),
        factBoundary:
          "This configuration only keeps generated visual variants consistent; it is not a travel fact source."
      },
      paths.qualityLockPath
    );
    return imageQuality;
  }

  async function readExplicitLock(
    countrySlug: string
  ): Promise<ArtworkImageQuality | null> {
    const { qualityLockPath } = createCountryArtworkQualityLockPaths({
      cacheRoot: runtimeCacheRoot,
      countrySlug
    });
    const record = await jobRepository.readJob(qualityLockPath);
    return asArtworkImageQuality(record?.imageQuality);
  }

  async function findExistingArtworkQuality(
    countrySlug: string
  ): Promise<ArtworkImageQuality | null> {
    const normalizedCountrySlug = sanitizeCacheSlug(countrySlug);
    const { qualityLockPath } = createCountryArtworkQualityLockPaths({
      cacheRoot: runtimeCacheRoot,
      countrySlug
    });
    for (const { jobPath } of await jobRepository.listJobFiles()) {
      if (jobPath === qualityLockPath) continue;
      const job = await jobRepository.readJob(jobPath);
      if (
        sanitizeCacheSlug(String(job?.countrySlug ?? "")) !==
        normalizedCountrySlug
      ) {
        continue;
      }
      const imageQuality = asArtworkImageQuality(job?.imageQuality);
      if (imageQuality) return imageQuality;
    }
    return null;
  }

  return {
    getLockedImageQuality,
    lockImageQuality
  };
}

export type CountryArtworkQualityLockService = ReturnType<
  typeof createCountryArtworkQualityLockService
>;

function asArtworkImageQuality(
  value: unknown
): ArtworkImageQuality | null {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : null;
}
