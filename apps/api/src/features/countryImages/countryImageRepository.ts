import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  MediaImageExtension
} from "../../platform/media/mediaFetch.ts";
import type {
  CountryImageCountry,
  CountryImageRepository
} from "./countryImageTypes.ts";

const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
] as const satisfies readonly MediaImageExtension[];

type CountryImageRepositoryOptions = {
  storageDirectory: string;
  urlPrefix: string;
};

export function createCountryImageRepository({
  storageDirectory,
  urlPrefix
}: CountryImageRepositoryOptions): CountryImageRepository {
  async function find(country: CountryImageCountry) {
    for (const basename of getImageBasenames(country)) {
      for (const extension of SUPPORTED_IMAGE_EXTENSIONS) {
        const filePath = path.join(
          storageDirectory,
          `${basename}${extension}`
        );
        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            return {
              filePath,
              imageUrl: `${urlPrefix}/${basename}${extension}`
            };
          }
        } catch {
          // Try the next supported extension.
        }
      }
    }
    return null;
  }

  async function write(
    country: CountryImageCountry,
    imageBytes: Buffer,
    extension: MediaImageExtension
  ): Promise<string> {
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(
      path.join(storageDirectory, `${country.slug}${extension}`),
      imageBytes
    );
    return `${urlPrefix}/${country.slug}${extension}`;
  }

  function isLocalImageUrl(imageUrl: string): boolean {
    return imageUrl.startsWith(urlPrefix);
  }

  return { find, write, isLocalImageUrl };
}

function getImageBasenames(
  country: CountryImageCountry
): string[] {
  const basenames = new Set([
    country.slug,
    country.code.toLowerCase()
  ]);
  if (country.code === "PS") basenames.add("palestine");
  return [...basenames];
}
