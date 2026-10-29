import type { ReactNode } from "react";
import { DraftTooltip } from "../../countryDraft/CountryDraftMetadata";
import { useDraftTooltip } from "../../countryDraft/useDraftTooltip";
import styles from "../CountrySetupSurface.module.css";
import type {
  CountryRuntimeCacheState
} from "../../runtimeCache/runtimeCacheTypes";
import type {
  CountrySetupState
} from "../countrySetupStore";

export function CountrySetupActions({
  identity,
  settings,
  snapshot,
  flushState,
  canOpenMap,
  isMapLocked
}: {
  identity: ReactNode;
  settings: ReactNode;
  snapshot: CountrySetupState;
  flushState: CountryRuntimeCacheState | null;
  canOpenMap: boolean;
  isMapLocked: boolean;
}) {
  const { country } = snapshot;
  const isCacheFlushing = flushState?.status === "loading";
  const mapAction = isMapLocked
    ? {
        action: "country-map-locked",
        label: "Confirm curation first",
        shortLabel: "Confirm first",
        info:
          `Confirm the ${country.name} starter-map direction ` +
          "before opening the explorer."
      }
    : canOpenMap
    ? {
        action: "country-map",
        label: `Open ${country.name} map`,
        shortLabel: "Open map",
        info: `Explore the ${country.name} map with your current places and illustration settings.`
      }
    : {
        action: "build-starter-map",
        label: `Build ${country.name} map`,
        shortLabel: "Build map",
        info: snapshot.isSourceControlled
          ? `Load the original source-controlled ${country.name} map.`
          : `Create an unconfirmed starter map for ${country.name}.`
      };

  return (
    <nav className={styles["brand-bar"]} aria-label="Atlas navigation">
      <button
        type="button"
        className={`ghost-button ${styles.back}`}
        aria-label="Back to countries"
        onClick={snapshot.commands.backToCountries}
      >
        <span aria-hidden="true">←</span>
        <span className={styles["back-label"]} aria-hidden="true">Countries</span>
      </button>
      {identity}
      {settings}
      <CountryActionButton
        action="reset-generated-visuals"
        label={isCacheFlushing ? "Resetting visuals" : "Reset Generated Visuals"}
        shortLabel={isCacheFlushing ? "Resetting…" : "Reset visuals"}
        info={`Remove generated illustrations and ambience for ${country.name} to start fresh. Your places, descriptions, and reference photos stay.`}
        disabled={isCacheFlushing}
        onClick={snapshot.commands.resetGeneratedVisuals}
      />
      <CountryActionButton
        {...mapAction}
        disabled={isMapLocked}
        onClick={snapshot.commands.openOrBuildMap}
      />
    </nav>
  );
}

function CountryActionButton({
  action,
  label,
  shortLabel,
  info,
  disabled = false,
  onClick
}: {
  action: string;
  label: string;
  shortLabel: string;
  info: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const help = useDraftTooltip();
  return (
    <button
      {...help.triggerProps}
      type="button"
      className={`ghost-button country-action-button ${styles["header-action"]} ${help.className}`}
      data-country-action={action}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {action === "reset-generated-visuals" ? <svg className={styles["reset-icon"]} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="M4 6a7 7 0 1 1-1 7M4 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg> : null}
      <span className={styles["action-full-label"]} aria-hidden="true">{label}</span>
      <span className={styles["action-short-label"]} aria-hidden="true">{shortLabel}</span>
      {action === "country-map" || action === "build-starter-map" ? <span aria-hidden="true">↗</span> : null}
      <DraftTooltip id={help.id} title={label} copy={info} />
    </button>
  );
}
