import type { CountryCatalogCountry } from "../countryCatalog/CountryCardMedia";

export type CountryEncyclopediaEntry = {
  title: string;
  extract: string;
  sourceUrl: string;
  retrievedAt: string;
  confidence: "general";
};

const ARTICLE_TITLES: Record<string, string> = {
  CG: "Republic of the Congo", CD: "Democratic Republic of the Congo",
  GE: "Georgia (country)", PS: "State of Palestine", VA: "Vatican City",
  MM: "Myanmar", TL: "East Timor", CI: "Ivory Coast", TR: "Turkey",
  BS: "The Bahamas", GM: "The Gambia", US: "United States",
};

export function countryArticleTitle(country: CountryCatalogCountry) {
  return ARTICLE_TITLES[country.code] ?? country.name.replace(/ & /g, " and ").replace(/^St\. /, "Saint ");
}

export function countryArticleUrl(country: CountryCatalogCountry) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(countryArticleTitle(country).replaceAll(" ", "_"))}`;
}

export async function retrieveCountryEncyclopedia(country: CountryCatalogCountry, signal?: AbortSignal): Promise<CountryEncyclopediaEntry> {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", origin: "*",
    prop: "extracts|pageprops", exintro: "1", explaintext: "1", exchars: "1600",
    redirects: "1", titles: countryArticleTitle(country),
  });
  const timeout = AbortSignal.timeout(12000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: requestSignal, credentials: "omit" });
  if (!response.ok) throw new Error("The encyclopedia source is unavailable.");
  const data = await response.json() as { query?: { pages?: Array<{ title?: string; extract?: string; missing?: boolean; pageprops?: { disambiguation?: string } }> } };
  const page = data.query?.pages?.[0];
  if (!page?.title || !page.extract?.trim() || page.missing || page.pageprops?.disambiguation !== undefined) throw new Error("No country overview was found.");
  return {
    title: page.title, extract: page.extract.trim(), confidence: "general",
    sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
    retrievedAt: new Date().toISOString(),
  };
}
