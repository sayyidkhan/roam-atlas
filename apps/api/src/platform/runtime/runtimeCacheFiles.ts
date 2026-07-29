import path from "node:path";

export type RuntimeArtifactPathResolverOptions = {
  repositoryRoot: string;
  runtimeCacheRoot: string;
  runtimeCacheUrlPrefix: string;
};

export type RuntimeArtifactPathResolver = (
  imageUrl: string
) => string | null;

export function normalizeRuntimeCacheRelativePath(
  relativePath: string
): string {
  if (relativePath.startsWith("codex-jobs/")) {
    return relativePath.replace(
      /^codex-jobs\//,
      "image-jobs/"
    );
  }

  return relativePath.replace(
    /^([^/]+)\/codex-jobs\//,
    "$1/image-jobs/"
  );
}

export function isMutableRuntimeJsonPath(
  relativePath: string
): boolean {
  return (
    /^(?:[^/]+\/)?(?:image-jobs|codex-jobs|understanding|environment|starter-map|country-pack-draft)\//.test(
      relativePath
    ) ||
    /^(?:[^/]+\/)?place-images\/[^/]+\.json$/.test(
      relativePath
    )
  );
}

export function isPathInside(
  parentPath: string,
  childPath: string
): boolean {
  const relativePath = path.relative(
    parentPath,
    childPath
  );
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath))
  );
}

export function createRuntimeArtifactPathResolver({
  repositoryRoot,
  runtimeCacheRoot,
  runtimeCacheUrlPrefix
}: RuntimeArtifactPathResolverOptions):
  RuntimeArtifactPathResolver {
  return function getImagePathFromUrl(
    imageUrl: string
  ): string | null {
    if (
      imageUrl.startsWith(
        `${runtimeCacheUrlPrefix}/`
      )
    ) {
      const relativePath = decodeUrlPath(
        imageUrl.slice(
          runtimeCacheUrlPrefix.length + 1
        )
      );
      if (relativePath === null) return null;
      const imagePath = path.normalize(
        path.join(runtimeCacheRoot, relativePath)
      );
      return isPathInside(runtimeCacheRoot, imagePath)
        ? imagePath
        : null;
    }

    const imagePath = path.normalize(
      path.join(
        repositoryRoot,
        imageUrl.replace(/^\.\//, "")
      )
    );
    return isPathInside(repositoryRoot, imagePath)
      ? imagePath
      : null;
  };
}

function decodeUrlPath(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
