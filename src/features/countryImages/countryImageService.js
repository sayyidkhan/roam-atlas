import {
  getCountryImageOverrideUrl,
  getCountryImageTopics
} from "../../data/countryImageTopics.js";
import {
  createMediaDownloadOptions,
  mediaImageExtension
} from "../../platform/media/mediaFetch.js";
import {
  getCountryMediaPageTitle,
  isAllowedCountryMediaUrl
} from "./countryImageSelection.js";
import {
  resolveCountryCommonsCategoryImage,
  resolveCountryLandmarkSearchImage,
  resolveCountryWikipediaArticleImage
} from "./wikimediaCountryImageProvider.js";

export function createCountryImageService({
  repository,
  fetchFn = fetch
}) {
  const imageCache = new Map();

  async function resolveImage(country) {
    if (imageCache.has(country.slug)) return imageCache.get(country.slug);

    const localImage = await resolveLocalImage(country);
    if (localImage) {
      imageCache.set(country.slug, localImage);
      return localImage;
    }

    const pageTitle = getCountryMediaPageTitle(country);
    const overrideUrl = getCountryImageOverrideUrl(country);
    let result =
      overrideUrl && isAllowedCountryMediaUrl(overrideUrl)
        ? {
            imageUrl: overrideUrl,
            source: "country-image-override",
            pageTitle: getCountryImageTopics(country)[0] ?? pageTitle
          }
        : null;
    result ??= await resolveCountryWikipediaArticleImage(
      country,
      pageTitle,
      fetchFn
    );
    result ??= await resolveCountryLandmarkSearchImage(
      country,
      pageTitle,
      fetchFn
    );
    result ??= await resolveCountryCommonsCategoryImage(pageTitle, fetchFn);

    if (result) {
      result = await persistImage(country, result);
      if (repository.isLocalImageUrl(result.imageUrl)) {
        imageCache.set(country.slug, result);
      }
    }
    return result;
  }

  async function resolveLocalImage(country) {
    const localImage = await repository.find(country);
    return localImage
      ? {
          imageUrl: localImage.imageUrl,
          source: "local-country-card",
          pageTitle: country.name
        }
      : null;
  }

  async function persistImage(country, image) {
    if (
      !image?.imageUrl ||
      repository.isLocalImageUrl(image.imageUrl)
    ) {
      return image;
    }

    try {
      const response = await fetchFn(
        image.imageUrl,
        createMediaDownloadOptions()
      );
      if (!response.ok) return image;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) return image;

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      if (imageBuffer.length === 0) return image;

      const extension = mediaImageExtension(contentType, image.imageUrl);
      const imageUrl = await repository.write(
        country,
        imageBuffer,
        extension
      );

      return {
        ...image,
        imageUrl,
        source: `${image.source}:local-cache`
      };
    } catch {
      return image;
    }
  }

  return {
    resolveImage,
    isLocalImageUrl: repository.isLocalImageUrl
  };
}
