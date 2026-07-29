import {
  createMediaDownloadOptions,
  mediaImageExtension
} from "../../platform/media/mediaFetch.ts";
import {
  getCountryMediaPageTitle,
  isAllowedCountryMediaUrl
} from "./countryImageSelection.ts";
import {
  getCountryImageOverrideUrl,
  getCountryImageTopics
} from "./countryImageTopics.ts";
import type {
  CountryImageCountry,
  CountryImageFetch,
  CountryImageRecord,
  CountryImageRepository,
  CountryImageService
} from "./countryImageTypes.ts";
import {
  resolveCountryCommonsCategoryImage,
  resolveCountryLandmarkSearchImage,
  resolveCountryWikipediaArticleImage
} from "./wikimediaCountryImageProvider.ts";

type CountryImageServiceDependencies = {
  fetchFn?: CountryImageFetch;
  repository: CountryImageRepository;
};

export function createCountryImageService({
  repository,
  fetchFn = fetch
}: CountryImageServiceDependencies): CountryImageService {
  const imageCache = new Map<string, CountryImageRecord>();

  async function resolveImage(
    country: CountryImageCountry
  ): Promise<CountryImageRecord | null> {
    const cachedImage = imageCache.get(country.slug);
    if (cachedImage) return cachedImage;

    const localImage = await resolveLocalImage(country);
    if (localImage) {
      imageCache.set(country.slug, localImage);
      return localImage;
    }

    const pageTitle = getCountryMediaPageTitle(country);
    const overrideUrl = getCountryImageOverrideUrl(country);
    let result: CountryImageRecord | null =
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
    result ??= await resolveCountryCommonsCategoryImage(
      pageTitle,
      fetchFn
    );

    if (result) {
      result = await persistImage(country, result);
      if (repository.isLocalImageUrl(result.imageUrl)) {
        imageCache.set(country.slug, result);
      }
    }
    return result;
  }

  async function resolveLocalImage(
    country: CountryImageCountry
  ): Promise<CountryImageRecord | null> {
    const localImage = await repository.find(country);
    return localImage
      ? {
          imageUrl: localImage.imageUrl,
          source: "local-country-card",
          pageTitle: country.name
        }
      : null;
  }

  async function persistImage(
    country: CountryImageCountry,
    image: CountryImageRecord
  ): Promise<CountryImageRecord> {
    if (repository.isLocalImageUrl(image.imageUrl)) return image;

    try {
      const response = await fetchFn(
        image.imageUrl,
        createMediaDownloadOptions()
      );
      if (!response.ok) return image;
      const contentType = response.headers.get("content-type") ?? "";
      if (!isPersistableImageContentType(contentType)) return image;

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      if (imageBuffer.length === 0) return image;

      const extension = mediaImageExtension(
        contentType,
        image.imageUrl
      );
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

function isPersistableImageContentType(contentType: string): boolean {
  return /image\/(?:jpe?g|png|webp)(?:;|$)/i.test(contentType);
}
