import type { CountryCatalogCountry } from "../countryCatalog/CountryCardMedia";

const HOME_COUNTRY_KEY = "roamatlas.home-country";

export function readHomeCountry(countries: CountryCatalogCountry[]): string | null {
  try {
    const slug = localStorage.getItem(HOME_COUNTRY_KEY);
    return countries.some((country) => country.slug === slug) ? slug : null;
  } catch { return null; }
}

export function saveHomeCountry(slug: string | null): boolean {
  try {
    if (slug) localStorage.setItem(HOME_COUNTRY_KEY, slug);
    else localStorage.removeItem(HOME_COUNTRY_KEY);
    return true;
  } catch { return false; }
}
