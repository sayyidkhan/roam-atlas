import path from "node:path";

const MEDIA_USER_AGENT = "RoamAtlas/0.1 local-dev reference-media";

export type MediaImageExtension = ".jpeg" | ".jpg" | ".png" | ".webp";

export function createMediaMetadataFetchOptions(): RequestInit {
  return createMediaFetchOptions(4_500);
}

export function createMediaDownloadOptions(): RequestInit {
  return createMediaFetchOptions(30_000);
}

export function mediaImageExtension(
  contentType: string,
  imageUrl: string
): MediaImageExtension {
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) {
    return ".jpg";
  }

  try {
    const extension = path.extname(new URL(imageUrl).pathname.toLowerCase());
    if (isMediaImageExtension(extension)) {
      return extension;
    }
  } catch {
    // JPEG is the most common Wikimedia thumbnail format.
  }

  return ".jpg";
}

function createMediaFetchOptions(timeoutMs: number): RequestInit {
  return {
    headers: {
      "User-Agent": MEDIA_USER_AGENT
    },
    signal: AbortSignal.timeout(timeoutMs)
  };
}

function isMediaImageExtension(value: string): value is MediaImageExtension {
  return [".jpg", ".jpeg", ".png", ".webp"].includes(value);
}
