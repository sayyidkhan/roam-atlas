import { useCallback, useEffect, useRef, useState } from "react";
import type { CountryCatalogCountry } from "../countryCatalog/CountryCardMedia";
import { countryContinents } from "../countryCatalog/countryContinents";
import { countryPhotoUrl } from "../landingVariants/cinematic/cinematicCountryPresentation";
import { AtlasMark } from "../landingVariants/AtlasMark";
import styles from "./CountryArrival.module.css";

type Props = { country: CountryCatalogCountry; onComplete: () => void; onDismiss: () => void };

export function CountryArrival({ country, onComplete, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const completeRef = useRef(onComplete);
  const finished = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  const enter = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    completeRef.current();
  }, []);

  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.showModal();
    const fallback = setTimeout(() => setReady(true), 700);
    return () => {
      clearTimeout(fallback);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(enter, reduced ? 0 : 3400);
    return () => clearTimeout(timer);
  }, [ready, enter]);

  return <dialog ref={dialog} className={styles.arrival} aria-labelledby="arrival-title" data-ready={ready}
    onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
    <img className={styles.photograph} src={countryPhotoUrl(country.slug)} alt="" onLoad={() => setReady(true)} onError={() => setReady(true)} fetchPriority="high" />
    <div className={styles.shade} aria-hidden="true" />
    <header className={styles.header}><span className={styles.brand}><AtlasMark />roamatlas</span><button type="button" onClick={onDismiss}>Back to the world <span aria-hidden="true">↗</span></button></header>
    <div className={styles.story}>
      <p className={styles.eyebrow}>A NEW CHAPTER <span aria-hidden="true">/</span> {country.displayCode}</p>
      <h1 id="arrival-title">{country.name}<span>.</span></h1>
      <div className={styles.rule} aria-hidden="true" />
      <p className={styles.invitation}>Let your curiosity lead the way.</p>
      <span className={styles.region}>{countryContinents[country.code]}</span>
    </div>
    <footer className={styles.footer}><span>YOUR ATLAS AWAITS</span><button type="button" onClick={enter}>Skip intro <span aria-hidden="true">→</span></button></footer>
    <div className={styles.progress} aria-hidden="true"><span /></div>
  </dialog>;
}
