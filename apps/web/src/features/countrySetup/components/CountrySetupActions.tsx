import type {
  CountryRuntimeCacheState
} from "../../runtimeCache/runtimeCacheTypes";
import type {
  CountrySetupState
} from "../countrySetupStore";

export function CountrySetupActions({
  snapshot,
  flushState,
  canOpenMap,
  isMapLocked
}: {
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
        info:
          `Confirm the ${country.name} starter-map direction ` +
          "before opening the explorer."
      }
    : canOpenMap
    ? {
        action: "country-map",
        label: `Open ${country.name} map`,
        info: `Open the current ${country.name} explorer.`
      }
    : {
        action: "build-starter-map",
        label: `Build ${country.name} map`,
        info: snapshot.isSourceControlled
          ? `Load the original source-controlled ${country.name} map.`
          : `Create an unconfirmed starter map for ${country.name}.`
      };

  return (
    <section
      className="country-shell-actions"
      aria-label="Manual country actions"
    >
      <CountryActionButton
        action="countries"
        label="Back to countries"
        info="Return to the full country list."
        onClick={snapshot.commands.backToCountries}
      />
      <CountryActionButton
        action="reset-generated-visuals"
        label={
          isCacheFlushing
            ? "Resetting visuals"
            : "Reset Generated Visuals"
        }
        info={`Delete generated ${country.name} map illustrations, image jobs, ambience, and AI click-understanding cache. Starter-map builder information and reference photos stay.`}
        disabled={isCacheFlushing}
        onClick={snapshot.commands.resetGeneratedVisuals}
      />
      <CountryActionButton
        {...mapAction}
        disabled={isMapLocked}
        onClick={snapshot.commands.openOrBuildMap}
      />
    </section>
  );
}

function CountryActionButton({
  action,
  label,
  info,
  disabled = false,
  onClick
}: {
  action: string;
  label: string;
  info: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ghost-button country-action-button"
      data-country-action={action}
      title={info}
      aria-label={`${label}. ${info}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
    </button>
  );
}
