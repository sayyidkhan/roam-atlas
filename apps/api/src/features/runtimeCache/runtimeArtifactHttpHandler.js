import { readFile } from "node:fs/promises";
import path from "node:path";

import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";
import { mimeTypeForPath } from "../../platform/http/mediaTypes.js";
import {
  isMutableRuntimeJsonPath,
  isPathInside,
  normalizeRuntimeCacheRelativePath
} from "../../platform/runtime/runtimeCacheFiles.js";

export function createRuntimeArtifactRoutes({
  runtimeCacheRoot,
  runtimeCacheUrlPrefix
}) {
  return (app) => {
    registerHonoRoute(
      app,
      "GET",
      `${runtimeCacheUrlPrefix}/*`,
      (context) =>
        serveRuntimeArtifact({
          pathname: new URL(context.req.url).pathname,
          runtimeCacheRoot,
          runtimeCacheUrlPrefix
        })
    );
  };
}

export async function serveRuntimeArtifact({
  pathname,
  runtimeCacheRoot,
  runtimeCacheUrlPrefix
}) {
  const relativePath = decodeURIComponent(
    pathname.slice(runtimeCacheUrlPrefix.length + 1)
  );
  const compatibleRelativePath =
    normalizeRuntimeCacheRelativePath(relativePath);
  const filePath = path.normalize(
    path.join(runtimeCacheRoot, compatibleRelativePath)
  );
  if (!isPathInside(runtimeCacheRoot, filePath)) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const isMutableRuntimeJson =
    isMutableRuntimeJsonPath(compatibleRelativePath);
  const isRuntimeImageFile = /\.(?:avif|gif|jpe?g|png|webp)$/i.test(extension);

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": mimeTypeForPath(filePath),
      "Cache-Control":
        isMutableRuntimeJson || isRuntimeImageFile
          ? "no-store"
          : "private, max-age=31536000, immutable"
    }
  });
}
