export const PLACE_IMAGE_FACT_BOUNDARY =
  "Reference photo from an external search result. It is not evidence of current appearance, availability, or official status.";

interface PlaceImageCandidate {
  imageUrl?: unknown;
}

interface PlaceImageRecord {
  imageUrl?: unknown;
  remoteImageUrl?: unknown;
}

export interface PlaceImageDimensions {
  width: number;
  height: number;
}

export function getPlaceImageCandidateClaimKey(
  candidate: PlaceImageCandidate | null | undefined
): string {
  return normalizePlaceImageClaimUrl(candidate?.imageUrl);
}

export function getPlaceImageRecordClaimKey(
  record: PlaceImageRecord | null | undefined
): string {
  return normalizePlaceImageClaimUrl(record?.remoteImageUrl ?? record?.imageUrl);
}

export function normalizePlaceImageClaimUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, "http://runtime.local");
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function normalizePlaceImageClaimPlace(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function hasUsablePlaceImageDimensions(
  imageBuffer: Buffer,
  contentType: string
): boolean {
  const dimensions = readPlaceImageDimensions(imageBuffer, contentType);
  if (!dimensions) return true;
  const { width, height } = dimensions;
  if (width < 240 || height < 160) return false;
  const ratio = width / height;
  return ratio >= 0.28 && ratio <= 3.5;
}

export function readPlaceImageDimensions(
  imageBuffer: Buffer,
  contentType: string
): PlaceImageDimensions | null {
  if (
    contentType.includes("image/png") &&
    imageBuffer.length >= 24 &&
    imageBuffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return {
      width: imageBuffer.readUInt32BE(16),
      height: imageBuffer.readUInt32BE(20)
    };
  }
  if (!contentType.includes("image/jpeg") && !contentType.includes("image/jpg")) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < imageBuffer.length) {
    if (imageBuffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = imageBuffer[offset + 1];
    const length = imageBuffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: imageBuffer.readUInt16BE(offset + 5),
        width: imageBuffer.readUInt16BE(offset + 7)
      };
    }
    offset += length + 2;
  }
  return null;
}
