import {
  createMediaMetadataFetchOptions
} from "../../platform/media/mediaFetch.ts";
import {
  getCountryMediaCategoryTitles,
  getCountryWikipediaArticleCandidates,
  selectCountryArticleImage,
  selectCountryCommonsImage,
  selectCountrySearchImage,
  type WikimediaPage
} from "./countryImageSelection.ts";
import { getCountryImageTopics } from "./countryImageTopics.ts";
import type {
  CountryImageCountry,
  CountryImageFetch,
  CountryImageRecord
} from "./countryImageTypes.ts";

export async function resolveCountryWikipediaArticleImage(
  country: CountryImageCountry,
  pageTitle: string,
  fetchFn: CountryImageFetch = fetch
): Promise<CountryImageRecord | null> {
  const candidateTitles = getCountryWikipediaArticleCandidates(
    country,
    pageTitle,
    getCountryImageTopics(country)
  );
  if (!candidateTitles.length) return null;

  const pageImageUrl = createWikimediaApiUrl(
    "https://en.wikipedia.org/w/api.php",
    {
      action: "query",
      titles: candidateTitles.join("|"),
      redirects: "1",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "960",
      format: "json",
      origin: "*"
    }
  );
  const pages = await fetchWikimediaPages(pageImageUrl, fetchFn);
  if (!pages) return null;

  const image = selectCountryArticleImage(
    pages,
    candidateTitles,
    pageTitle
  );
  return image
    ? {
        ...image,
        source: "wikipedia-article-pageimage",
        pageTitle: image.pageTitle ?? pageTitle
      }
    : null;
}

export async function resolveCountryLandmarkSearchImage(
  country: CountryImageCountry,
  pageTitle: string,
  fetchFn: CountryImageFetch = fetch
): Promise<CountryImageRecord | null> {
  for (const topic of getCountryImageTopics(country)) {
    const searchUrl = createWikimediaApiUrl(
      "https://commons.wikimedia.org/w/api.php",
      {
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
      }
    );
    const pages = await fetchWikimediaPages(searchUrl, fetchFn);
    if (!pages) continue;

    const image = selectCountrySearchImage(
      pages,
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
  }

  return null;
}

export async function resolveCountryCommonsCategoryImage(
  pageTitle: string,
  fetchFn: CountryImageFetch = fetch
): Promise<CountryImageRecord | null> {
  for (const categoryTitle of getCountryMediaCategoryTitles(pageTitle)) {
    const categoryUrl = createWikimediaApiUrl(
      "https://commons.wikimedia.org/w/api.php",
      {
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
      }
    );
    const pages = await fetchWikimediaPages(categoryUrl, fetchFn);
    if (!pages) continue;

    const image = selectCountryCommonsImage(pages, pageTitle);
    if (image) {
      return {
        ...image,
        source: "wikimedia-commons-category",
        pageTitle: categoryTitle
      };
    }
  }

  return null;
}

function createWikimediaApiUrl(
  baseUrl: string,
  parameters: Record<string, string>
): URL {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams(parameters).toString();
  return url;
}

async function fetchWikimediaPages(
  url: URL,
  fetchFn: CountryImageFetch
): Promise<WikimediaPage[] | null> {
  try {
    const response = await fetchFn(
      url,
      createMediaMetadataFetchOptions()
    );
    if (
      !response.ok ||
      !(response.headers.get("content-type") ?? "").includes(
        "application/json"
      )
    ) {
      return null;
    }
    return parseWikimediaPages(await response.json());
  } catch {
    return null;
  }
}

function parseWikimediaPages(payload: unknown): WikimediaPage[] | null {
  if (!isRecord(payload) || !isRecord(payload.query)) return null;
  const pages = payload.query.pages;
  if (!isRecord(pages)) return null;
  return Object.values(pages).filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
