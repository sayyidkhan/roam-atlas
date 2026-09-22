import { ROAMATLAS_CONFIG } from "../config/roamAtlasConfig.ts";

export type ImageQuality = "low" | "medium" | "high" | "auto";
export type ImageOutputFormat = "png" | "jpeg" | "webp";

export const DEFAULT_IMAGE_PROVIDER = String(ROAMATLAS_CONFIG.image.provider);
export const DEFAULT_IMAGE_MODEL = String(ROAMATLAS_CONFIG.image.model);
export const DEFAULT_IMAGE_SIZE = String(ROAMATLAS_CONFIG.image.size);
export const DEFAULT_IMAGE_QUALITY = ROAMATLAS_CONFIG.image.quality as ImageQuality;
export const DEFAULT_IMAGE_OUTPUT_FORMAT =
  ROAMATLAS_CONFIG.image.outputFormat as ImageOutputFormat;
export const DEFAULT_IMAGE_OUTPUT_COMPRESSION = Number(
  ROAMATLAS_CONFIG.image.outputCompression
);
export const DEFAULT_IMAGE_PARTIAL_IMAGES = Number(
  ROAMATLAS_CONFIG.image.partialImages
);
export const DEFAULT_IMAGE_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;

export const IMAGE_REQUEST_TIMEOUT_MS_BY_QUALITY: Readonly<
  Record<ImageQuality, number>
> = Object.freeze({
  low: 1 * 60 * 1000,
  medium: 3 * 60 * 1000,
  high: 5 * 60 * 1000,
  auto: 3 * 60 * 1000
});

export const DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT = `
You are the travel image prompt compiler and visual style director.

Always generate images in this app's restrained flipbook encyclopedia style:
- clean isometric or lightly axonometric architectural planning illustration
- precise thin grey ink outlines
- flat muted pastel colors
- desaturated greens and pale blues
- light beige paths and roads
- generous spacing and clear object separation
- medium-low density
- calm urban planning proposal board feeling
- illustrated encyclopedia / museum guide page feeling

The image should feel like a clean travel visual encyclopedia page, not a
tourist poster, not a dense atlas, not a fantasy city, and not a children's book.

Short readable text is allowed only when it is supplied by the app: page titles,
curated node names, short chapter labels, numbers, and one- to three-word callout
headings. Do not invent prices, opening hours, route times, official signage,
source citations, marketing copy, or long factual paragraphs.

Compose for a browser viewport. Keep important subjects, labels, callouts, and
faces inside the central 3:2 safe area. Use simple water, paper, lawn, road, or
sky-like areas near the outer edges so full-screen cover cropping does not cut
off the important content.
`.trim();

export function normalizeImageModel(model: unknown = DEFAULT_IMAGE_MODEL): string {
  const value = String(model ?? "").trim().toLowerCase();
  if (
    value === "image2.5" ||
    value === "image-2.5" ||
    value === "gpt image 2.5"
  ) {
    return "gpt-image-2.5-flare-2026-09-08";
  }
  if (value === "gpt-image-2.5-flare") {
    return "gpt-image-2.5-flare-2026-09-08";
  }
  if (value === "gpt-image-2.5-sunburst") {
    return "gpt-image-2.5-sunburst-2026-09-08";
  }
  if (value === "image2" || value === "image-2" || value === "gpt image 2") {
    return "gpt-image-2";
  }
  return value || DEFAULT_IMAGE_MODEL;
}

export function normalizeImageQuality(
  value: unknown = DEFAULT_IMAGE_QUALITY
): ImageQuality {
  const normalized = String(value ?? "auto").trim().toLowerCase();
  return isImageQuality(normalized) ? normalized : "medium";
}

export function normalizeImageOutputFormat(
  value: unknown = DEFAULT_IMAGE_OUTPUT_FORMAT
): ImageOutputFormat {
  const normalized = String(value ?? "png").trim().toLowerCase();
  if (normalized === "jpg") return "jpeg";
  return isImageOutputFormat(normalized) ? normalized : "jpeg";
}

export function normalizeImageCompression(
  value: unknown = DEFAULT_IMAGE_OUTPUT_COMPRESSION
): number {
  const parsed = Number.parseInt(String(value), 10);
  return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : 82));
}

export function normalizeImageRequestTimeout(
  value: unknown = DEFAULT_IMAGE_REQUEST_TIMEOUT_MS
): number {
  const parsed = Number.parseInt(String(value), 10);
  return Math.min(
    10 * 60 * 1000,
    Math.max(
      10_000,
      Number.isFinite(parsed) ? parsed : DEFAULT_IMAGE_REQUEST_TIMEOUT_MS
    )
  );
}

export function resolveImageRequestTimeoutMs({
  quality = DEFAULT_IMAGE_QUALITY,
  requestTimeoutMs = null
}: {
  quality?: unknown;
  requestTimeoutMs?: unknown;
} = {}): number {
  if (requestTimeoutMs != null && String(requestTimeoutMs).trim() !== "") {
    return normalizeImageRequestTimeout(requestTimeoutMs);
  }
  return IMAGE_REQUEST_TIMEOUT_MS_BY_QUALITY[normalizeImageQuality(quality)];
}

function isImageQuality(value: string): value is ImageQuality {
  return ["low", "medium", "high", "auto"].includes(value);
}

function isImageOutputFormat(value: string): value is ImageOutputFormat {
  return ["png", "jpeg", "webp"].includes(value);
}
