const COUNTRY_MEDIA_PAGE_OVERRIDES = Object.freeze({
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

export function getCountryMediaPageTitle(country) {
  return (
    COUNTRY_MEDIA_PAGE_OVERRIDES[country.code] ??
    country.name
      .replace(/\s*&\s*/g, " and ")
      .replace(/^St\.\s+/i, "Saint ")
      .replace(/\s+-\s+/g, " ")
  );
}

export function isAllowedCountryMediaUrl(value) {
  try {
    const mediaUrl = new URL(value);
    return (
      mediaUrl.protocol === "https:" &&
      /(^|\.)wikimedia\.org$/i.test(mediaUrl.hostname)
    );
  } catch {
    return false;
  }
}

export function getCountryWikipediaArticleCandidates(
  country,
  pageTitle,
  topics
) {
  const candidates = [];
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
  pages,
  candidateTitles,
  pageTitle
) {
  const candidateRanks = new Map(
    candidateTitles.map((title, index) => [title.toLowerCase(), index])
  );
  const candidates = pages
    .map((page) => {
      const candidatePageTitle = String(page?.title ?? "");
      const imageUrl = page?.thumbnail?.source ?? null;
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
          decodeURIComponent(candidate.imageUrl)
        )
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.pageTitle.localeCompare(right.pageTitle)
    );

  return candidates[0]
    ? {
        imageUrl: candidates[0].imageUrl,
        pageTitle: candidates[0].pageTitle
      }
    : null;
}

export function selectCountrySearchImage(pages, topic, pageTitle) {
  const topicTerms = normalizeMediaSearchTerms(topic);
  const candidates = pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = imageInfo?.thumburl ?? imageInfo?.url ?? null;
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

  return candidates[0]?.score > 0
    ? {
        imageUrl: candidates[0].imageUrl
      }
    : null;
}

export function getCountryMediaCategoryTitles(pageTitle) {
  return [
    `Landscapes of ${pageTitle}`,
    `Tourism in ${pageTitle}`,
    `Cities in ${pageTitle}`,
    `Nature of ${pageTitle}`
  ];
}

export function selectCountryCommonsImage(pages, pageTitle) {
  const candidates = pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = imageInfo?.thumburl ?? imageInfo?.url ?? null;
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

  return candidates[0]
    ? {
        imageUrl: candidates[0].imageUrl
      }
    : null;
}

function getCountryNameVariants(country, pageTitle) {
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

function normalizeCountryArticleTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[’]/g, "'")
    .trim();
}

function isCountryArticleTitleTooGeneric(title, country, pageTitle) {
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreCountryArticleImage(pageTitleValue, imageUrl, pageTitle, rank) {
  if (!pageTitleValue || !imageUrl) return 0;
  let score = Math.max(1, 16 - rank);
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(pageTitleValue)) score += 4;
  if (pageTitleValue.toLowerCase().includes(pageTitle.toLowerCase())) score += 2;
  if (/\.(?:jpe?g|webp)(?:$|[/?#])/i.test(imageUrl)) score += 2;
  if (/\.(?:svg|png)(?:$|[/?#])/i.test(imageUrl)) score -= 2;
  if (COUNTRY_MEDIA_EXCLUDE_PATTERN.test(pageTitleValue)) score = 0;
  return score;
}

function getCountryMediaRelevance(title, topicTerms, pageTitle) {
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

function normalizeMediaSearchTerms(value) {
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
  title,
  topicTerms,
  pageTitle,
  relevance
) {
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

function scoreCountryMediaTitle(title, pageTitle) {
  const value = String(title ?? "");
  let score = 0;
  if (value.toLowerCase().includes(pageTitle.toLowerCase())) score += 3;
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(value)) score += 4;
  if (/^File:\d/.test(value)) score -= 2;
  if (/-\s*(?:free|memories)\s*-/i.test(value)) score -= 2;
  return score;
}
