import { useState } from "react";
import { countryContinents, type Continent } from "../../countryCatalog/countryContinents";
import { AtlasMark } from "../AtlasMark";
import type { LandingVariantProps } from "../landingVariantTypes";
import { DestinationGlobe } from "./DestinationGlobe";
import { CountryDrawer } from "./CountryDrawer";
import { countryPackLabel, countryPhotoUrl } from "./cinematicCountryPresentation";
import styles from "./CinematicLanding.module.css";

export function CinematicLanding({ countries, countryPacks, onOpen, onConfigure }: LandingVariantProps) {
  const [selectedSlug, setSelectedSlug] = useState("norway");
  const [continent, setContinent] = useState<Continent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selected = countries.find((country) => country.slug === selectedSlug) ?? countries[0];
  const selectedIndex = countries.findIndex((country) => country.slug === selected?.slug);
  const pack = selected ? countryPacks[selected.slug] : undefined;
  const configurable = pack?.registration === "source_controlled" || pack?.registration === "runtime_draft";
  const choose = (country: LandingVariantProps["countries"][number]) => {
    setSelectedSlug(country.slug);
    if (continent && countryContinents[country.code] !== continent) setContinent(null);
    setDrawerOpen(false);
  };
  const step = (direction: number) => {
    if (countries.length) choose(countries[(Math.max(0, selectedIndex) + direction + countries.length) % countries.length]);
  };

  return <main className={styles.landing}>
    <section className={styles.hero} aria-labelledby="cinematic-title">
      {selected ? <img key={selected.slug} className={styles.backdrop} src={countryPhotoUrl(selected.slug)} alt="" fetchPriority="high" /> : null}
      <div className={styles.shade} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="RoamAtlas home"><span aria-hidden="true"><AtlasMark /></span> roam<span>atlas</span></a>
        <button type="button" className={styles["browse-button"]} aria-label="Open country drawer" aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>Destinations <span className={styles.count}>{countries.length}</span><span aria-hidden="true">＋</span></button>
      </header>
      <div className={styles.stage}>
        <div className={styles.story}>
          <h1 id="cinematic-title" className={`${styles.title} ${(selected?.name.length ?? 0) > 10 ? styles["title-long"] : ""}`}>{selected?.name ?? "Somewhere"}<span>.</span></h1>
          <div className={styles.actions}>
            {selected ? <button type="button" className={styles.enter} onClick={() => onOpen(selected)}>Explore {selected.name}<span aria-hidden="true">↗</span></button> : null}
          </div>
          {selected && configurable ? <div className={styles["atlas-status"]}><span>{countryPackLabel(pack)}</span>{configurable ? <button type="button" onClick={() => onConfigure(selected)}>Customize atlas</button> : null}</div> : null}
        </div>
        <aside className={styles["world-corner"]} aria-label="World atlas">
          <DestinationGlobe continent={continent} onContinentChange={setContinent} countries={countries} selected={selected} onSelect={choose} countryPacks={countryPacks} onOpen={onOpen} onBrowse={() => setDrawerOpen(true)} compact />
          <nav className={styles.pager} aria-label="Preview another country">
            <button type="button" onClick={() => step(-1)} aria-label="Previous country">←</button>
            <button type="button" className={styles.location} onClick={() => setDrawerOpen(true)} aria-label={`Find ${selected?.name ?? "destination"} in country drawer`}><span className={styles.dot} />{selected?.name}<span aria-hidden="true">⌄</span></button>
            <button type="button" onClick={() => step(1)} aria-label="Next country">→</button>
          </nav>
        </aside>
      </div>

    </section>
    {drawerOpen ? <CountryDrawer continent={continent} onContinentChange={setContinent} countries={countries} countryPacks={countryPacks} selectedSlug={selected?.slug} onSelect={choose} onDismiss={() => setDrawerOpen(false)} /> : null}
  </main>;
}
