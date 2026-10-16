import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CountryCatalogCountry } from "../countryCatalog/CountryCardMedia";
import { countryContinents } from "../countryCatalog/countryContinents";
import { countryPhotoUrl } from "../landingVariants/cinematic/cinematicCountryPresentation";
import { countryArticleUrl, retrieveCountryEncyclopedia } from "./countryEncyclopediaProvider";
import styles from "./CountryEncyclopedia.module.css";

type Props = { country: CountryCatalogCountry; onDismiss: () => void };

export function CountryEncyclopedia({ country, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const query = useQuery({
    queryKey: ["country-encyclopedia", country.code],
    queryFn: ({ signal }) => retrieveCountryEncyclopedia(country, signal),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  useEffect(() => {
    const trigger = document.activeElement;
    dialogRef.current?.showModal();
    return () => { if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true }); };
  }, []);

  const paragraphs = query.data?.extract.split(/\n+/).filter(Boolean) ?? [];
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="encyclopedia-title" onCancel={onDismiss} onClose={onDismiss}>
    <header className={styles.header}><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" /></svg>COUNTRY ENCYCLOPEDIA</span><button type="button" onClick={onDismiss} aria-label="Close encyclopedia">×</button></header>
    <div className={styles.body}>
      <aside className={styles.cover} aria-label={`${country.name} reference photograph`}>
        <img className={styles.photo} src={countryPhotoUrl(country.slug)} alt="" />
        <div className={styles["cover-copy"]}>
          <p className={styles.region}><img src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} alt="" />{countryContinents[country.code]} <span>{country.displayCode}</span></p>
          <h2 id="encyclopedia-title">{country.name}<span>.</span></h2>
          <span className={styles["cover-note"]}>A closer look at your next somewhere.</span>
        </div>
        <span className={styles["photo-label"]}>REFERENCE PHOTOGRAPHY</span>
      </aside>
      <section className={styles.reading} aria-label="Country overview" tabIndex={0}>
        <div className={styles["reading-heading"]}><span>01 / DISCOVER</span><span>Wikipedia</span></div>
        <h3>Get to know {country.name}.</h3>
        <p className={styles.context}>Geography, identity, and a little background.</p>
        <div className={styles.article} aria-busy={query.isPending}>
          {query.isPending ? <div role="status" className={styles.loading}><span /><span /><span /><p>Retrieving the country overview…</p></div> : null}
          {query.isError ? <div role="alert" className={styles.error}><p>We couldn’t retrieve this overview. You can try again or read the source directly.</p><button type="button" className={styles.retry} onClick={() => void query.refetch()}>Try again</button></div> : null}
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <div className={styles.attribution}>
          <span className={styles.badge}>GENERAL REFERENCE</span>
          <p>General background, not reviewed travel advice.</p>
          {query.data ? <p>Retrieved {new Date(query.data.retrievedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}</p> : null}
          <p>Text from Wikipedia contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>
        </div>
      </section>
    </div>
    <footer className={styles.footer}><span>Keep following your curiosity.</span><a href={query.data?.sourceUrl ?? countryArticleUrl(country)} target="_blank" rel="noreferrer">Read the full article on Wikipedia <span aria-hidden="true">↗</span></a></footer>
  </dialog>;
}
