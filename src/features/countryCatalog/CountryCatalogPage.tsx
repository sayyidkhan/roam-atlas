import { useEffect, useState } from "react";
import { worldCountries } from "../../data/countries.js";
import {
  countryPacks,
  initCountryPackRegistry,
  isConfiguredCountryPack
} from "../../data/countryPacks/index.js";
import { useApplicationStore } from "../../app/applicationStore";
import { CountryCatalogView, type CountryCatalogCountry } from "./CountryCatalogView";

export function CountryCatalogPage() {
  const { dispatch } = useApplicationStore();
  const [registryVersion, setRegistryVersion] = useState(0);

  useEffect(() => {
    let active = true;
    initCountryPackRegistry().finally(() => {
      if (active) setRegistryVersion((version) => version + 1);
    });
    return () => {
      active = false;
    };
  }, []);

  const configure = (country: CountryCatalogCountry) => {
    dispatch({ type: "show_country_setup", countrySlug: country.slug });
    enterLegacyRuntime(`/${country.slug}/config`);
  };

  const open = (country: CountryCatalogCountry) => {
    if (!isConfiguredCountryPack(country.slug)) {
      configure(country);
      return;
    }
    dispatch({ type: "show_explorer", countrySlug: country.slug });
    enterLegacyRuntime(`/${country.slug}`);
  };

  return (
    <CountryCatalogView
      key={registryVersion}
      countries={worldCountries}
      countryPacks={countryPacks as Record<string, { confidence?: string } | undefined>}
      onConfigure={configure}
      onOpen={open}
    />
  );
}

function enterLegacyRuntime(path: string): void {
  window.location.assign(path);
}
