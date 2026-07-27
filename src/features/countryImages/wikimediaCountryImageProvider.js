import { getCountryImageTopics } from "../../data/countryImageTopics.js";
import { createMediaMetadataFetchOptions } from "../../platform/media/mediaFetch.js";
import {
  getCountryMediaCategoryTitles,
  getCountryWikipediaArticleCandidates,
  selectCountryArticleImage,
  selectCountryCommonsImage,
  selectCountrySearchImage
} from "./countryImageSelection.js";

export async function resolveCountryWikipediaArticleImage(
  country,
  pageTitle,
  fetchFn = fetch
) {
  const candidateTitles = getCountryWikipediaArticleCandidates(
    country,
    pageTitle,
    getCountryImageTopics(country)
  );
  if (!candidateTitles.length) return null;

  const pageImageUrl = new URL("https://en.wikipedia.org/w/api.php");
  pageImageUrl.search = new URLSearchParams({
    action: "query",
    titles: candidateTitles.join("|"),
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "960",
    format: "json",
    origin: "*"
  }).toString();

  try {
    const response = await fetchFn(
      pageImageUrl,
      createMediaMetadataFetchOptions()
    );
    if (!response.ok) return null;
    if (
      !(response.headers.get("content-type") ?? "").includes("application/json")
    ) {
      return null;
    }
    const payload = await response.json();
    const image = selectCountryArticleImage(
      Object.values(payload?.query?.pages ?? {}),
      candidateTitles,
      pageTitle
    );
    return image
      ? {
          ...image,
          source: "wikipedia-article-pageimage",
          pageTitle: image.pageTitle
        }
      : null;
  } catch {
    return null;
  }
}

export async function resolveCountryLandmarkSearchImage(
  country,
  pageTitle,
  fetchFn = fetch
) {
  for (const topic of getCountryImageTopics(country)) {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: topic,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "960",
      format: "json",
      origin: "*"
    }).toString();

    try {
      const response = await fetchFn(
        searchUrl,
        createMediaMetadataFetchOptions()
      );
      if (!response.ok) continue;
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "application/json"
        )
      ) {
        continue;
      }
      const payload = await response.json();
      const image = selectCountrySearchImage(
        Object.values(payload?.query?.pages ?? {}),
        topic,
        pageTitle
      );
      if (image) {
        return {
          ...image,
          source: "wikimedia-commons-search",
          pageTitle: topic
        };
      }
    } catch {
      // Continue through the feature-owned fallback chain.
    }
  }

  return null;
}

export async function resolveCountryCommonsCategoryImage(
  pageTitle,
  fetchFn = fetch
) {
  for (const categoryTitle of getCountryMediaCategoryTitles(pageTitle)) {
    const categoryUrl = new URL("https://commons.wikimedia.org/w/api.php");
    categoryUrl.search = new URLSearchParams({
      action: "query",
      generator: "categorymembers",
      gcmtitle: `Category:${categoryTitle}`,
      gcmtype: "file",
      gcmlimit: "16",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "960",
      format: "json",
      origin: "*"
    }).toString();

    try {
      const response = await fetchFn(
        categoryUrl,
        createMediaMetadataFetchOptions()
      );
      if (!response.ok) continue;
      const payload = await response.json();
      const image = selectCountryCommonsImage(
        Object.values(payload?.query?.pages ?? {}),
        pageTitle
      );
      if (image) {
        return {
          ...image,
          source: "wikimedia-commons-category",
          pageTitle: categoryTitle
        };
      }
    } catch {
      // Continue through the feature-owned fallback chain.
    }
  }

  return null;
}
