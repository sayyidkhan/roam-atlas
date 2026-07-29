export interface PlaceImageCountry {
  slug: string;
  name: string;
}

interface PlaceImagePackNode {
  title?: unknown;
  type?: unknown;
  tags?: unknown;
  childIds?: unknown;
}

interface PlaceImageCountryPack {
  nodes?: Record<string, PlaceImagePackNode | undefined>;
}

export interface PlaceImageSuggestionContext {
  title: string;
  kind: string;
  children: string[];
}

interface PlaceImageSuggestionOptions {
  place: string;
  context: string[];
}

interface PlaceImageFallbackOptions extends PlaceImageSuggestionOptions {
  currentFeedback?: unknown;
}

export function normalizePlaceImageFeedback(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function getMappedPlaceImageSuggestionContext(
  country: PlaceImageCountry | null | undefined,
  place: unknown,
  getCountryPack: (
    countrySlug: string
  ) => PlaceImageCountryPack | null | undefined
): PlaceImageSuggestionContext | null {
  const normalizedPlace = normalizePlaceName(place);
  const pack = country ? getCountryPack(country.slug) : null;
  const nodes = pack?.nodes ?? {};
  const node = Object.values(nodes).find(
    (candidate) => normalizePlaceName(candidate?.title) === normalizedPlace
  );
  if (!node) return null;

  const title = normalizeDisplayText(node.title);
  if (!title) return null;

  return {
    title,
    kind:
      normalizeDisplayText(node.type) ||
      normalizeDisplayText(Array.isArray(node.tags) ? node.tags[0] : "") ||
      "region",
    children: (Array.isArray(node.childIds) ? node.childIds : [])
      .map((childId) => nodes[String(childId)]?.title)
      .map(normalizeDisplayText)
      .filter((child): child is string => Boolean(child))
      .slice(0, 6)
  };
}

export function normalizePlaceImagePromptSuggestions(
  value: unknown,
  { place, context }: PlaceImageSuggestionOptions
): string[] {
  const allowedTerms = [place, ...(Array.isArray(context) ? context : [])]
    .map(normalizePlaceName)
    .filter((item) => item.length >= 3);

  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map(normalizePlaceImageFeedback)
        .filter((item) => item.length >= 12)
        .filter((item) =>
          allowedTerms.some((term) => item.toLowerCase().includes(term))
        )
        .slice(0, 3)
    )
  ];
}

export function buildPlaceImagePromptSuggestionFallbacks(
  country: Pick<PlaceImageCountry, "name">,
  { place, context, currentFeedback }: PlaceImageFallbackOptions
): string[] {
  const mappedChildren = Array.isArray(context)
    ? context.filter(Boolean).slice(0, 3)
    : [];
  const base = `${place} ${country.name}`.trim();
  const suggestions = mappedChildren.length
    ? mappedChildren.map(
      (child) =>
        `Show ${child} in ${country.name}; use a representative real photograph.`
    )
    : [`Show ${base} as a representative real photograph.`];

  suggestions.push(
    currentFeedback
      ? `${normalizePlaceImageFeedback(currentFeedback)} Keep the search within ${place}, ${country.name}.`
      : `Show a real photograph of ${base}; avoid generic Singapore landmarks outside this mapped area.`
  );
  return [
    ...new Set(suggestions.map(normalizePlaceImageFeedback))
  ].slice(0, 3);
}

function normalizePlaceName(value: unknown): string {
  return normalizeDisplayText(value).toLowerCase();
}

function normalizeDisplayText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
