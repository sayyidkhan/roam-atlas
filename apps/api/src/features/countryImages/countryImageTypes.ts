import type { CountrySummary } from "@roamatlas/data/countries.js";

import type {
  MediaImageExtension
} from "../../platform/media/mediaFetch.ts";

export type CountryImageCountry = Pick<
  CountrySummary,
  "code" | "name" | "slug"
>;

export type CountryImageRecord = {
  imageUrl: string;
  pageTitle?: string;
  source: string;
};

export type LocalCountryImage = {
  filePath: string;
  imageUrl: string;
};

export type CountryImageRepository = {
  find: (
    country: CountryImageCountry
  ) => Promise<LocalCountryImage | null>;
  isLocalImageUrl: (imageUrl: string) => boolean;
  write: (
    country: CountryImageCountry,
    imageBytes: Buffer,
    extension: MediaImageExtension
  ) => Promise<string>;
};

export type CountryImageFetch = typeof fetch;

export type CountryImageService = {
  isLocalImageUrl: (imageUrl: string) => boolean;
  resolveImage: (
    country: CountryImageCountry
  ) => Promise<CountryImageRecord | null>;
};
