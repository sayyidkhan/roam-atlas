export const PLACE_IMAGE_FACT_BOUNDARY =
  "Reference photo from an external search result. It is not evidence of current appearance, availability, or official status.";

export const PLACE_IMAGE_HISTORY_LIMIT = 6;

export function normalizePlaceImageFeedback(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function getMappedPlaceImageSuggestionContext(country, place, getCountryPack) {
  const normalizedPlace = normalizePlaceName(place);
  const pack = country ? getCountryPack(country.slug) : null;
  const node = Object.values(pack?.nodes ?? {}).find(
    (candidate) => normalizePlaceName(candidate?.title) === normalizedPlace
  );
  if (!node) return null;

  return {
    title: node.title,
    kind: node.type ?? node.tags?.[0] ?? "region",
    children: (node.childIds ?? [])
      .map((childId) => pack.nodes[childId]?.title)
      .filter(Boolean)
      .slice(0, 6)
  };
}

export function normalizePlaceImagePromptSuggestions(value, { place, context }) {
  const allowedTerms = [place, ...(Array.isArray(context) ? context : [])]
    .map((item) => normalizePlaceName(item))
    .filter((item) => item.length >= 3);

  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => normalizePlaceImageFeedback(item))
    .filter((item) => item.length >= 12)
    .filter((item) => allowedTerms.some((term) => item.toLowerCase().includes(term)))
    .slice(0, 3))];
}

export function buildPlaceImagePromptSuggestionFallbacks(
  country,
  { place, context, currentFeedback }
) {
  const mappedChildren = Array.isArray(context) ? context.filter(Boolean).slice(0, 3) : [];
  const base = `${place} ${country.name}`.trim();
  const suggestions = mappedChildren.length
    ? mappedChildren.map(
      (child) => `Show ${child} in ${country.name}; use a representative real photograph.`
    )
    : [`Show ${base} as a representative real photograph.`];

  suggestions.push(
    currentFeedback
      ? `${currentFeedback} Keep the search within ${place}, ${country.name}.`
      : `Show a real photograph of ${base}; avoid generic Singapore landmarks outside this mapped area.`
  );
  return [...new Set(
    suggestions.map((suggestion) => normalizePlaceImageFeedback(suggestion))
  )].slice(0, 3);
}

export function toPlaceImageHistoryItem(record) {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    active: Boolean(record.active),
    feedback: record.feedback ?? null,
    fetchedAt: record.fetchedAt ?? null,
    archivedAt: record.archivedAt ?? null
  };
}

export function getPlaceImageCandidateClaimKey(candidate) {
  return normalizePlaceImageClaimUrl(candidate?.imageUrl);
}

export function getPlaceImageRecordClaimKey(record) {
  return normalizePlaceImageClaimUrl(record?.remoteImageUrl ?? record?.imageUrl);
}

export function normalizePlaceImageClaimUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, "http://runtime.local");
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function normalizePlaceImageClaimPlace(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function hasUsablePlaceImageDimensions(imageBuffer, contentType) {
  const dimensions = readPlaceImageDimensions(imageBuffer, contentType);
  if (!dimensions) return true;
  const { width, height } = dimensions;
  if (width < 240 || height < 160) return false;
  const ratio = width / height;
  return ratio >= 0.28 && ratio <= 3.5;
}

export function readPlaceImageDimensions(imageBuffer, contentType) {
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

function normalizePlaceName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}
