import type { CountryCatalogCountry } from "../countryCatalog/CountryCardMedia";

export type LandingVariantProps = {
  countries: CountryCatalogCountry[];
  countryPacks: Record<string, {
    confidence?: string;
    registration?: string;
  } | undefined>;
  onOpen: (country: CountryCatalogCountry) => void;
  onConfigure: (country: CountryCatalogCountry) => void;
};

export const LANDING_VARIANTS = [
  { id: "playful", name: "Postcard Desk", number: "01" },
  { id: "atlas", name: "Immersive Atlas", number: "02" },
  { id: "cinematic", name: "Cinematic Travel", number: "03" },
  { id: "original", name: "Original", number: "04" },
  { id: "horizon", name: "Horizon Atlas", number: "05" },
  { id: "horizon2", name: "Horizon Atlas 2", number: "06" }
] as const;

export type LandingVariantId = typeof LANDING_VARIANTS[number]["id"];

export function resolveLandingVariant(value: string | null): LandingVariantId {
  return LANDING_VARIANTS.some((variant) => variant.id === value)
    ? value as LandingVariantId
    : "horizon2";
}
