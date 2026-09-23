import { useState } from "react";

import type {
  CountrySetupState
} from "../countrySetupStore";

export function CountrySetupHero({
  snapshot,
  canOpenMap,
  isMapLocked
}: {
  snapshot: CountrySetupState;
  canOpenMap: boolean;
  isMapLocked: boolean;
}) {
  const [isActionGuideOpen, setActionGuideOpen] =
    useState(false);
  const { country } = snapshot;

  return (
    <header className="country-config-hero">
      <div>
        <p className="eyebrow">{country.code} country config</p>
        <h1>{country.name}</h1>
        <p>
          Manage {country.name} generated map data and starter
          information before opening the explorer.
        </p>
      </div>
      <CountryActionGuide
        snapshot={snapshot}
        canOpenMap={canOpenMap}
        isMapLocked={isMapLocked}
        isOpen={isActionGuideOpen}
        onToggle={() =>
          setActionGuideOpen((isOpen) => !isOpen)
        }
      />
    </header>
  );
}

function CountryActionGuide({
  snapshot,
  canOpenMap,
  isMapLocked,
  isOpen,
  onToggle
}: {
  snapshot: CountrySetupState;
  canOpenMap: boolean;
  isMapLocked: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { country } = snapshot;
  const mapLabel = isMapLocked
    ? `Confirm ${country.name} curation`
    : canOpenMap
    ? `Open ${country.name} map`
    : `Build ${country.name} map`;
  const mapDescription = isMapLocked
    ? "Confirm the starter-map direction for curation before opening the explorer."
    : canOpenMap
    ? `Enter the current ${country.name} explorer using the available starter or curated map data.`
    : snapshot.isSourceControlled
      ? `Load the original source-controlled ${country.name} map before opening the explorer.`
      : `Create an unconfirmed starter map for ${country.name} before opening the explorer.`;

  return (
    <div className="country-action-guide">
      <button
        type="button"
        className="ghost-button country-action-guide-button"
        data-country-action="toggle-action-guide"
        aria-expanded={isOpen}
        aria-controls="country-action-legend"
        onClick={onToggle}
      >
        Action guide
      </button>
      {isOpen ? (
        <section
          className="country-action-legend"
          id="country-action-legend"
          aria-label="Country action legend"
        >
          <p className="eyebrow">Action guide</p>
          <dl>
            <div>
              <dt>Back to countries</dt>
              <dd>
                Return to the full country picker without changing
                this starter map.
              </dd>
            </div>
            <div>
              <dt>Reset Generated Visuals</dt>
              <dd>
                Clear cached map illustrations, image jobs, ambience,
                and AI click-understanding cache for {country.name}.
                Starter-map builder information and reference photos
                stay.
              </dd>
            </div>
            <div>
              <dt>{mapLabel}</dt>
              <dd>{mapDescription}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
