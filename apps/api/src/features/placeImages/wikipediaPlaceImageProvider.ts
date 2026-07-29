import {
  isUsablePlaceImageUrl
} from "@roamatlas/domain/placeImageSelection.js";
import {
  createMediaMetadataFetchOptions
} from "../../platform/media/mediaFetch.ts";
import type {
  PlaceImageCandidate,
  PlaceImageCountry
} from "./placeImageServiceTypes.ts";

type WikipediaPlaceImageOptions = {
  context?: string;
  fetchFn?: typeof fetch;
};

type WikipediaPageImage = {
  imageUrl: string;
  pageTitle: string;
};

export async function resolvePlaceWikipediaImage(
  country: PlaceImageCountry,
  place: string,
  {
    context = "",
    fetchFn = fetch
  }: WikipediaPlaceImageOptions = {}
): Promise<PlaceImageCandidate | null> {
  const titles =
    getPlaceWikipediaArticleCandidates(
      country,
      place,
      context
    );
  if (!titles.length) return null;

  const endpoint = new URL(
    "https://en.wikipedia.org/w/api.php"
  );
  endpoint.search = new URLSearchParams({
    action: "query",
    titles: titles.join("|"),
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "960",
    format: "json",
    origin: "*"
  }).toString();

  try {
    const response = await fetchFn(
      endpoint,
      createMediaMetadataFetchOptions()
    );
    if (!response.ok) return null;
    if (
      !(
        response.headers.get("content-type") ??
        ""
      ).includes("application/json")
    ) {
      return null;
    }
    const candidates = readWikipediaPages(
      (await response.json()) as unknown
    )
      .map(toWikipediaPageImage)
      .filter(
        (
          candidate
        ): candidate is WikipediaPageImage =>
          Boolean(
            candidate?.imageUrl &&
              isUsablePlaceImageUrl(
                candidate.imageUrl
              )
          )
      )
      .sort(
        (left, right) =>
          titles.indexOf(left.pageTitle) -
          titles.indexOf(right.pageTitle)
      );
    const selected = candidates[0];
    if (!selected) return null;
    return {
      imageUrl: selected.imageUrl,
      sourceUrl:
        "https://en.wikipedia.org/wiki/" +
        encodeURIComponent(
          selected.pageTitle
            .replace(/\s+/g, "_")
        ),
      query:
        "wikipedia article reference-photo fallback"
    };
  } catch {
    return null;
  }
}

export function getPlaceWikipediaArticleCandidates(
  country: Pick<PlaceImageCountry, "name">,
  place: string,
  context = ""
): string[] {
  return [
    ...new Set([
      place,
      `${place}, ${country.name}`,
      ...String(context)
        .split(
          /\s{2,}|\n|(?<=\bBay)\s+(?=Sands|Gardens)/
        )
        .map((item) => item.trim())
    ])
  ]
    .filter(Boolean)
    .slice(0, 8);
}

function readWikipediaPages(
  value: unknown
): Record<string, unknown>[] {
  if (
    !isRecord(value) ||
    !isRecord(value.query) ||
    !isRecord(value.query.pages)
  ) {
    return [];
  }
  return Object.values(value.query.pages).filter(
    isRecord
  );
}

function toWikipediaPageImage(
  page: Record<string, unknown>
): WikipediaPageImage | null {
  const thumbnail = isRecord(page.thumbnail)
    ? page.thumbnail
    : null;
  const imageUrl = String(
    thumbnail?.source ?? ""
  ).trim();
  const pageTitle = String(page.title ?? "").trim();
  if (!imageUrl || !pageTitle) return null;
  return { imageUrl, pageTitle };
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
