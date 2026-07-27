import { isUsablePlaceImageUrl } from "../../domain/placeImageSelection.js";
import { createMediaMetadataFetchOptions } from "../../platform/media/mediaFetch.js";

export async function resolvePlaceWikipediaImage(
  country,
  place,
  { context = "", fetchFn = fetch } = {}
) {
  const titles = getPlaceWikipediaArticleCandidates(country, place, context);
  if (!titles.length) return null;

  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
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
    const response = await fetchFn(endpoint, createMediaMetadataFetchOptions());
    if (!response.ok) return null;
    if (
      !(response.headers.get("content-type") ?? "").includes("application/json")
    ) {
      return null;
    }
    const pages = Object.values((await response.json())?.query?.pages ?? {});
    const candidates = pages
      .map((page) => ({
        imageUrl: String(page?.thumbnail?.source ?? "").trim(),
        pageTitle: String(page?.title ?? "").trim()
      }))
      .filter(
        (candidate) =>
          candidate.imageUrl && isUsablePlaceImageUrl(candidate.imageUrl)
      )
      .sort(
        (left, right) =>
          titles.indexOf(left.pageTitle) - titles.indexOf(right.pageTitle)
      );
    const selected = candidates[0];
    if (!selected) return null;
    return {
      imageUrl: selected.imageUrl,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        selected.pageTitle.replace(/\s+/g, "_")
      )}`,
      query: "wikipedia article reference-photo fallback"
    };
  } catch {
    return null;
  }
}

export function getPlaceWikipediaArticleCandidates(country, place, context) {
  return [
    ...new Set([
      place,
      `${place}, ${country.name}`,
      ...String(context)
        .split(/\s{2,}|\n|(?<=\bBay)\s+(?=Sands|Gardens)/)
        .map((item) => item.trim())
    ])
  ]
    .filter(Boolean)
    .slice(0, 8);
}
