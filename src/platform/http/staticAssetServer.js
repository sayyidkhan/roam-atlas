import { readFile } from "node:fs/promises";
import path from "node:path";

import { mimeTypeForPath } from "./mediaTypes.js";
import {
  isMutableRuntimeJsonPath,
  isPathInside,
  normalizeRuntimeCacheRelativePath
} from "../runtime/runtimeCacheFiles.js";

export function createStaticAssetServer({
  repositoryRoot,
  runtimeCacheRoot,
  runtimeCacheUrlPrefix,
  liveReloadScript = ""
}) {
  async function serveStaticAsset(pathname) {
    if (pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (pathname.startsWith(`${runtimeCacheUrlPrefix}/`)) {
      return serveRuntimeCacheAsset(pathname);
    }

    const relativeAssetPath =
      pathname === "/" || isAppRoutePath(pathname)
        ? "index.html"
        : pathname.replace(/^\/+/, "");
    const filePath = path.normalize(path.join(repositoryRoot, relativeAssetPath));
    if (!isPathInside(repositoryRoot, filePath)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": mimeTypeForPath(filePath),
      ...([".html", ".js", ".css"].includes(extension)
        ? { "Cache-Control": "no-cache" }
        : {})
    };

    if (relativeAssetPath === "index.html" && liveReloadScript) {
      const html = file.toString("utf8");
      const body = html.includes(liveReloadScript)
        ? html
        : html.replace("</body>", `${liveReloadScript}\n  </body>`);
      return new Response(body, { status: 200, headers });
    }

    return new Response(file, { status: 200, headers });
  }

  async function serveRuntimeCacheAsset(pathname) {
    const relativePath = decodeURIComponent(
      pathname.slice(runtimeCacheUrlPrefix.length + 1)
    );
    const compatibleRelativePath = normalizeRuntimeCacheRelativePath(relativePath);
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

  return { serveStaticAsset };
}

export function isAppRoutePath(pathname) {
  return !pathname.startsWith("/api/") && !path.extname(pathname);
}
