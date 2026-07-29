// Bump whenever eligibility changes so old, low-quality cached selections are
// re-evaluated rather than surviving indefinitely in the local runtime cache.
export const PLACE_IMAGE_SELECTION_VERSION = "v5";

export type PlaceImageStrategy =
  | "landmark"
  | "metro"
  | "scene"
  | "mixed";

export type PlaceImageProfile = {
  queries: string[];
  strategy: PlaceImageStrategy;
  subject: string;
};

export type PlaceImageProfileInput = {
  context?: string;
  countryName: string;
  countrySlug?: string;
  kind?: string;
  place: string;
  tags?: string[];
};

export type PlaceImageCandidate = {
  imageUrl?: string | null;
  query?: string | null;
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type RankedPlaceImageCandidate<
  Candidate extends PlaceImageCandidate =
    PlaceImageCandidate
> = Candidate & {
  order: number;
  score: number;
};

type PlaceKind =
  | "city"
  | "state"
  | "region"
  | "area";

const REGION_CAPITALS: Record<
  string,
  Record<string, string>
> = {
  malaysia: {
    johor: "Johor Bahru",
    sabah: "Kota Kinabalu",
    sarawak: "Kuching",
    penang: "George Town",
    melaka: "Malacca",
    "pulau pinang": "George Town"
  }
};

const PLACE_LANDMARK_QUERIES: Record<
  string,
  Record<string, string[]>
> = {
  singapore: {
    "west campus and gardens": [
      "National University of Singapore Kent Ridge campus photograph",
      "Nanyang Technological University Singapore campus photograph",
      "Jurong Lake Gardens Singapore landscape photograph"
    ]
  },
  malaysia: {
    langkawi: [
      "Langkawi Sky Bridge Malaysia tourist landmark photograph",
      "Pantai Cenang Langkawi beach landmark photo",
      "Eagle Square Langkawi island landmark photograph",
      "Telaga Tujuh Waterfall Langkawi Malaysia travel photo"
    ],
    johor: [
      "Sultan Abu Bakar State Mosque Johor Bahru landmark photograph",
      "Legoland Malaysia Johor Bahru tourist attraction photo",
      "Johor Bahru old town heritage street landmark photo",
      "Puteri Harbour Johor Bahru waterfront landmark photograph"
    ]
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
  /(?:^|[^a-z])(?:poster|brochure|banner|flyer|logo|logotype|favicon|sprite|icon|emblem|coat[- ]of[- ]arms|flag|infographic|promo|campaign|visit[-_.]|tourism[-_.]?board|travel[-_.]?fair|expo|thumbnail[-_.]?logo|brand[-_.]?guide|hero[-_.]?image|cover[-_.]?photo|header[-_.]?image|welcome[-_.]|discover[-_.]|official[-_.]?site|text[-_.]?overlay|watermark|creative[-_.]?commons|cc[-_.]?(?:by|zero|0)|rights[-_.]?(?:reserved|managed)|copyright|license[-_.]?badge)(?:[^a-z]|$)/i;

const PHOTO_BOOST_PATTERN =
  /(?:photo|photograph|gallery|image|skyline|cityscape|beach|coast|harbour|harbor|landscape|view|aerial|island|waterfall|rainforest|bay|lagoon|street|heritage|downtown|skyscraper|monument|temple|mosque|cathedral|fort|palace|landmark|attraction|waterfront|old town|geopark|cable car|skybridge|sky bridge)/i;

const LANDMARK_BOOST_PATTERN =
  /(?:landmark|attraction|monument|heritage|old town|waterfront|skybridge|sky bridge|cable car|waterfall|beach|mosque|temple|palace|fort|geopark|harbour|harbor|square|viewpoint|national park)/i;

export function inferPlaceImageProfile({
  place,
  countryName,
  countrySlug = "",
  kind = "",
  tags = [],
  context = ""
}: PlaceImageProfileInput): PlaceImageProfile {
  const normalizedKind = normalizePlaceKind(
    kind,
    tags
  );
  const capital = lookupRegionCapital(
    countrySlug,
    place
  );
  const touristScene = isTouristScenePlace(
    place,
    tags,
    context
  );
  const landmarkQueries =
    lookupPlaceLandmarkQueries(
      countrySlug,
      place
    );

  if (landmarkQueries.length) {
    return {
      strategy: "landmark",
      subject: capital ?? place,
      queries: landmarkQueries
    };
  }

  if (
    normalizedKind === "city" ||
    looksLikeCityName(place)
  ) {
    return {
      strategy: "metro",
      subject: place,
      queries: buildMetroQueries(
        place,
        countryName
      )
    };
  }

  if (
    capital &&
    (normalizedKind === "state" ||
      normalizedKind === "region")
  ) {
    return {
      strategy: "metro",
      subject: capital,
      queries: buildMetroQueries(
        capital,
        countryName,
        { fallbackPlace: place }
      )
    };
  }

  if (touristScene) {
    return {
      strategy: "scene",
      subject: place,
      queries: buildSceneQueries(
        place,
        countryName,
        context
      )
    };
  }

  if (normalizedKind === "state") {
    return {
      strategy: "mixed",
      subject: place,
      queries: [
        ...buildMetroQueries(
          `${place} capital`,
          countryName
        ),
        ...buildSceneQueries(
          place,
          countryName,
          context
        )
      ]
    };
  }

  return {
    strategy: "scene",
    subject: place,
    queries: buildSceneQueries(
      place,
      countryName,
      context
    )
  };
}

export function buildPlaceImageSearchQueries(
  profile: Pick<PlaceImageProfile, "queries">
): string[] {
  return [
    ...new Set(
      profile.queries
        .map(formatExaPlaceImageQuery)
        .filter(Boolean)
    )
  ];
}

export function formatExaPlaceImageQuery(
  query: unknown
): string {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return "";
  return (
    `${trimmed} real travel photograph famous place landmark ` +
    "tourist attraction no banner no poster no logo no text overlay"
  );
}

export function scorePlaceImageCandidate(
  candidate: PlaceImageCandidate,
  profile: Pick<PlaceImageProfile, "strategy">
): number {
  const haystack =
    `${candidate.imageUrl ?? ""} ` +
    `${candidate.sourceUrl ?? ""} ` +
    `${candidate.query ?? ""}`;
  const normalizedHaystack = haystack.toLowerCase();
  let score = 0;

  if (
    POSTER_PENALTY_PATTERN.test(
      normalizedHaystack
    )
  ) {
    score -= 45;
  }
  if (
    /\.(?:svg|ico|gif)(?:$|[?#])/i.test(
      normalizedHaystack
    )
  ) {
    score -= 50;
  }
  if (
    PHOTO_BOOST_PATTERN.test(normalizedHaystack)
  ) {
    score += 10;
  }
  if (
    /upload\.wikimedia\.org|commons\.wikimedia\.org/i.test(
      normalizedHaystack
    )
  ) {
    score += 8;
  }
  if (
    LANDMARK_BOOST_PATTERN.test(
      normalizedHaystack
    )
  ) {
    score += 14;
  }

  if (profile.strategy === "landmark") {
    if (
      LANDMARK_BOOST_PATTERN.test(
        normalizedHaystack
      )
    ) {
      score += 20;
    }
    if (
      /(?:poster|brochure|banner|logo|flag|visit[-_.]|tourism[-_.]?board|hero[-_.]?image|cover[-_.]?photo)/i.test(
        normalizedHaystack
      )
    ) {
      score -= 35;
    }
  }

  if (
    profile.strategy === "metro" ||
    profile.strategy === "mixed"
  ) {
    if (
      /(?:landmark|heritage|old town|monument|mosque|temple|waterfront|attraction)/i.test(
        normalizedHaystack
      )
    ) {
      score += 20;
    }
    if (
      /(?:skyline|cityscape|downtown|urban|capital|skyscraper)/i.test(
        normalizedHaystack
      )
    ) {
      score += 12;
    }
    if (
      /(?:poster|brochure|banner|logo|flag)/i.test(
        normalizedHaystack
      )
    ) {
      score -= 25;
    }
  }

  if (
    profile.strategy === "scene" ||
    profile.strategy === "mixed"
  ) {
    if (
      /(?:beach|island|coast|landscape|view|aerial|waterfall|rainforest|bay|lagoon|harbour|harbor|landmark|attraction)/i.test(
        normalizedHaystack
      )
    ) {
      score += 16;
    }
    if (
      /(?:poster|brochure|banner|logo|flag|visit[-_.]|tourism[-_.]?board|hero[-_.]?image|cover[-_.]?photo)/i.test(
        normalizedHaystack
      )
    ) {
      score -= 30;
    }
  }

  return score;
}

export function rankPlaceImageCandidates<
  Candidate extends PlaceImageCandidate
>(
  candidates: readonly Candidate[],
  profile: Pick<PlaceImageProfile, "strategy">
): Array<RankedPlaceImageCandidate<Candidate>> {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      score: scorePlaceImageCandidate(
        candidate,
        profile
      ),
      order: index
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.order - right.order
    );
}

export function isUsablePlaceImageUrl(
  value: unknown
): boolean {
  const imageUrl = String(value ?? "").trim();
  if (!imageUrl) return false;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const pathname = parsed.pathname.toLowerCase();
    if (/\.(?:svg|ico|gif)$/.test(pathname)) {
      return false;
    }
    if (POSTER_PENALTY_PATTERN.test(imageUrl)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function normalizePlaceKind(
  kind: unknown,
  tags: readonly unknown[] = []
): PlaceKind {
  const normalizedTags = tags.map((tag) =>
    String(tag).trim().toLowerCase()
  );
  if (normalizedTags.includes("city")) {
    return "city";
  }
  if (normalizedTags.includes("state")) {
    return "state";
  }
  const value = String(kind ?? "")
    .trim()
    .toLowerCase();
  if (
    value === "city" ||
    value === "state" ||
    value === "region" ||
    value === "area"
  ) {
    return value;
  }
  return "region";
}

function lookupRegionCapital(
  countrySlug: unknown,
  place: unknown
): string | null {
  const countryKey = String(countrySlug ?? "")
    .trim()
    .toLowerCase();
  const placeKey = slugifyPlaceKey(place);
  return (
    REGION_CAPITALS[countryKey]?.[placeKey] ??
    null
  );
}

function lookupPlaceLandmarkQueries(
  countrySlug: unknown,
  place: unknown
): string[] {
  const countryKey = String(countrySlug ?? "")
    .trim()
    .toLowerCase();
  const placeKey = slugifyPlaceKey(place);
  return (
    PLACE_LANDMARK_QUERIES[countryKey]?.[
      placeKey
    ] ?? []
  );
}

function slugifyPlaceKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeCityName(place: unknown): boolean {
  const normalized = slugifyPlaceKey(place);
  return /\b(city|capital|metropolitan)\b/.test(
    normalized
  );
}

function isTouristScenePlace(
  place: unknown,
  tags: readonly unknown[] = [],
  context: unknown = ""
): boolean {
  const normalizedTags = tags.map((tag) =>
    String(tag).toLowerCase()
  );
  const haystack =
    `${String(place ?? "")} ` +
    `${normalizedTags.join(" ")} ` +
    String(context ?? "");
  if (normalizedTags.includes("island")) {
    return true;
  }
  return TOURIST_SCENE_TERMS.some((term) =>
    haystack.toLowerCase().includes(term)
  );
}

function buildMetroQueries(
  subject: string,
  countryName: string,
  {
    fallbackPlace = ""
  }: { fallbackPlace?: string } = {}
): string[] {
  return [
    `${subject} ${countryName} famous landmark tourist attraction photograph`,
    `${subject} ${countryName} heritage old town street landmark photo`,
    `${subject} ${countryName} waterfront or mosque landmark photograph`,
    fallbackPlace
      ? `${fallbackPlace} ${subject} ${countryName} city landmark photo`
      : null
  ].filter((query): query is string =>
    Boolean(query)
  );
}

function buildSceneQueries(
  place: string,
  countryName: string,
  context = ""
): string[] {
  return [
    `${place} ${countryName} famous landmark tourist attraction photograph`,
    `${place} ${countryName} scenic beach or waterfall landmark photo`,
    `${place} ${context} ${countryName} island nature landmark photograph`
      .replace(/\s+/g, " ")
      .trim(),
    `${place} ${countryName} viewpoint or geopark landmark photo`
  ];
}
