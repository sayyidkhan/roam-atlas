import { useEffect, useMemo, useRef, useState } from "react";
import { CONTINENTS, countryContinents, type Continent } from "../../countryCatalog/countryContinents";
import { COUNTRY_GEOGRAPHY_SOURCE } from "../../countryCatalog/countryGeography";
import type { LandingVariantProps } from "../landingVariantTypes";
import { countryPackLabel, countryPhotoUrl } from "./cinematicCountryPresentation";
import styles from "./CountryDrawer.module.css";

type Props = Pick<LandingVariantProps, "countries" | "countryPacks"> & {
  selectedSlug?: string;
  continent?: Continent | null;
  onContinentChange?: (continent: Continent | null) => void;
  onSelect: (country: LandingVariantProps["countries"][number]) => void;
  onDismiss: () => void;
};

export function CountryDrawer({ countries, countryPacks, selectedSlug, onSelect, onDismiss, continent = null, onContinentChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => countries.filter((country) =>
    (!continent || countryContinents[country.code] === continent) && [country.name, country.code, country.displayCode].some((value) => value.toLowerCase().includes(normalized))
  ), [countries, normalized, continent]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    searchRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  // Scroll only the results pane, keeping the fixed search and page in place.
  useEffect(() => {
    const pane = resultsRef.current;
    const card = selectedRef.current;
    if (!pane) return;
    pane.scrollTop = !normalized && card
      ? pane.scrollTop + card.getBoundingClientRect().top - pane.getBoundingClientRect().top - 4
      : 0;
  }, [selectedSlug, normalized, continent]);

  return <dialog ref={dialogRef} className={styles.drawer} aria-labelledby="country-drawer-title"
    onCancel={onDismiss} onClose={onDismiss}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
    }}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <h2 id="country-drawer-title">Destinations<span>.</span></h2>
        <button className={styles.close} type="button" onClick={onDismiss} aria-label="Close country drawer">×</button>
      </header>
      {onContinentChange ? <label className={styles["continent-filter"]}>Continent<select aria-label="Filter countries by continent" value={continent ?? ""} onChange={(event) => onContinentChange(event.target.value ? event.target.value as Continent : null)}><option value="">All {countries.length} countries</option>{CONTINENTS.map((name) => <option value={name} key={name}>{name} ({countries.filter((country) => countryContinents[country.code] === name).length})</option>)}</select></label> : null}
      <form role="search" className={styles.search} onSubmit={(event) => { event.preventDefault(); if (normalized && results.length === 1) onSelect(results[0]); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
        <label className={styles["sr-only"]} htmlFor="country-drawer-search">Search countries</label>
        <input ref={searchRef} id="country-drawer-search" type="search" placeholder="Search a country or code" autoComplete="off" value={query} aria-controls="country-drawer-results" onChange={(event) => { setQuery(event.target.value); resultsRef.current?.scrollTo?.({ top: 0 }); }} />
        {query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>×</button> : <span className={styles["search-hint"]}>A—Z</span>}
      </form>
      <div className={styles["list-heading"]}><p role="status">{results.length} {results.length === 1 ? "country" : "countries"}{normalized ? " found" : " to explore"}</p><span>{continent ?? `${countries.find((country) => country.slug === selectedSlug)?.name ?? "No country"} selected`}</span></div>
      <div ref={resultsRef} id="country-drawer-results" className={styles.results}>
        <div className={styles.grid}>
          {results.map((country) => <button type="button" key={country.code} ref={selectedSlug === country.slug ? selectedRef : undefined} className={styles.country} aria-label={`Preview ${country.name}`} aria-pressed={selectedSlug === country.slug} onClick={() => onSelect(country)}>
            <span className={styles.image}><img src={countryPhotoUrl(country.slug)} alt="" loading="lazy" /><span className={styles.code}>{country.displayCode}</span>{selectedSlug === country.slug ? <span className={styles.viewing}>VIEWING</span> : null}</span>
            <span className={styles["country-name"]}>{country.name}<span aria-hidden="true">↗</span></span>
            <span className={styles.status}>{countryPackLabel(countryPacks[country.slug])}</span>
          </button>)}
        </div>
        {!results.length ? <div className={styles.empty}><h3>No country found.</h3><p>Try a country name or its two-letter code.</p><button type="button" onClick={() => { setQuery(""); onContinentChange?.(null); searchRef.current?.focus(); }}>Show all countries</button></div> : null}
      </div>
      <footer className={styles.footer}><span>Photography is a preview.</span><a href={COUNTRY_GEOGRAPHY_SOURCE} target="_blank" rel="noreferrer">Globe positions · mledoze / ODbL</a></footer>
    </div>
  </dialog>;
}
