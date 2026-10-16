import { useMemo, useState } from "react";

import {
  CountryCardFlag,
  CountryCardPhoto,
  type CountryCatalogCountry
} from "../../countryCatalog/CountryCardMedia";
import { CONTINENTS, countryContinents, type Continent } from "../../countryCatalog/countryContinents";
import { DestinationGlobe } from "../cinematic/DestinationGlobe";
import { CountryEncyclopedia } from "../../countryEncyclopedia/CountryEncyclopedia";
import { CountryBackdrop } from "../horizon/CountryBackdrop";
import { AtlasMark } from "../AtlasMark";
import { CountryAtlasGlobe } from "./CountryAtlasGlobe";
import { ATLAS_GLOBE_PLACES } from "../../countryCatalog/globeMarkerProjection";
import styles from "./OriginalLanding.module.css";

export type { CountryCatalogCountry } from "../../countryCatalog/CountryCardMedia";

type CountryPackSummary = {
  confidence?: string;
  registration?: string;
};

type CountryCatalogProps = {
  presentation?: "original" | "horizon" | "horizon2";
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

type ShelfMode = "closed" | "open" | "expanded";

export function OriginalLanding({ countries, countryPacks, onConfigure, onOpen, presentation = "original" }: CountryCatalogProps) {
  const refined = presentation === "horizon2";
  const horizon = presentation === "horizon" || refined;
  const [encyclopediaOpen, setEncyclopediaOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("norway");
  const [continent, setContinent] = useState<Continent | null>(null);
  const selected = countries.find((country) => country.slug === selectedSlug) ?? countries[0];
  const choose = (country: CountryCatalogCountry) => {
    setSelectedSlug(country.slug);
    if (continent && countryContinents[country.code] !== continent) setContinent(null);
    setShelfMode("closed");
  };
  const surprise = (random: number) => {
    const candidates = countries.filter((country) => country.slug !== selected?.slug);
    if (candidates.length) choose(candidates[Math.floor(random * candidates.length)]);
  };
  const [query, setQuery] = useState("");
  const [shelfMode, setShelfMode] = useState<ShelfMode>("closed");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const normalizedQuery = normalizeQuery(query);
  const filteredCountries = useMemo(() => countries.filter((country) => {
    if (horizon && continent && countryContinents[country.code] !== continent) return false;
    if (!normalizedQuery) return true;
    return [country.name, country.code, country.displayCode]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  }), [countries, normalizedQuery, horizon, continent]);
  const liveAtlasPackCount = useMemo(
    () => Object.values(countryPacks).filter((pack) =>
      pack?.registration === "source_controlled" ||
      pack?.registration === "runtime_draft"
    ).length,
    [countryPacks]
  );
  const globeDestinations = useMemo(
    () => ATLAS_GLOBE_PLACES.flatMap((place) => {
      const country = countries.find((candidate) => candidate.slug === place.slug);
      if (!country) return [];
      return [{ location: place.location, name: country.name, slug: country.slug }];
    }),
    [countries]
  );

  const shelfCountries = normalizedQuery || (horizon && continent) ? filteredCountries : countries;

  const openGlobeDestination = (countrySlug: string) => {
    const country = countries.find((candidate) => candidate.slug === countrySlug);
    if (country) onOpen(country);
  };

  return (
    <section
      className={`${styles["country-landing"]} ${styles["country-landing--standalone"]} ${horizon ? styles.horizon : ""} ${refined ? styles["horizon-two"] : ""}`}
      aria-label="Choose a country"
      onKeyDown={(event) => { if (horizon && event.key === "Escape") setShelfMode("closed"); }}
    >
      <div
        className={`${styles["country-stage"]} ${
          shelfMode === "expanded" ? styles["country-stage--shelf-open"] : ""
        } ${shelfMode === "closed" ? styles["country-stage--shelf-closed"] : ""}`}
      >
        {encyclopediaOpen && selected ? <CountryEncyclopedia country={selected} onDismiss={() => setEncyclopediaOpen(false)} /> : null}
        {horizon && selected ? <>
          <CountryBackdrop slug={selected.slug} />
          <div className={styles["horizon-shade"]} aria-hidden="true" />
        </> : null}
        {refined ? <div className={styles["horizon-topbar"]}>
          <div className={styles["intro-brand-lockup"]}><a href="/" className={styles["horizon-brand"]} aria-label="RoamAtlas home"><AtlasMark /><span>roam<span>atlas</span></span></a><span className={styles["intro-tagline"]}>The atlas of<br />possible adventures</span></div>
          <button type="button" className={styles["horizon-destinations"]} aria-expanded={shelfMode !== "closed"} onClick={() => { setQuery(""); setShelfMode(shelfMode === "closed" ? "expanded" : "closed"); }}>Destinations <span>{countries.length}</span><span aria-hidden="true">↗</span></button>
        </div> : null}
        <header className={styles["country-hero"]}>
          <div className={styles["country-hero-copy"]}>
            {horizon ? <>
              {!refined ? <a href="/" className={styles["horizon-brand"]} aria-label="RoamAtlas home"><AtlasMark /><span>roam<span>atlas</span></span></a> : null}
              {refined ? <section className={styles["horizon-intro"]} aria-label="Welcome to RoamAtlas">
                <p className={styles["intro-kicker"]}><span aria-hidden="true" />Follow your curiosity</p>
                <h2>A whole world.<br /><em>Yours to explore.</em></h2>
                <p className={styles["intro-description"]}>Find your places in an illustrated atlas.<br />Turn a little curiosity into your next trip.</p>

              </section> : null}
              {refined ? <p className={styles["horizon-location"]}>{selected ? countryContinents[selected.code] : "The world"} <span className={styles["horizon-code-pill"]}>{selected?.displayCode}</span></p> : null}
              <h1 key={selected?.slug} className={styles["horizon-title"]}>{selected?.name ?? "Somewhere"}<span>.</span></h1>
              <div className={styles["hero-actions"]}>
                {selected ? <button type="button" className={styles["hero-primary-action"]} onClick={() => onOpen(selected)}>Explore {selected.name} <span aria-hidden="true">↗</span></button> : null}
                <button type="button" className={styles["hero-secondary-action"]} aria-expanded={shelfMode !== "closed"} onClick={() => { if (shelfMode === "closed") { setContinent(null); setQuery(""); } setShelfMode((current) => current === "closed" ? "expanded" : "closed"); }}>Browse all countries</button>
              </div>
              <div className={styles["discovery-actions"]}>
              <button type="button" className={styles["surprise-action"]} onClick={() => surprise(Math.random())} disabled={countries.length < 2}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h3c4 0 8 12 12 12h3M17 14l4 4-4 4M3 18h3c1.5 0 3-1.7 4.5-4M13.5 10C15 7.7 16.5 6 18 6h3M17 2l4 4-4 4" /></svg>
                Surprise me
              </button>
              <button type="button" className={styles["surprise-action"]} disabled={!selected} onClick={() => setEncyclopediaOpen(true)} aria-haspopup="dialog">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" /></svg>
                Encyclopedia
              </button>
              </div>
            </> : <>
            <p className={styles.eyebrow}>RoamAtlas · illustrated travel intelligence</p>
            <p className={styles["hero-kicker"]}>An atlas you can enter</p>
            <h1>Find the story behind your next journey.</h1>
            <p className={styles["hero-description"]}>
              Drag the globe, then click a gold pin to enter that country.
            </p>
            <div className={styles["hero-actions"]}>
              <button type="button" className={styles["hero-primary-action"]} onClick={() => openGlobeDestination("singapore")}>
                Explore Singapore <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                className={styles["hero-secondary-action"]}
                onClick={() => setShelfMode("expanded")}
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
                <dt>{liveAtlasPackCount}</dt>
                <dd>live atlas packs</dd>
              </div>
            </dl>
            </>}
          </div>
          <div className={styles["country-hero-globe"]}>
            {horizon ? <DestinationGlobe compact streamlined={refined} presentation="hero" showRegionFilters={!refined && shelfMode === "closed"} countries={countries} selected={selected} onSelect={choose} continent={continent} onContinentChange={setContinent} onBrowse={() => { setQuery(""); setShelfMode("expanded"); }} /> : <>
            <div className={styles["globe-caption"]}>
              <span className={styles["globe-caption-line"]} aria-hidden="true" />
              <p>Asia · live atlas</p>
              <span>Routes radiate from Singapore</span>
            </div>
            <CountryAtlasGlobe destinations={globeDestinations} onSelect={openGlobeDestination} />
            </>}
          </div>
        </header>

        {shelfMode === "expanded" ? (
          <button
            type="button"
            className={styles["country-shelf-backdrop"]}
            aria-label="Minimize country index"
            onClick={() => setShelfMode("open")}
          />
        ) : null}

        <aside
          className={`${styles["country-shelf"]} ${
            shelfMode === "expanded" ? styles["country-shelf--expanded"] : ""
          } ${shelfMode === "closed" ? styles["country-shelf--closed"] : ""}`}
          aria-label="Country index"
        >
          <button
            type="button"
            className={styles["country-shelf-toggle"]}
            aria-label={
              shelfMode === "closed"
                ? "Open country index"
                : shelfMode === "expanded"
                  ? "Collapse country index"
                  : "Expand country index"
            }
            aria-expanded={shelfMode === "expanded"}
            onClick={() => setShelfMode((current) => current === "open" ? "expanded" : "open")}
          >
            <span className={styles["country-shelf-toggle-icon"]} aria-hidden="true">
              {shelfMode === "expanded" ? "→" : "←"}
            </span>
          </button>
          <div
            className={styles["country-shelf-body"]}
            inert={shelfMode === "closed" ? true : undefined}
          >
          <div className={styles["country-shelf-heading"]}>
            <div className={styles["country-shelf-title-row"]}>
              <p className={styles.eyebrow}>Country index</p>
              <button
                type="button"
                className={`${styles["country-shelf-search-toggle"]} ${
                  isSearchOpen ? styles["country-shelf-search-toggle--open"] : ""
                }`}
                aria-label={isSearchOpen ? "Close country search" : "Search countries"}
                aria-expanded={isSearchOpen}
                onClick={() => {
                  setIsSearchOpen((current) => !current);
                  if (isSearchOpen) setQuery("");
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="10.8" cy="10.8" r="5.8" />
                  <path d="m15.2 15.2 4 4" />
                </svg>
              </button>
              <button
                type="button"
                className={styles["country-shelf-close"]}
                aria-label={shelfMode === "expanded" ? "Shrink country index" : "Close country index"}
                onClick={() => setShelfMode((current) => current === "expanded" ? "open" : "closed")}
              >
                ×
              </button>
            </div>
            {isSearchOpen ? (
              <label className={styles["country-shelf-search-panel"]}>
                <span className="visually-hidden">Search countries</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {horizon ? <div className={styles["drawer-continents"]} role="group" aria-label="Filter drawer by continent">
              <button type="button" aria-pressed={continent === null} onClick={() => setContinent(null)}>All <span>{countries.length}</span></button>
              {CONTINENTS.map((region) => <button type="button" key={region} aria-pressed={continent === region} onClick={() => setContinent(region)}>{region} <span>{countries.filter((country) => countryContinents[country.code] === region).length}</span></button>)}
            </div> : null}
            <p className={horizon ? styles["drawer-result-count"] : undefined}>{horizon && continent ? `${continent} · ${filteredCountries.length} countries` : normalizedQuery ? `${filteredCountries.length} matching countries` : "Scroll to explore every country"}</p>
          </div>

          <section className={styles["country-grid"]} aria-label="Country cards">
            {shelfCountries.map((country) => {
              const pack = countryPacks[country.slug];
              const isMapped = pack?.registration === "source_controlled" && pack.confidence === "confirmed";
              return (
                <article
                  key={country.code}
                  className={`${styles["country-card"]} ${
                    styles[`country-card--${isMapped ? "mapped" : "available"}`]
                  } ${horizon && country.slug === selected?.slug ? styles["horizon-selected"] : ""}`}
                  aria-label={`${country.name}, ${isMapped ? "source-reviewed explorer" : "starter explorer"}`}
                >
                  <CountryCardPhoto country={country} classNames={styles} />
                  <button
                    type="button"
                    className={styles["country-card-hitbox"]}
                    aria-label={`${horizon ? "Preview" : "Open"} ${country.name}`}
                    aria-pressed={horizon ? country.slug === selected?.slug : undefined}
                    onClick={() => horizon ? choose(country) : onOpen(country)}
                  />
                  <CountryCardFlag country={country} classNames={styles} />
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
          </div>
        </aside>
      </div>
    </section>
  );
}
