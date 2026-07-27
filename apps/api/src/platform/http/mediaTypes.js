import path from "node:path";

const MEDIA_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp"
});

export function mimeTypeForPath(filePath) {
  return MEDIA_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function mimeTypeForImagePath(imagePath) {
  const mimeType = mimeTypeForPath(imagePath);
  return mimeType.startsWith("image/") ? mimeType : "application/octet-stream";
}
