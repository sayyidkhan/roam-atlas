import { useMemo, useState } from "react";

import {
  CountryCardFlag,
  CountryCardPhoto,
  type CountryCatalogCountry
} from "./CountryCardMedia";
import styles from "./CountryCatalog.module.css";

export type { CountryCatalogCountry } from "./CountryCardMedia";

type CountryPackSummary = {
  confidence?: string;
};

type CountryCatalogProps = {
  countries: CountryCatalogCountry[];
  countryPacks: Record<string, CountryPackSummary | undefined>;
  onConfigure: (country: CountryCatalogCountry) => void;
  onOpen: (country: CountryCatalogCountry) => void;
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function SettingsIcon() {
  return (
    <svg
      className={styles["country-card-menu-icon"]}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2.05 2.05 0 0 1-2.9 2.9l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .52V20a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1-.52 1.7 1.7 0 0 0-1.88.34l-.06.06a2.05 2.05 0 0 1-2.9-2.9l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.52-1H4a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 .52-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2.05 2.05 0 0 1 2.9-2.9l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.52V4a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1 .52 1.7 1.7 0 0 0 1.88-.34l.06-.06a2.05 2.05 0 0 1 2.9 2.9l-.06.06A1.7 1.7 0 0 0 19.4 9c.16.36.35.7.52 1H20a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-.52 1Z" />
    </svg>
  );
}

export function CountryCatalogView({ countries, countryPacks, onConfigure, onOpen }: CountryCatalogProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeQuery(query);
  const filteredCountries = useMemo(() => countries.filter((country) => {
    if (!normalizedQuery) return true;
    return [country.name, country.code, country.displayCode]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  }), [countries, normalizedQuery]);

  return (
    <section
      className={`${styles["country-landing"]} ${styles["country-landing--standalone"]}`}
      aria-label="Choose a country"
    >
      <header className={styles["country-hero"]}>
        <div>
          <p className={styles.eyebrow}>RoamAtlas</p>
          <h1>Choose a country</h1>
          <p>Explore visual country guides, curated discoveries, and itinerary-ready places.</p>
        </div>
      </header>

      <section className={styles["country-toolbar"]} aria-label="Country filters">
        <label className={styles["search-field"]}>
          <span>Search countries</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by country name or code"
            autoComplete="off"
          />
        </label>
        <p className={styles["country-count"]}>
          {filteredCountries.length} of {countries.length} countries
        </p>
      </section>

      <section className={styles["country-grid"]} aria-label="Country cards">
        {filteredCountries.map((country) => {
          const isMapped = countryPacks[country.slug]?.confidence !== "unconfirmed";
          return (
            <article
              key={country.code}
              className={`${styles["country-card"]} ${
                styles[`country-card--${isMapped ? "mapped" : "available"}`]
              }`}
              aria-label={`${country.name}, ${isMapped ? "source-reviewed explorer" : "starter explorer"}`}
            >
              <CountryCardPhoto country={country} />
              <button
                type="button"
                className={styles["country-card-hitbox"]}
                aria-label={`Open ${country.name}`}
                onClick={() => onOpen(country)}
              />
              <CountryCardFlag country={country} />
              <button
                type="button"
                className={styles["country-card-menu"]}
                aria-label={`Configure ${country.name}`}
                onClick={() => onConfigure(country)}
              >
                <SettingsIcon />
              </button>
              <span className={styles["country-card-footer"]}>
                <span className={styles["country-name"]}>{country.name}</span>
                <button
                  type="button"
                  className={styles["country-status"]}
                  aria-label={`Open ${country.name} explorer`}
                  onClick={() => onOpen(country)}
                >
                  Open
                </button>
                <span className={styles["country-code"]}>{country.displayCode}</span>
              </span>
            </article>
          );
        })}
      </section>
    </section>
  );
}
