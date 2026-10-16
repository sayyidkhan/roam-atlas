import { useMemo, useRef, useState } from "react";

import { AtlasMark } from "../AtlasMark";
import type { LandingVariantProps } from "../landingVariantTypes";
import { DestinationPostcard } from "./DestinationPostcard";
import styles from "./PlayfulLanding.module.css";

// Editorial starting points, not recommendations or availability claims.
const STARTING_COUNTRIES = ["japan", "italy", "indonesia", "morocco", "mexico", "norway"];

export function PlayfulLanding({ countries, countryPacks, onConfigure, onOpen }: LandingVariantProps) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [shuffledSlugs, setShuffledSlugs] = useState<string[] | null>(null);
  const [arrangement, setArrangement] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCountries = useMemo(() => countries.filter((country) =>
    [country.name, country.code, country.displayCode].some((value) => value.toLowerCase().includes(normalizedQuery))
  ), [countries, normalizedQuery]);
  const startingCountries = useMemo(() => {
    const featured = (shuffledSlugs ?? STARTING_COUNTRIES).flatMap((slug) => {
      const country = countries.find((candidate) => candidate.slug === slug);
      return country ? [country] : [];
    });
    return [...featured, ...countries.filter((country) => !featured.includes(country))].slice(0, 6);
  }, [countries, shuffledSlugs]);
  const visibleCountries = normalizedQuery || showAll ? filteredCountries : startingCountries;
  const isDesk = !normalizedQuery && !showAll;

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };
  const browseCountries = () => {
    setQuery("");
    setShowAll((value) => !value);
    document.getElementById("playful-destinations")?.scrollIntoView({ block: "start" });
  };
  const shuffleCountries = () => {
    const shuffled = [...countries];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    setShuffledSlugs(shuffled.slice(0, 6).map((country) => country.slug));
    setArrangement((value) => value + 1);
    setQuery("");
    setShowAll(false);
  };

  return (
    <main className={styles.landing}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="RoamAtlas home"><span aria-hidden="true"><AtlasMark /></span>roam<span className={styles["brand-second"]}>atlas</span></a>
        <span className={styles["header-note"]}>YOUR CURIOSITY CALLED.<br />IT WANTS TO GO SOMEWHERE.</span>
        <button type="button" className={styles["index-button"]} onClick={browseCountries}>Country index <span>{countries.length}</span> ↗</button>
      </header>

      <section className={styles.intro} aria-labelledby="playful-welcome-title">
        <div className={styles["intro-orbit"]} aria-hidden="true" />
        <span className={styles["hello-sticker"]} aria-hidden="true">LESS<br /><strong>same old.</strong>↗</span>
        <span className={styles["curious-sticker"]} aria-hidden="true">GO ON.<br />GET A LITTLE<br /><strong>LOST.</strong></span>
        <p className={styles.eyebrow}>A LITTLE CURIOSITY. A WHOLE WORLD TO GO.</p>
        <h1 id="playful-welcome-title">GO <span>SOMEWHERE.</span></h1>
        <p className={styles.description}>Open a postcard. Follow a rabbit hole. Make it a trip.</p>

        <div className={styles["search-wrap"]} onFocus={() => setSearchFocused(true)} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchFocused(false);
        }}>
          <form role="search" className={styles.search} onSubmit={(event) => {
            event.preventDefault();
            if (normalizedQuery && filteredCountries.length === 1) onOpen(filteredCountries[0]);
            else document.getElementById("playful-destinations")?.scrollIntoView({ block: "start" });
          }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
            <label className={styles["visually-hidden"]} htmlFor="playful-country-search">Search countries</label>
            <input ref={searchRef} id="playful-country-search" type="search" placeholder="Got a place in mind?" autoComplete="off" value={query} aria-controls="playful-country-results"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") clearSearch(); }} />
            {query ? <button type="button" className={styles["clear-search"]} onClick={clearSearch} aria-label="Clear search">×</button> : null}
            <button type="submit" className={styles["search-submit"]} aria-label="Find destination">Let’s go <span aria-hidden="true">↗</span></button>
          </form>
          {searchFocused && normalizedQuery ? (
            <div className={styles["search-matches"]} role="region" aria-label="Matching destinations">
              {filteredCountries.length ? filteredCountries.slice(0, 5).map((country) => (
                <button key={country.code} type="button" onClick={() => onOpen(country)} aria-label={`Choose ${country.name}`}>
                  <span className={styles["match-code"]}>{country.displayCode}</span><span>{country.name}</span><span aria-hidden="true">↗</span>
                </button>
              )) : <p>No matching countries. Try another name.</p>}
              {filteredCountries.length > 5 ? <a href="#playful-destinations" onClick={() => setSearchFocused(false)}>See all {filteredCountries.length} matches ↓</a> : null}
            </div>
          ) : null}
        </div>
        <div className={styles["intro-actions"]}>
          <span>No plan yet? Good.</span>
          <button type="button" onClick={shuffleCountries} aria-label="Shuffle destinations"><span aria-hidden="true">⤨</span> Shuffle my horizons</button>
        </div>
      </section>

      <section id="playful-destinations" className={styles.destinations} aria-labelledby="playful-destination-title">
        <div className={styles["collection-heading"]}>
          <h2 id="playful-destination-title">{normalizedQuery ? "Your search results" : showAll ? "The whole world is on the table." : "Your daydreams, on the table."}</h2>
          <button type="button" className={styles["browse-button"]} onClick={browseCountries}>{showAll ? "Show fewer countries" : `Browse all ${countries.length} countries`} <span aria-hidden="true">↗</span></button>
        </div>
        <p role="status" className={styles["results-status"]}>{normalizedQuery ? `${filteredCountries.length} ${filteredCountries.length === 1 ? "country" : "countries"} found` : arrangement ? "Fresh destinations on the desk. Choose any postcard to begin." : "Open a postcard. Your next chapter is inside."}</p>
        <p id="playful-postcard-move-help" className={styles["visually-hidden"]}>Drag the handle to rearrange a postcard, or use arrow keys while the handle is focused. Escape resets its position.</p>
        <div id="playful-country-results" className={`${styles["postcard-stage"]} ${isDesk ? styles["postcard-stage--desk"] : styles["postcard-stage--grid"]}`}>
          {visibleCountries.map((country, index) => {
            const pack = countryPacks[country.slug];
            const isReviewed = pack?.registration === "source_controlled" && pack?.confidence === "confirmed";
            const isOpenable = pack?.registration === "source_controlled" || pack?.registration === "runtime_draft";
            const status = isReviewed ? "Source-reviewed atlas" : isOpenable ? "Starter atlas · unverified" : "Create a starter atlas";
            return <DestinationPostcard key={`${country.code}-${arrangement}`} country={country} index={index} status={status} onOpen={() => onOpen(country)} onConfigure={isOpenable ? () => onConfigure(country) : undefined} />;
          })}
        </div>
        {!visibleCountries.length ? <div className={styles["empty-state"]}><h3>No countries found for “{query.trim()}”</h3><p>Try a country name or its two-letter code.</p><button type="button" onClick={clearSearch}>Clear search</button></div> : null}
        {isDesk ? <div className={styles["desk-caption"]}><span className={styles["desktop-hint"]}>↖ Grab a handle. Make this desk yours.</span><span className={styles["mobile-hint"]}>Swipe through the postcards. Tap a place to start.</span><span>REFERENCE PHOTOS · NOT VERIFIED TRAVEL GUIDANCE</span></div> : null}
      </section>

      <footer className={styles.footer}>
        <span className={styles["footer-tag"]}>THE ROAMATLAS WAY</span>
        <span><b>01</b> Find your somewhere</span><i aria-hidden="true">↗</i>
        <span><b>02</b> Follow your curiosity</span><i aria-hidden="true">↗</i>
        <span><b>03</b> Make it a trip</span>
        <span className={styles["footer-star"]} aria-hidden="true"><AtlasMark /></span>
      </footer>
    </main>
  );
}
