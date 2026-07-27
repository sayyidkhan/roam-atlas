import path from "node:path";

export function normalizeRuntimeCacheRelativePath(relativePath) {
  if (relativePath.startsWith("codex-jobs/")) {
    return relativePath.replace(/^codex-jobs\//, "image-jobs/");
  }

  return relativePath.replace(/^([^/]+)\/codex-jobs\//, "$1/image-jobs/");
}

export function isMutableRuntimeJsonPath(relativePath) {
  return (
    /^(?:[^/]+\/)?(?:image-jobs|codex-jobs|understanding|environment|starter-map|country-pack-draft)\//.test(relativePath) ||
    /^(?:[^/]+\/)?place-images\/[^/]+\.json$/.test(relativePath)
  );
}

export function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function createRuntimeArtifactPathResolver({
  repositoryRoot,
  runtimeCacheRoot,
  runtimeCacheUrlPrefix
}) {
  return function getImagePathFromUrl(imageUrl) {
    if (imageUrl.startsWith(`${runtimeCacheUrlPrefix}/`)) {
      const relativePath = decodeURIComponent(
        imageUrl.slice(runtimeCacheUrlPrefix.length + 1)
      );
      const imagePath = path.normalize(path.join(runtimeCacheRoot, relativePath));
      return isPathInside(runtimeCacheRoot, imagePath) ? imagePath : null;
    }

    const imagePath = path.normalize(
      path.join(repositoryRoot, imageUrl.replace(/^\.\//, ""))
    );
    return isPathInside(repositoryRoot, imagePath) ? imagePath : null;
  };
}
