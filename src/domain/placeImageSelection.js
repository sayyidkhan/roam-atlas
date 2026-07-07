export const PLACE_IMAGE_SELECTION_VERSION = "v2";

const REGION_CAPITALS = {
  malaysia: {
    johor: "Johor Bahru",
    sabah: "Kota Kinabalu",
    sarawak: "Kuching",
    penang: "George Town",
    melaka: "Malacca",
    "pulau pinang": "George Town"
  }
};

const TOURIST_SCENE_TERMS = [
  "langkawi",
  "redang",
  "tioman",
  "pangkor",
  "boracay",
  "phuket",
  "bali",
  "maldives",
  "seychelles",
  "archipelago",
  "national park",
  "beach resort"
];

const POSTER_PENALTY_PATTERN =
  /(?:^|[^a-z])(?:poster|brochure|banner|flyer|logo|logotype|favicon|sprite|icon|emblem|coat[- ]of[- ]arms|flag|infographic|promo|campaign|visit[-_.]|tourism[-_.]?board|travel[-_.]?fair|expo|thumbnail[-_.]?logo|brand[-_.]?guide)(?:[^a-z]|$)/i;

const PHOTO_BOOST_PATTERN =
  /(?:photo|photograph|gallery|image|skyline|cityscape|beach|coast|harbour|harbor|landscape|view|aerial|island|waterfall|rainforest|bay|lagoon|street|heritage|downtown|skyscraper|monument|temple|mosque|cathedral|fort|palace)/i;

export function inferPlaceImageProfile({
  place,
  countryName,
  countrySlug = "",
  kind = "",
  tags = [],
  context = ""
}) {
  const normalizedKind = normalizePlaceKind(kind, tags);
  const capital = lookupRegionCapital(countrySlug, place);
  const touristScene = isTouristScenePlace(place, tags, context);

  if (normalizedKind === "city" || looksLikeCityName(place)) {
    return {
      strategy: "metro",
      subject: place,
      queries: buildMetroQueries(place, countryName)
    };
  }

  if (capital && (normalizedKind === "state" || normalizedKind === "region")) {
    return {
      strategy: "metro",
      subject: capital,
      queries: buildMetroQueries(capital, countryName, { fallbackPlace: place })
    };
  }

  if (touristScene) {
    return {
      strategy: "scene",
      subject: place,
      queries: buildSceneQueries(place, countryName, context)
    };
  }

  if (normalizedKind === "state") {
    return {
      strategy: "mixed",
      subject: place,
      queries: [
        ...buildMetroQueries(`${place} capital`, countryName),
        ...buildSceneQueries(place, countryName, context)
      ]
    };
  }

  return {
    strategy: "scene",
    subject: place,
    queries: buildSceneQueries(place, countryName, context)
  };
}

export function buildPlaceImageSearchQueries(profile) {
  return [...new Set((profile?.queries ?? []).map((query) => String(query).trim()).filter(Boolean))];
}

export function scorePlaceImageCandidate(candidate, profile) {
  const haystack = `${candidate.imageUrl ?? ""} ${candidate.sourceUrl ?? ""} ${candidate.query ?? ""}`.toLowerCase();
  let score = 0;

  if (POSTER_PENALTY_PATTERN.test(haystack)) score -= 45;
  if (/\.(?:svg|ico|gif)(?:$|[?#])/i.test(haystack)) score -= 50;
  if (PHOTO_BOOST_PATTERN.test(haystack)) score += 10;
  if (/upload\.wikimedia\.org|commons\.wikimedia\.org/i.test(haystack)) score += 8;

  if (profile.strategy === "metro" || profile.strategy === "mixed") {
    if (/(?:skyline|cityscape|downtown|urban|capital|skyscraper)/i.test(haystack)) score += 18;
    if (/(?:poster|brochure|banner|logo|flag)/i.test(haystack)) score -= 20;
  }

  if (profile.strategy === "scene" || profile.strategy === "mixed") {
    if (/(?:beach|island|coast|landscape|view|aerial|waterfall|rainforest|bay|lagoon|harbour|harbor)/i.test(haystack)) {
      score += 16;
    }
    if (/(?:poster|brochure|banner|logo|flag|visit[-_.]|tourism[-_.]?board)/i.test(haystack)) score -= 25;
  }

  return score;
}

export function rankPlaceImageCandidates(candidates, profile) {
  return [...candidates]
    .map((candidate, index) => ({
      ...candidate,
      score: scorePlaceImageCandidate(candidate, profile),
      order: index
    }))
    .sort((left, right) => right.score - left.score || left.order - right.order);
}

export function isUsablePlaceImageUrl(value) {
  const imageUrl = String(value ?? "").trim();
  if (!imageUrl) return false;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") return false;
    const pathname = parsed.pathname.toLowerCase();
    if (/\.(?:svg|ico|gif)$/.test(pathname)) return false;
    if (POSTER_PENALTY_PATTERN.test(pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizePlaceKind(kind, tags = []) {
  const normalizedTags = tags.map((tag) => String(tag).trim().toLowerCase());
  if (normalizedTags.includes("city")) return "city";
  if (normalizedTags.includes("state")) return "state";
  const value = String(kind ?? "").trim().toLowerCase();
  return ["city", "state", "region", "area"].includes(value) ? value : "region";
}

function lookupRegionCapital(countrySlug, place) {
  const countryKey = String(countrySlug ?? "").trim().toLowerCase();
  const placeKey = slugifyPlaceKey(place);
  return REGION_CAPITALS[countryKey]?.[placeKey] ?? null;
}

function slugifyPlaceKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeCityName(place) {
  const normalized = slugifyPlaceKey(place);
  return /\b(city|capital|metropolitan)\b/.test(normalized);
}

function isTouristScenePlace(place, tags = [], context = "") {
  const haystack = `${place} ${tags.join(" ")} ${context}`.toLowerCase();
  if (tags.map((tag) => String(tag).toLowerCase()).includes("island")) return true;
  return TOURIST_SCENE_TERMS.some((term) => haystack.includes(term));
}

function buildMetroQueries(subject, countryName, { fallbackPlace = "" } = {}) {
  return [
    `${subject} skyline ${countryName} photo`,
    `${subject} cityscape ${countryName} photograph`,
    `${subject} downtown ${countryName} travel photo`,
    fallbackPlace ? `${fallbackPlace} capital ${countryName} city photo` : null
  ].filter(Boolean);
}

function buildSceneQueries(place, countryName, context = "") {
  return [
    `${place} ${countryName} landscape photo`,
    `${place} ${countryName} island beach view`,
    `${place} ${context} ${countryName} travel scene`.replace(/\s+/g, " ").trim(),
    `${place} ${countryName} scenic view photograph`
  ].filter(Boolean);
}
