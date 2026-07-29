const LEGACY_RUNTIME_DIRECTORIES = new Set([
  "image-jobs",
  "codex-jobs",
  "flipbook",
  "understanding",
  "environment"
]);

export interface RuntimeArtworkReference {
  countrySlug?: unknown;
  imageUrl?: unknown;
  assetVersion?: unknown;
  generated?: {
    assetVersion?: unknown;
    jobUrl?: unknown;
  } | null;
}

interface RuntimeArtworkContextDependencies<TCountryPack extends object> {
  defaultCountrySlug: string;
  defaultRuntimeCountrySlug: string;
  runtimeCacheUrlPrefix: string;
  getCountryPack: (
    countrySlug: string
  ) => TCountryPack | null | undefined;
}

export interface RuntimeArtworkContext<TCountryPack extends object> {
  getCountryPackForPage: (page: unknown) => TCountryPack;
  getCountrySlugForPage: (page: unknown) => string;
  getCountrySlugForJob: (job: unknown) => string;
  resolveAssetVersionForPage: (page: unknown) => string | null;
}

export function createRuntimeArtworkContext<TCountryPack extends object>({
  defaultCountrySlug,
  defaultRuntimeCountrySlug,
  runtimeCacheUrlPrefix,
  getCountryPack
}: RuntimeArtworkContextDependencies<TCountryPack>): RuntimeArtworkContext<TCountryPack> {
  const configuredDefaultPack = getCountryPack(defaultCountrySlug);
  if (!configuredDefaultPack) {
    throw new Error(
      `No default country pack is registered for ${defaultCountrySlug}.`
    );
  }
  const defaultCountryPack: TCountryPack = configuredDefaultPack;

  function getCountryPackForPage(
    page: unknown
  ): TCountryPack {
    return getCountryPack(getCountrySlugForPage(page)) ?? defaultCountryPack;
  }

  function getCountrySlugForPage(page: unknown): string {
    const reference = toRuntimeArtworkReference(page);
    return (
      sanitizeCountrySlug(reference?.countrySlug) ??
      getCountrySlugFromUrl(reference?.imageUrl) ??
      defaultRuntimeCountrySlug
    );
  }

  function getCountrySlugForJob(job: unknown): string {
    const reference = toRuntimeArtworkReference(job);
    return (
      sanitizeCountrySlug(reference?.countrySlug) ??
      getCountrySlugFromUrl(reference?.imageUrl) ??
      defaultRuntimeCountrySlug
    );
  }

  function getCountrySlugFromUrl(imageUrl: unknown): string | null {
    const value = String(imageUrl ?? "");
    if (!value.startsWith(`${runtimeCacheUrlPrefix}/`)) return null;
    const relativePath = value.slice(runtimeCacheUrlPrefix.length + 1);
    const [firstSegment] = relativePath.split("/");
    if (!firstSegment || LEGACY_RUNTIME_DIRECTORIES.has(firstSegment)) {
      return null;
    }
    return sanitizeCountrySlug(firstSegment);
  }

  function resolveAssetVersionForPage(page: unknown): string | null {
    const reference = toRuntimeArtworkReference(page);
    return (
      normalizeAssetVersion(reference?.assetVersion) ??
      normalizeAssetVersion(reference?.generated?.assetVersion) ??
      extractAssetVersionFromRuntimeUrl(reference?.imageUrl) ??
      extractAssetVersionFromRuntimeUrl(reference?.generated?.jobUrl) ??
      null
    );
  }

  return {
    getCountryPackForPage,
    getCountrySlugForPage,
    getCountrySlugForJob,
    resolveAssetVersionForPage
  };
}

export function extractAssetVersionFromRuntimeUrl(url: unknown): string | null {
  const match = String(url ?? "").match(
    /\.([a-f0-9]{16})(?:\.partial)?\.(?:json|png|jpe?g|webp)$/i
  );
  return match?.[1] ?? null;
}

function sanitizeCountrySlug(value: unknown): string | null {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

function normalizeAssetVersion(value: unknown): string | null {
  const version = String(value ?? "").trim();
  return version || null;
}

function toRuntimeArtworkReference(
  value: unknown
): RuntimeArtworkReference | null {
  if (!value || typeof value !== "object") return null;
  return value as RuntimeArtworkReference;
}
