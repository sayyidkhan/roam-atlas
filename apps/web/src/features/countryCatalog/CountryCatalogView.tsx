import { useMemo, useState } from "react";

import {
  CountryCardFlag,
  CountryCardPhoto,
  type CountryCatalogCountry
} from "./CountryCardMedia";
import { CountryAtlasGlobe } from "./CountryAtlasGlobe";
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
  const [isShelfExpanded, setIsShelfExpanded] = useState(false);
  const normalizedQuery = normalizeQuery(query);
  const filteredCountries = useMemo(() => countries.filter((country) => {
    if (!normalizedQuery) return true;
    return [country.name, country.code, country.displayCode]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  }), [countries, normalizedQuery]);
  const featuredCountries = useMemo(
    () => countries.filter((country) => country.slug === "singapore" || country.slug === "malaysia"),
    [countries]
  );
  const shelfCountries = isShelfExpanded ? filteredCountries : countries;

  const openGlobeDestination = (countrySlug: string) => {
    const country = countries.find((candidate) => candidate.slug === countrySlug);
    if (country) onOpen(country);
  };

  return (
    <section
      className={`${styles["country-landing"]} ${styles["country-landing--standalone"]}`}
      aria-label="Choose a country"
    >
      <div
        className={`${styles["country-stage"]} ${
          isShelfExpanded ? styles["country-stage--shelf-open"] : ""
        }`}
      >
        <header className={styles["country-hero"]}>
          <div className={styles["country-hero-copy"]}>
            <p className={styles.eyebrow}>RoamAtlas · illustrated travel intelligence</p>
            <p className={styles["hero-kicker"]}>An atlas you can enter</p>
            <h1>Find the story behind your next journey.</h1>
            <p className={styles["hero-description"]}>
              Touch and drag the globe to roam. Use the country shelf when you are ready to choose a starting point.
            </p>
            <div className={styles["hero-actions"]}>
              <button type="button" className={styles["hero-primary-action"]} onClick={() => openGlobeDestination("singapore")}>
                Explore Singapore <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                className={styles["hero-secondary-action"]}
                onClick={() => setIsShelfExpanded(true)}
              >
                Browse all countries
              </button>
            </div>
            <dl className={styles["hero-stat-list"]}>
              <div>
                <dt>{countries.length}</dt>
                <dd>countries to begin</dd>
              </div>
              <div>
                <dt>{featuredCountries.length}</dt>
                <dd>live atlas packs</dd>
              </div>
            </dl>
          </div>
          <div className={styles["country-hero-globe"]}>
            <CountryAtlasGlobe />
            <div className={styles["globe-caption"]}>
              <span className={styles["globe-caption-line"]} aria-hidden="true" />
              <p>Touch the globe to roam</p>
              <span>Singapore + Malaysia</span>
            </div>
          </div>
        </header>

        <aside
          className={`${styles["country-shelf"]} ${
            isShelfExpanded ? styles["country-shelf--expanded"] : ""
          }`}
          aria-label="Country index"
        >
          <button
            type="button"
            className={styles["country-shelf-toggle"]}
            aria-label={isShelfExpanded ? "Collapse country index" : "Expand country index"}
            aria-expanded={isShelfExpanded}
            onClick={() => setIsShelfExpanded((current) => !current)}
          >
            <span className={styles["country-shelf-toggle-icon"]} aria-hidden="true">
              {isShelfExpanded ? "→" : "←"}
            </span>
          </button>
          <div className={styles["country-shelf-heading"]}>
            <p className={styles.eyebrow}>Country index</p>
            <h2>{isShelfExpanded ? "Choose your starting point" : "Atlas shelf"}</h2>
            <p>{isShelfExpanded ? `${filteredCountries.length} of ${countries.length} countries` : "Scroll to explore every country"}</p>
          </div>
          {isShelfExpanded ? (
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
          ) : null}

          <section className={styles["country-grid"]} aria-label="Country cards">
            {shelfCountries.map((country) => {
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
        </aside>
      </div>
    </section>
  );
}
