import path from "node:path";

const MEDIA_USER_AGENT = "RoamAtlas/0.1 local-dev reference-media";

export function createMediaMetadataFetchOptions() {
  return createMediaFetchOptions(4_500);
}

export function createMediaDownloadOptions() {
  return createMediaFetchOptions(30_000);
}

export function mediaImageExtension(contentType, imageUrl) {
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) {
    return ".jpg";
  }

  try {
    const extension = path.extname(new URL(imageUrl).pathname.toLowerCase());
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
      return extension;
    }
  } catch {
    // JPEG is the most common Wikimedia thumbnail format.
  }

  return ".jpg";
}

function createMediaFetchOptions(timeoutMs) {
  const fetchOptions = {
    headers: {
      "User-Agent": MEDIA_USER_AGENT
    }
  };
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    fetchOptions.signal = AbortSignal.timeout(timeoutMs);
  }
  return fetchOptions;
}
