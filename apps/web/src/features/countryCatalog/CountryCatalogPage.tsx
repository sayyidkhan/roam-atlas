import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { worldCountries } from "@roamatlas/data/countries.js";
import {
  getCountryPack,
  initCountryPackRegistry
} from "../../data/countryPacks/index.js";
import { useApplicationStore } from "../../app/applicationStore";
import type { CountryCatalogCountry } from "./CountryCardMedia";
import { LandingVariantPreview } from "../landingVariants/LandingVariantPreview";

export function CountryCatalogPage() {
  const { dispatch } = useApplicationStore();
  const navigate = useNavigate();
  const registryQuery = useQuery({
    queryKey: ["country-packs", "registry"],
    queryFn: initCountryPackRegistry
  });

  const configure = (country: CountryCatalogCountry) => {
    dispatch({ type: "show_country_setup", countrySlug: country.slug });
    navigate(`/${country.slug}/config`);
  };

  const open = (country: CountryCatalogCountry) => {
    const registration = getCountryPack(country.slug)?.registration;
    if (
      registration !== "source_controlled" &&
      registration !== "runtime_draft"
    ) {
      configure(country);
      return;
    }
    dispatch({ type: "show_explorer", countrySlug: country.slug });
    navigate(`/${country.slug}`);
  };

  return (
    <LandingVariantPreview
      countries={worldCountries}
      countryPacks={
        registryQuery.data as Record<
          string,
          { confidence?: string; registration?: string } | undefined
        > | undefined ?? {}
      }
      onConfigure={configure}
      onOpen={open}
    />
  );
}
