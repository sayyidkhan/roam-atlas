const FORBIDDEN_DETAIL_PATTERNS = [
  /\bopening hours?\b/i,
  /\bhours?\b/i,
  /\btickets?\b/i,
  /\bprices?\b/i,
  /\bfares?\b/i,
  /\bcosts?\b/i,
  /\bclosures?\b/i,
  /\bclosed\b/i,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s?(?:am|pm)\b/i,
  /https?:\/\//i,
  /\$\s?\d/
];

const INTERNAL_THEME_TAGS = new Set([
  "starter-map",
  "unconfirmed",
  "overview",
  "worldwide",
  "confirmed",
  "likely",
  "general",
  "pending",
  "pending_source_review"
]);

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function safeText(
  value: unknown,
  fallback: string,
  maxLength: number
): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || containsForbiddenTravelDetail(text)) {
    return fallback;
  }
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1).trim()}...`
    : text;
}

export function titleCase(value: unknown): string {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

export function slugifyDraftId(value: unknown): string {
  return (
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "candidate"
  );
}

export function isInternalThemeTag(
  tag: unknown,
  countrySlug = ""
): boolean {
  const normalized = normalizeThemeTag(tag);
  if (!normalized) return true;
  if (INTERNAL_THEME_TAGS.has(normalized)) return true;
  const normalizedCountrySlug =
    normalizeThemeTag(countrySlug);
  return Boolean(
    normalizedCountrySlug &&
      normalized === normalizedCountrySlug
  );
}

export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeThemeTag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function containsForbiddenTravelDetail(
  text: string
): boolean {
  return FORBIDDEN_DETAIL_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}
