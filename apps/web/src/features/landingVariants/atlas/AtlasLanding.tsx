import { useMemo, useRef, useState } from "react";

import { APP_CONFIG } from "../../../config/appConfig";
import { AtlasMark } from "../AtlasMark";
import type { LandingVariantProps } from "../landingVariantTypes";
import styles from "./AtlasLanding.module.css";

const STARTING_SLUGS = ["japan", "italy", "indonesia", "morocco", "singapore"];

export function AtlasLanding({ countries, countryPacks, onOpen, onConfigure }: LandingVariantProps) {
  const [query, setQuery] = useState("");
  const [showIndex, setShowIndex] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("japan");
  const inputRef = useRef<HTMLInputElement>(null);
  const starting = useMemo(() => STARTING_SLUGS.flatMap((slug) => {
    const country = countries.find((item) => item.slug === slug);
    return country ? [country] : [];
  }), [countries]);
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => countries.filter((country) => [country.name, country.code, country.displayCode].some((value) => value.toLowerCase().includes(normalized))), [countries, normalized]);
  const visible = normalized || showIndex ? results : starting;
  const selected = countries.find((country) => country.slug === selectedSlug) ?? starting[0] ?? countries[0];
  const pack = selected ? countryPacks[selected.slug] : undefined;
  const reviewed = pack?.registration === "source_controlled" && pack.confidence === "confirmed";
  const openable = pack?.registration === "source_controlled" || pack?.registration === "runtime_draft";
  const photoExtension = selected ? (APP_CONFIG.countryCatalog.localAssetExtensionOverrides[selected.slug as keyof typeof APP_CONFIG.countryCatalog.localAssetExtensionOverrides] ?? APP_CONFIG.countryCatalog.localAssetExtension) : "jpg";
  const status = reviewed ? "Source-reviewed atlas" : openable ? "Starter atlas · unverified" : "Create a starter atlas";

  return (
    <main className={styles.atlas}>
      <div className={styles.landscape} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="RoamAtlas home"><span className={styles["brand-mark"]} aria-hidden="true"><AtlasMark /></span> roam<span className={styles["brand-second"]}>atlas</span></a>
        <span className={styles.edition}>THE ATLAS OF<br />POSSIBLE ADVENTURES</span>
        <button className={styles["index-link"]} type="button" onClick={() => { setShowIndex(true); inputRef.current?.focus(); }}>Country index <span aria-hidden="true">↗</span></button>
      </header>

      <div className={styles.exhibit}>
        <section className={styles.story} aria-labelledby="atlas-welcome">
          <p className={styles.eyebrow}><span /> FOLLOW YOUR CURIOSITY</p>
          <h1 id="atlas-welcome">There’s a<br />whole world<br /><em>out there.</em></h1>
          <p className={styles.introduction}>Step into an illustrated atlas.<br />Find your places. Make them a trip.</p>
          <a className={styles["story-link"]} href="#atlas-destination-search" onClick={() => inputRef.current?.focus()}>Where will you begin? <span aria-hidden="true">↗</span></a>
          <div className={styles["exhibit-foot"]}>
            <svg className={styles.compass} viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36" /><circle cx="50" cy="50" r="41" /><path d="M50 6v14m0 60v14M6 50h14m60 0h14M50 21l8 29-8 29-8-29Z" /><path d="m21 50 29-8 29 8-29 8Z" /><text x="50" y="9" textAnchor="middle">N</text></svg>
            <span>A LITTLE WONDER.<br />A DIFFERENT WAY TO WANDER.</span>
          </div>
        </section>

        <section className={styles.desk} aria-labelledby="atlas-destination-title">
          <div className={styles["desk-top"]}><span>DEPARTURES</span><span>YOU CHOOSE THE WAY ↗</span></div>
          <h2 id="atlas-destination-title">Your next chapter.</h2>
          <form className={styles.search} role="search" onSubmit={(event) => { event.preventDefault(); if (normalized && results.length === 1) { setSelectedSlug(results[0].slug); setQuery(""); setShowIndex(false); } }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
            <label className="visually-hidden" htmlFor="atlas-destination-search">Search countries</label>
            <input ref={inputRef} id="atlas-destination-search" type="search" placeholder="Somewhere in mind?" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setShowIndex(false); } }} aria-controls="atlas-country-results" />
          </form>
          <div className={styles["list-heading"]}><span>{normalized ? `${results.length} MATCHING COUNTRIES` : showIndex ? "ALL COUNTRIES" : "A FEW STARTING POINTS"}</span><button type="button" aria-expanded={showIndex} onClick={() => { setShowIndex(!showIndex); setQuery(""); }}>{showIndex ? "Show less −" : "View all +"}</button></div>
          <div className={`${styles["country-list"]} ${showIndex || normalized ? styles["expanded-list"] : ""}`} id="atlas-country-results" aria-label="Choose a destination">
            {visible.map((country, index) => <button className={`${styles.country} ${selected?.slug === country.slug ? styles.selected : ""}`} key={country.code} type="button" aria-pressed={selected?.slug === country.slug} onClick={() => { setSelectedSlug(country.slug); if (showIndex || normalized) { setShowIndex(false); setQuery(""); } }}><span className={styles["country-number"]}>{String(index + 1).padStart(2, "0")}</span><span>{country.name}</span><span className={styles["country-arrow"]} aria-hidden="true">↗</span></button>)}
            {!visible.length ? <p className={styles.empty} role="status">No countries found. Try a country name or code.</p> : null}
          </div>
          {selected ? <div className={styles.selection}>
            <div className={styles.preview} key={selected.slug}>
              <span className={styles["preview-code"]} aria-hidden="true">{selected.displayCode}</span>
              <img src={`/country-cards/${selected.slug}.${photoExtension}`} alt="" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
              <span className={styles["preview-label"]}>A GLIMPSE OF {selected.name.toUpperCase()}</span>
            </div>
            <div className={styles["selection-info"]}><span className={`${styles.status} ${reviewed ? styles.reviewed : ""}`}>{status}</span>{openable ? <button className={styles.customize} type="button" onClick={() => onConfigure(selected)} aria-label={`Customize ${selected.name} atlas`}>Customize ↗</button> : null}</div>
            <button className={styles.enter} type="button" onClick={() => onOpen(selected)}>{openable ? `Enter ${selected.name}` : `Start with ${selected.name}`}<span aria-hidden="true">↗</span></button>
          </div> : null}
          <p className={styles["desk-note"]}>Pick a place. The rest unfolds from there.</p>
        </section>
      </div>
      <footer className={styles.footer}><span>ROAMATLAS / THE WORLD, ONE CHAPTER AT A TIME</span><span>AI-imagined landscape · not a geographic map</span></footer>
    </main>
  );
}
