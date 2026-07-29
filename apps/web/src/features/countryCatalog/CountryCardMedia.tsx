import { useState } from "react";

import { APP_CONFIG } from "../../config/appConfig.js";
import styles from "./CountryCatalog.module.css";

export type CountryCatalogCountry = {
  code: string;
  displayCode: string;
  name: string;
  slug: string;
};

type CountryCardMediaProps = {
  country: CountryCatalogCountry;
};

function bundledCountryPhotoUrl(
  country: CountryCatalogCountry
): string {
  const catalogConfig = APP_CONFIG.countryCatalog;
  const extension =
    catalogConfig.localAssetExtensionOverrides[
      country.slug as keyof typeof catalogConfig.localAssetExtensionOverrides
    ] ?? catalogConfig.localAssetExtension;
  return `${catalogConfig.localAssetBasePath}/${country.slug}.${extension}`;
}

function countryImageApiUrl(countrySlug: string): string {
  return (
    `/api/country-image?countrySlug=` +
    `${encodeURIComponent(countrySlug)}` +
    `&v=${APP_CONFIG.countryCatalog.imageVersion}`
  );
}

function countryFlagUrl(code: string, width: number): string {
  return (
    `https://flagcdn.com/w${width}/` +
    `${code.toLowerCase()}.png`
  );
}

export function CountryCardPhoto({
  country
}: CountryCardMediaProps) {
  const [source, setSource] = useState(() =>
    bundledCountryPhotoUrl(country)
  );
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      className={styles["country-card-photo"]}
      src={source}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        const fallback = countryImageApiUrl(country.slug);
        if (source !== fallback) {
          setSource(fallback);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

export function CountryCardFlag({
  country
}: CountryCardMediaProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={styles["country-card-visual"]}>
      {failed ? (
        country.displayCode
      ) : (
        <img
          className={styles["country-flag"]}
          src={countryFlagUrl(country.code, 160)}
          srcSet={[
            `${countryFlagUrl(country.code, 80)} 80w`,
            `${countryFlagUrl(country.code, 160)} 160w`,
            `${countryFlagUrl(country.code, 320)} 320w`
          ].join(", ")}
          sizes="(max-width: 720px) 72px, 96px"
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
