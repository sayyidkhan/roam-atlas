import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createGlobe, { type Globe } from "cobe";
import type { CountryCatalogCountry } from "../../countryCatalog/CountryCardMedia";
import { countryCoordinates, COUNTRY_GEOGRAPHY_SOURCE } from "../../countryCatalog/countryGeography";
import { focusAngles, nearestVisibleMarker, projectGlobeMarker } from "../../countryCatalog/globeMarkerProjection";
import { countriesInView, globeRegions, shortestGlobeTurn, type GlobeAngles } from "./globeNavigation";
import { countryContinents, type Continent } from "../../countryCatalog/countryContinents";
import type { LandingVariantProps } from "../landingVariantTypes";
import { GlobeCountryLabels } from "./GlobeCountryLabels";
import { countryPackLabel, countryPhotoUrl } from "./cinematicCountryPresentation";
import styles from "./DestinationGlobe.module.css";

type Props = {
  compact?: boolean;
  streamlined?: boolean;
  showRegionFilters?: boolean;
  presentation?: "standard" | "hero";
  continent?: Continent | null;
  onContinentChange?: (continent: Continent | null) => void;
  countries: CountryCatalogCountry[];
  selected?: CountryCatalogCountry;
  onSelect: (country: CountryCatalogCountry) => void;
  onBrowse?: () => void;
  countryPacks?: LandingVariantProps["countryPacks"];
  onOpen?: LandingVariantProps["onOpen"];
};

export function DestinationGlobe({ countries, selected, onSelect, onBrowse, countryPacks = {}, onOpen, continent, onContinentChange, compact = false, presentation = "standard", showRegionFilters = true, streamlined = false }: Props) {
  const hero = presentation === "hero";
  const [localContinent, setLocalContinent] = useState<Continent | null>(null);
  const activeContinent = continent === undefined ? localContinent : continent;
  const setContinent = onContinentChange ?? setLocalContinent;
  const filteredCountries = useMemo(() => activeContinent ? countries.filter((country) => countryContinents[country.code] === activeContinent) : countries, [countries, activeContinent]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const angles = useRef({ phi: 0, theta: 0.3 });
  const frame = useRef<number | null>(null);
  const initialized = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const exploring = expanded || hero;
  const [view, setView] = useState<GlobeAngles>({ phi: 0, theta: 0.3 });
  const [settledView, setSettledView] = useState<GlobeAngles>({ phi: 0, theta: 0.3 });
  const [moving, setMoving] = useState(false);
  const expandRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const visibleCountries = useMemo(() => countriesInView(filteredCountries, settledView), [filteredCountries, settledView]);
  const cancelFlight = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const flyTo = useCallback((target: GlobeAngles, immediate = false) => {
    cancelFlight();
    const start = { ...angles.current };
    const delta = shortestGlobeTurn(start.phi, target.phi);
    const destination = { phi: start.phi + delta, theta: target.theta };
    const paint = (next: GlobeAngles) => {
      angles.current = next;
      globeRef.current?.update(next);
      setView(next);
    };
    if (immediate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      paint(destination);
      setSettledView(destination);
      setMoving(false);
      return;
    }
    setMoving(true);
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 850);
      const eased = 1 - (1 - progress) ** 3;
      paint({ phi: start.phi + delta * eased, theta: start.theta + (target.theta - start.theta) * eased });
      frame.current = progress < 1 ? requestAnimationFrame(animate) : null;
      if (progress === 1) { setSettledView(destination); setMoving(false); }
    };
    frame.current = requestAnimationFrame(animate);
  }, [cancelFlight]);
  const drag = useRef<{ id: number; x: number; y: number; phi: number; theta: number; moved: boolean } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [hovered, setHovered] = useState<CountryCatalogCountry | null>(null);
  const markers = useMemo(() => filteredCountries.flatMap((country) => {
    const location = countryCoordinates[country.code];
    return location ? [{ location, size: country.slug === selected?.slug ? 0.065 : 0.013,
      color: (country.slug === selected?.slug ? (hero ? [0.95, 0.8, 0.51] : [0.89, 0.97, 0.55]) : [0.5, 0.64, 0.55]) as [number, number, number] }] : [];
  }), [filteredCountries, selected?.slug, hero]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let observer: ResizeObserver | undefined;
    const initialPaints: ReturnType<typeof setTimeout>[] = [];
    const fail = () => setUnavailable(true);
    canvas.addEventListener("webglcontextlost", fail);
    try {
      const context = { alpha: true, antialias: true };
      if (!canvas.getContext("webgl2", context) && !canvas.getContext("webgl", context)) throw new Error("WebGL unavailable");
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth || 260;
      globeRef.current = createGlobe(canvas, {
        width: size, height: size, devicePixelRatio: ratio,
        phi: 0, theta: 0.3, dark: 1, diffuse: 1.4, scale: 1,
        mapSamples: hero ? 32000 : 18000, mapBrightness: 5, mapBaseBrightness: 0.05,
        baseColor: hero ? [0.12, 0.4, 0.43] : [0.48, 0.58, 0.49], markerColor: [0.89, 0.97, 0.55],
        glowColor: hero ? [0.65, 0.43, 0.16] : [0.14, 0.24, 0.19], markers: [],
        context, markerElevation: 0
      });
      observer = new ResizeObserver(() => {
        const width = canvas.clientWidth;
        if (width) globeRef.current?.update({ width, height: width });
      });
      observer.observe(canvas);
      // Cobe 2 decodes its embedded map asynchronously without requesting a render.
      // Repaint during initialization only; the camera stays fixed and then idles.
      for (const delay of [100, 500, 1500]) initialPaints.push(setTimeout(() => globeRef.current?.update({}), delay));
    } catch { fail(); }
    return () => {
      cancelFlight();
      observer?.disconnect();
      initialPaints.forEach(clearTimeout);
      canvas.removeEventListener("webglcontextlost", fail);
      globeRef.current?.destroy();
      globeRef.current = null;
    };
  }, [cancelFlight, hero]);

  useEffect(() => {
    const location = selected && countryCoordinates[selected.code];
    if (location) {
      const [phi, theta] = focusAngles(...location);
      flyTo({ phi, theta }, !initialized.current);
      initialized.current = true;
    }
  }, [selected, flyTo]);

  useEffect(() => { globeRef.current?.update({ markers }); }, [markers]);

  useEffect(() => {
    const region = globeRegions.find((entry) => entry.continent === activeContinent);
    if (region) {
      const [phi, theta] = focusAngles(...region.location);
      flyTo({ phi, theta });
    }
  }, [activeContinent, flyTo]);

  useEffect(() => {
    if (expanded) closeRef.current?.focus({ preventScroll: true });
    else if (wasExpanded.current) expandRef.current?.focus({ preventScroll: true });
    wasExpanded.current = expanded;
  }, [expanded]);

  const collapse = () => {
    setExpanded(false);
  };

  const choose = (country: CountryCatalogCountry) => {
    if (country.slug === selected?.slug) {
      const [phi, theta] = focusAngles(...countryCoordinates[country.code]);
      flyTo({ phi, theta });
    }
    onSelect(country);
  };

  const countryAt = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const points = filteredCountries.flatMap((country) => {
      const location = countryCoordinates[country.code];
      return location ? [{ slug: country.slug, ...projectGlobeMarker({ latitude: location[0], longitude: location[1], width: rect.width, height: rect.height, ...angles.current }) }] : [];
    });
    const slug = nearestVisibleMarker(points, { x: clientX - rect.left, y: clientY - rect.top }, exploring ? 18 : 12);
    return filteredCountries.find((country) => country.slug === slug) ?? null;
  };

  const settleDrag = () => {
    drag.current = null;
    setSettledView({ ...angles.current });
    setMoving(false);
  };

  const turn = (horizontal: number, vertical = 0) => {
    flyTo({ phi: angles.current.phi - horizontal, theta: Math.max(-1.4, Math.min(1.4, angles.current.theta + vertical)) });
  };

  return <section className={`${styles.globe} ${compact ? styles.compact : ""} ${expanded ? styles.expanded : ""} ${hero ? styles.hero : ""} ${streamlined ? styles.streamlined : ""}`} aria-label="World destination globe" data-expanded={expanded} onKeyDown={(event) => { if (event.key === "Escape" && expanded) { event.stopPropagation(); collapse(); } }}>
    {expanded ? <div className={styles["explorer-header"]}><span>Explore the globe</span><button ref={closeRef} type="button" onClick={collapse} aria-label="Close globe explorer">×</button></div> : null}
    {exploring && showRegionFilters && streamlined ? <div className={styles["region-select-row"]}>
      <label><span className={styles["region-select-label"]}>Explore</span><select aria-label="Filter globe by continent" value={activeContinent ?? ""} onChange={(event) => setContinent((event.target.value || null) as Continent | null)}>
        <option value="">All continents</option>{globeRegions.map((region) => <option key={region.continent} value={region.continent}>{region.continent}</option>)}
      </select></label><button type="button" onClick={onBrowse} aria-label={`Browse ${filteredCountries.length} countries`}>{filteredCountries.length} countries ↗</button>
    </div> : null}
    {exploring && showRegionFilters && !streamlined ? <div className={styles["filter-summary"]}><span>{activeContinent ?? "All continents"} · {filteredCountries.length} countries</span>{activeContinent ? <button type="button" onClick={() => setContinent(null)}>Clear filter</button> : null}</div> : null}
    {exploring && showRegionFilters && !streamlined ? <div className={styles.regions} aria-label="Jump to a region">{globeRegions.map((region) => <button key={region.name} type="button" aria-pressed={activeContinent === region.continent} onClick={() => { setContinent(region.continent); const [phi, theta] = focusAngles(...region.location); flyTo({ phi, theta }); }}>{region.name}</button>)}</div> : null}
    {!compact ? <div className={styles.heading}><span>THE WORLD IS OPEN</span><span>{countries.length} COUNTRIES</span></div> : null}
    <div className={styles.orbit}>
      {unavailable ? <div className={styles.fallback}>The world is still yours.<small>Open Destinations to choose a country.</small></div> : <canvas
        ref={canvasRef} className={styles.canvas} role="img" tabIndex={0} aria-label={`World globe. ${selected?.name ?? "Your destination"} highlighted. Use arrow keys to rotate, or the country labels to choose a destination.`}
        onKeyDown={(event) => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-0.45, 0], ArrowRight: [0.45, 0], ArrowUp: [0, 0.35], ArrowDown: [0, -0.35] };
          const direction = directions[event.key];
          if (direction) { event.preventDefault(); turn(...direction); }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          cancelFlight();
          setMoving(false);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ...angles.current, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) {
            setHovered(countryAt(event.currentTarget, event.clientX, event.clientY));
            return;
          }
          if (start.id !== event.pointerId) return;
          setHovered(null);
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) > 5) start.moved = true;
          if (!start.moved) return;
          setMoving(true);
          angles.current = { phi: start.phi + dx / 100, theta: Math.max(-1.4, Math.min(1.4, start.theta + dy / 150)) };
          globeRef.current?.update(angles.current);
          setView({ ...angles.current });
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          settleDrag();
          if (!start.moved) {
            const country = countryAt(event.currentTarget, event.clientX, event.clientY);
            setHovered(null);
            if (country) choose(country);
          }
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerLeave={() => setHovered(null)}
        onPointerCancel={settleDrag}
        onLostPointerCapture={() => { if (drag.current) settleDrag(); }}
      />}
      {exploring && !unavailable ? <GlobeCountryLabels moving={moving} countries={streamlined ? [visibleCountries.find((country) => country.slug === selected?.slug), ...visibleCountries.filter((country) => country.slug !== selected?.slug)].filter((country): country is CountryCatalogCountry => Boolean(country)).slice(0, 4) : visibleCountries} view={view} selectedSlug={selected?.slug} onSelect={choose} /> : null}
      {hovered && !exploring ? <span className={styles.tooltip}>{hovered.name}</span> : null}
    </div>
    {compact && !exploring ? <button ref={expandRef} type="button" className={styles.expand} aria-expanded={expanded} onClick={() => setExpanded(true)}>Browse globe <span aria-hidden="true">⤢</span></button> : null}
    {exploring ? <>
      <div className={styles["turn-controls"]}>
        <button type="button" aria-label="Turn globe left" disabled={unavailable} onClick={() => turn(-0.65)}>←</button>
        <button type="button" aria-label="Tilt globe up" disabled={unavailable} onClick={() => turn(0, 0.35)}>↑</button>
        <span>{moving ? "Turning…" : "Drag or use arrows"}</span>
        <button type="button" aria-label="Tilt globe down" disabled={unavailable} onClick={() => turn(0, -0.35)}>↓</button>
        <button type="button" aria-label="Turn globe right" disabled={unavailable} onClick={() => turn(0.65)}>→</button>
      </div>
      {onBrowse && activeContinent && showRegionFilters && !streamlined ? <button type="button" className={styles["continent-list"]} onClick={onBrowse} aria-haspopup="dialog">{activeContinent ? `View all ${filteredCountries.length} countries in ${activeContinent}` : `View all ${countries.length} countries`} <span aria-hidden="true">↗</span></button> : null}
      {unavailable ? <div className={styles["country-options"]}>{visibleCountries.map((country) => <button type="button" key={country.slug} aria-label={`Globe preview ${country.name}`} onClick={() => choose(country)}>{country.name}</button>)}</div> : null}
      {selected && !hero ? <article className={styles["country-preview"]} aria-label="Selected country preview">
        <img src={countryPhotoUrl(selected.slug)} alt="" />
        <div><span className={styles["preview-code"]}>{selected.displayCode} · SELECTED</span><h3>{selected.name}</h3><p>{countryPackLabel(countryPacks[selected.slug])}</p></div>
        {onOpen ? <button type="button" aria-label={`Open ${selected.name} atlas`} onClick={() => onOpen(selected)}>Explore <span aria-hidden="true">↗</span></button> : null}
      </article> : null}
      {onBrowse && !hero ? <button type="button" className={styles["search-all"]} aria-haspopup="dialog" onClick={() => { setContinent(null); onBrowse(); }}>Search all {countries.length} countries <span aria-hidden="true">↗</span></button> : null}
    </> : null}
    {!compact ? <div className={styles.controls}>
      <button type="button" aria-label="Turn globe left" disabled={unavailable} onClick={() => turn(-0.45)}>←</button>
      <span>{selected?.name ?? "Pick your somewhere"}<small>{unavailable ? "Browse the country index" : "Drag to turn · tap a dot to preview"}</small></span>
      <button type="button" aria-label="Turn globe right" disabled={unavailable} onClick={() => turn(0.45)}>→</button>
    </div> : null}
    {!compact ? <a className={styles.source} href={COUNTRY_GEOGRAPHY_SOURCE} target="_blank" rel="noreferrer">Approximate country positions · mledoze / ODbL</a> : null}
  </section>;
}
