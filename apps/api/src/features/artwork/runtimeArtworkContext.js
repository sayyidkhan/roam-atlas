const LEGACY_RUNTIME_DIRECTORIES = new Set([
  "image-jobs",
  "codex-jobs",
  "flipbook",
  "understanding",
  "environment"
]);

export function createRuntimeArtworkContext({
  defaultCountrySlug,
  defaultRuntimeCountrySlug,
  runtimeCacheUrlPrefix,
  getCountryPack
}) {
  const defaultCountryPack = getCountryPack(defaultCountrySlug);

  function getCountryPackForPage(page) {
    return getCountryPack(getCountrySlugForPage(page)) ?? defaultCountryPack;
  }

  function getCountrySlugForPage(page) {
    return (
      sanitizeCountrySlug(page?.countrySlug) ??
      getCountrySlugFromUrl(page?.imageUrl) ??
      defaultRuntimeCountrySlug
    );
  }

  function getCountrySlugForJob(job) {
    return (
      sanitizeCountrySlug(job?.countrySlug) ??
      getCountrySlugFromUrl(job?.imageUrl) ??
      defaultRuntimeCountrySlug
    );
  }

  function getCountrySlugFromUrl(imageUrl) {
    const value = String(imageUrl ?? "");
    if (!value.startsWith(`${runtimeCacheUrlPrefix}/`)) return null;
    const relativePath = value.slice(runtimeCacheUrlPrefix.length + 1);
    const [firstSegment] = relativePath.split("/");
    if (
      !firstSegment ||
      LEGACY_RUNTIME_DIRECTORIES.has(firstSegment)
    ) {
      return null;
    }
    return sanitizeCountrySlug(firstSegment);
  }

  function resolveAssetVersionForPage(page) {
    return (
      page?.assetVersion ??
      page?.generated?.assetVersion ??
      extractAssetVersionFromRuntimeUrl(page?.imageUrl) ??
      extractAssetVersionFromRuntimeUrl(page?.generated?.jobUrl) ??
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

export function extractAssetVersionFromRuntimeUrl(url) {
  const match = String(url ?? "").match(
    /\.([a-f0-9]{16})(?:\.partial)?\.(?:json|png|jpe?g|webp)$/i
  );
  return match?.[1] ?? null;
}

function sanitizeCountrySlug(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}
