import type { CountryImageCountry } from "./countryImageTypes.ts";

interface WikimediaThumbnail {
  source?: unknown;
}

interface WikimediaImageInfo {
  thumburl?: unknown;
  url?: unknown;
  mime?: unknown;
}

export interface WikimediaPage {
  title?: unknown;
  thumbnail?: WikimediaThumbnail | null;
  imageinfo?: WikimediaImageInfo[] | null;
}

interface CountryMediaRelevance {
  matchedTerms: string[];
  distinctiveMatchedTerms: string[];
  includesCountryPageTitle: boolean;
  isRelevant: boolean;
}

export interface SelectedCountryMedia {
  imageUrl: string;
  pageTitle?: string;
}

const COUNTRY_MEDIA_PAGE_OVERRIDES: Readonly<Record<string, string>> =
  Object.freeze({
  BA: "Bosnia and Herzegovina",
  BO: "Bolivia",
  BN: "Brunei",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CI: "Ivory Coast",
  CV: "Cape Verde",
  FM: "Federated States of Micronesia",
  KN: "Saint Kitts and Nevis",
  KP: "North Korea",
  KR: "South Korea",
  LA: "Laos",
  LC: "Saint Lucia",
  MD: "Moldova",
  PS: "State of Palestine",
  RU: "Russia",
  ST: "Sao Tome and Principe",
  SY: "Syria",
  TZ: "Tanzania",
  VC: "Saint Vincent and the Grenadines",
  VE: "Venezuela",
  VN: "Vietnam"
  });

const COUNTRY_MEDIA_EXCLUDE_PATTERN =
  /(^|[^a-z])(?:flag|coat|arms|emblem|seal|orthographic|projection|location|locator|map|population|density|diagram|chart|graph|gdp|growth|economic|economy|stamp|coin|portrait|president|minister|king|queen|parliament|battle|war|army|military|police|navy|aircraft|letter|logo|manuscript|document|pdf|djvu|text|plate|script|inscription|passport|visa|banknote|currency|montage|collage)([^a-z]|$)/i;

const COUNTRY_MEDIA_PLACE_PATTERN =
  /(?:village|town|city|cidade|capital|skyline|coast|harbou?r|beach|island|mountain|valley|river|lake|lagoon|reef|shoreline|forest|desert|waterfall|falls|park|garden|palace|pavilion|tower|gate|bridge|hall|temple|church|cathedral|mosque|castle|fort|fortress|street|old town|landscape|view|bay|port|plain|plateau|reserve|road|reservoir|market|monument|cave|arch|ruins|heritage|luanda)/i;

const COUNTRY_MEDIA_GENERIC_TOPIC_TERMS = new Set([
  "bay",
  "beach",
  "bridge",
  "capital",
  "castle",
  "cathedral",
  "city",
  "coast",
  "desert",
  "falls",
  "fort",
  "fortress",
  "garden",
  "harbor",
  "harbour",
  "island",
  "lake",
  "lagoon",
  "monastery",
  "monument",
  "mosque",
  "mountain",
  "museum",
  "national",
  "old",
  "palace",
  "park",
  "river",
  "skyline",
  "temple",
  "tower",
  "towers",
  "valley"
]);

export function getCountryMediaPageTitle(
  country: CountryImageCountry
): string {
  return (
    COUNTRY_MEDIA_PAGE_OVERRIDES[country.code] ??
    country.name
      .replace(/\s*&\s*/g, " and ")
      .replace(/^St\.\s+/i, "Saint ")
      .replace(/\s+-\s+/g, " ")
  );
}

export function isAllowedCountryMediaUrl(value: unknown): boolean {
  try {
    const mediaUrl = new URL(String(value));
    return (
      mediaUrl.protocol === "https:" &&
      /(^|\.)wikimedia\.org$/i.test(mediaUrl.hostname)
    );
  } catch {
    return false;
  }
}

export function getCountryWikipediaArticleCandidates(
  country: CountryImageCountry,
  pageTitle: string,
  topics: readonly unknown[]
): string[] {
  const candidates: string[] = [];
  for (const topic of topics) {
    const normalizedTopic = normalizeCountryArticleTitle(topic);
    if (!normalizedTopic) continue;

    candidates.push(normalizedTopic);
    for (const variant of getCountryNameVariants(country, pageTitle)) {
      const stripped = normalizedTopic
        .replace(new RegExp(`^${escapeRegExp(variant)}\\s+`, "i"), "")
        .trim();
      if (stripped && stripped !== normalizedTopic) candidates.push(stripped);
    }

    const words = normalizedTopic.split(/\s+/).filter(Boolean);
    for (
      let dropCount = 1;
      dropCount <= Math.min(5, words.length - 1);
      dropCount += 1
    ) {
      const suffix = words.slice(dropCount).join(" ");
      if (suffix.length >= 4) candidates.push(suffix);
    }
  }

  return [...new Set(candidates)]
    .filter(
      (title) =>
        title && !isCountryArticleTitleTooGeneric(title, country, pageTitle)
    )
    .slice(0, 14);
}

export function selectCountryArticleImage(
  pages: readonly WikimediaPage[],
  candidateTitles: readonly string[],
  pageTitle: string
): SelectedCountryMedia | null {
  const candidateRanks = new Map(
    candidateTitles.map((title, index) => [title.toLowerCase(), index])
  );
  const candidates = pages
    .map((page) => {
      const candidatePageTitle = String(page?.title ?? "");
      const imageUrl = normalizeMediaUrl(page?.thumbnail?.source);
      const rank =
        candidateRanks.get(candidatePageTitle.toLowerCase()) ??
        candidateTitles.length;
      return {
        pageTitle: candidatePageTitle,
        imageUrl,
        score: scoreCountryArticleImage(
          candidatePageTitle,
          imageUrl,
          pageTitle,
          rank
        )
      };
    })
    .filter(
      (candidate) =>
        candidate.imageUrl &&
        candidate.score > 0 &&
        isAllowedCountryMediaUrl(candidate.imageUrl) &&
        !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(candidate.pageTitle) &&
        !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(
          decodeMediaUrl(candidate.imageUrl)
        )
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.pageTitle.localeCompare(right.pageTitle)
    );

  const selected = candidates[0];
  return selected?.imageUrl
    ? {
        imageUrl: selected.imageUrl,
        pageTitle: selected.pageTitle
      }
    : null;
}

export function selectCountrySearchImage(
  pages: readonly WikimediaPage[],
  topic: unknown,
  pageTitle: string
): SelectedCountryMedia | null {
  const topicTerms = normalizeMediaSearchTerms(topic);
  const candidates = pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = normalizeMediaUrl(
        imageInfo?.thumburl ?? imageInfo?.url
      );
      const title = String(page?.title ?? "");
      const relevance = getCountryMediaRelevance(
        title,
        topicTerms,
        pageTitle
      );
      return {
        title,
        imageUrl,
        mime: String(imageInfo?.mime ?? ""),
        score: scoreCountrySearchCandidate(
          title,
          topicTerms,
          pageTitle,
          relevance
        ),
        relevance
      };
    })
    .filter(
      (candidate) =>
        candidate.imageUrl &&
        candidate.relevance.isRelevant &&
        candidate.mime.startsWith("image/") &&
        isAllowedCountryMediaUrl(candidate.imageUrl) &&
        !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(candidate.title) &&
        !/\.(?:svg|pdf|djvu)$/i.test(candidate.title)
    )
    .sort(
      (left, right) =>
        right.score - left.score || left.title.localeCompare(right.title)
    );

  const selected = candidates[0];
  return selected?.imageUrl && selected.score > 0
    ? {
        imageUrl: selected.imageUrl
      }
    : null;
}

export function getCountryMediaCategoryTitles(pageTitle: string): string[] {
  return [
    `Landscapes of ${pageTitle}`,
    `Tourism in ${pageTitle}`,
    `Cities in ${pageTitle}`,
    `Nature of ${pageTitle}`
  ];
}

export function selectCountryCommonsImage(
  pages: readonly WikimediaPage[],
  pageTitle: string
): SelectedCountryMedia | null {
  const candidates = pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = normalizeMediaUrl(
        imageInfo?.thumburl ?? imageInfo?.url
      );
      return {
        title: String(page?.title ?? ""),
        imageUrl,
        mime: String(imageInfo?.mime ?? ""),
        score: scoreCountryMediaTitle(page?.title, pageTitle)
      };
    })
    .filter(
      (candidate) =>
        candidate.imageUrl &&
        candidate.mime.startsWith("image/") &&
        isAllowedCountryMediaUrl(candidate.imageUrl) &&
        !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(candidate.title)
    )
    .sort(
      (left, right) =>
        right.score - left.score || left.title.localeCompare(right.title)
    );

  const selected = candidates[0];
  return selected?.imageUrl
    ? {
        imageUrl: selected.imageUrl
      }
    : null;
}

function getCountryNameVariants(
  country: CountryImageCountry,
  pageTitle: string
): string[] {
  return [
    pageTitle,
    country.name,
    country.name.replace(/\s*&\s*/g, " and "),
    country.name.replace(/^St\.\s+/i, "Saint "),
    country.code
  ]
    .map(normalizeCountryArticleTitle)
    .filter(Boolean);
}

function normalizeCountryArticleTitle(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[’]/g, "'")
    .trim();
}

function isCountryArticleTitleTooGeneric(
  title: string,
  country: CountryImageCountry,
  pageTitle: string
): boolean {
  const normalizedTitle = title.toLowerCase();
  return (
    normalizedTitle === country.name.toLowerCase() ||
    normalizedTitle === pageTitle.toLowerCase() ||
    normalizedTitle === country.code.toLowerCase() ||
    [
      "city",
      "capital city",
      "skyline",
      "beach",
      "lagoon",
      "island"
    ].includes(normalizedTitle)
  );
}

function escapeRegExp(value: unknown): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeMediaUrl(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function scoreCountryArticleImage(
  pageTitleValue: string,
  imageUrl: string | null,
  pageTitle: string,
  rank: number
): number {
  if (!pageTitleValue || !imageUrl) return 0;
  let score = Math.max(1, 16 - rank);
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(pageTitleValue)) score += 4;
  if (pageTitleValue.toLowerCase().includes(pageTitle.toLowerCase())) score += 2;
  if (/\.(?:jpe?g|webp)(?:$|[/?#])/i.test(imageUrl)) score += 2;
  if (/\.(?:svg|png)(?:$|[/?#])/i.test(imageUrl)) score -= 2;
  if (COUNTRY_MEDIA_EXCLUDE_PATTERN.test(pageTitleValue)) score = 0;
  return score;
}

function getCountryMediaRelevance(
  title: unknown,
  topicTerms: readonly string[],
  pageTitle: string
): CountryMediaRelevance {
  const normalizedTitle = String(title ?? "").toLowerCase();
  const matchedTerms = topicTerms.filter((term) =>
    normalizedTitle.includes(term)
  );
  const distinctiveMatchedTerms = matchedTerms.filter(
    (term) => !COUNTRY_MEDIA_GENERIC_TOPIC_TERMS.has(term)
  );
  const includesCountryPageTitle = normalizedTitle.includes(
    pageTitle.toLowerCase()
  );
  return {
    matchedTerms,
    distinctiveMatchedTerms,
    includesCountryPageTitle,
    isRelevant:
      distinctiveMatchedTerms.length > 0 ||
      matchedTerms.length >= 2 ||
      includesCountryPageTitle
  };
}

function normalizeMediaSearchTerms(value: unknown): string[] {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(
      (term) =>
        term.length > 2 && !["the", "and", "city"].includes(term)
    );
}

function scoreCountrySearchCandidate(
  title: string,
  topicTerms: readonly string[],
  pageTitle: string,
  relevance: CountryMediaRelevance
): number {
  const normalizedTitle = String(title ?? "").toLowerCase();
  let score = 0;
  for (const term of topicTerms) {
    if (normalizedTitle.includes(term)) score += 3;
  }
  score += relevance.distinctiveMatchedTerms.length * 4;
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(normalizedTitle)) score += 3;
  if (normalizedTitle.includes(pageTitle.toLowerCase())) score += 2;
  if (/\.(?:jpe?g|webp)$/i.test(normalizedTitle)) score += 2;
  if (/^file:\d/.test(normalizedTitle)) score -= 2;
  return score;
}

function scoreCountryMediaTitle(title: unknown, pageTitle: string): number {
  const value = String(title ?? "");
  let score = 0;
  if (value.toLowerCase().includes(pageTitle.toLowerCase())) score += 3;
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(value)) score += 4;
  if (/^File:\d/.test(value)) score -= 2;
  if (/-\s*(?:free|memories)\s*-/i.test(value)) score -= 2;
  return score;
}

function normalizeMediaUrl(value: unknown): string | null {
  const mediaUrl = String(value ?? "").trim();
  return mediaUrl || null;
}
