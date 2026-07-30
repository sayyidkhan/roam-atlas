import {
  PLACE_LANDMARK_QUERIES,
  REGION_CAPITALS,
  TOURIST_SCENE_TERMS
} from "./placeImageSelectionConfig.ts";
import type {
  PlaceImageProfile,
  PlaceImageProfileInput
} from "./placeImageSelectionTypes.ts";

type PlaceKind =
  | "city"
  | "state"
  | "region"
  | "area";

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
  const placeKey = normalizePlaceKey(place);
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
  const placeKey = normalizePlaceKey(place);
  return [
    ...(
      PLACE_LANDMARK_QUERIES[countryKey]?.[
        placeKey
      ] ?? []
    )
  ];
}

function normalizePlaceKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeCityName(place: unknown): boolean {
  const normalized = normalizePlaceKey(place);
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
