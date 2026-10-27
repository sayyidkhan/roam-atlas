import type { ReactNode } from "react";
import { countryPhotoUrl } from "../../landingVariants/cinematic/cinematicCountryPresentation";
import type { CountrySetupState } from "../countrySetupStore";

export function CountrySetupHero({ snapshot, children }: { snapshot: CountrySetupState; children?: ReactNode }) {
  const { country } = snapshot;

  return (
    <header className="country-config-hero">
      <img className="setup-country-photo" src={countryPhotoUrl(country.slug)} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
      <div className="setup-country-heading">
        <div className="setup-country-title">
          <h1>{country.name}</h1>
          <span className="setup-country-code">{country.code}</span>
        </div>
        {children}
      </div>
    </header>
  );
}
