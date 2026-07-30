import {
  useCallback,
  useState,
  useSyncExternalStore
} from "react";
import { useStore } from "zustand";
import { CountryDraftSurface } from "../countryDraft/CountryDraftSurface";
import {
  createCountryDraftRenderState
} from "../countryDraft/countryDraftViewModel";
import { useCountryDraftState } from "../countryDraft/useCountryDraftState";

import {
  countrySetupStore,
  type CountrySetupState,
  type ImageQualityOption
} from "./countrySetupStore";
import type {
  CountryRuntimeCacheStore
} from "../runtimeCache/countryRuntimeCacheStore";
import type {
  CountryRuntimeCacheState
} from "../runtimeCache/runtimeCacheTypes";

export function CountrySetupSurface() {
  const snapshot = useStore(
    countrySetupStore,
    (state) => state.setup
  );
  if (!snapshot) return null;

  return <CountrySetupContent snapshot={snapshot} />;
}

function CountrySetupContent({
  snapshot
}: {
  snapshot: CountrySetupState;
}) {
  const flushState = useCountryRuntimeCacheState(
    snapshot.runtimeCacheStore,
    snapshot.country.slug
  );
  const draftState = useCountryDraftState(
    snapshot.draftStore,
    snapshot.country.slug
  );
  const draft = createCountryDraftRenderState(draftState);

  return (
    <article className="country-shell-panel">
      <CountrySetupHero
        key={`hero:${snapshot.country.slug}`}
        snapshot={snapshot}
      />
      <CountrySetupActions
        snapshot={snapshot}
        flushState={flushState}
      />
      <ImageQualitySetting
        selectedValue={snapshot.imageQuality}
        options={snapshot.imageQualityOptions}
        onChange={snapshot.commands.setImageQuality}
      />
      <CacheFlushNotice state={flushState} />
      <CountryDraftSurface
        key={`draft:${snapshot.country.slug}`}
        buildPhotoUrl={snapshot.buildDraftPhotoUrl}
        commands={snapshot.draftCommands}
        countryName={snapshot.country.name}
        countrySlug={snapshot.country.slug}
        draft={draft}
        isSourceControlled={snapshot.isSourceControlled}
      />
    </article>
  );
}

function CountrySetupHero({
  snapshot
}: {
  snapshot: CountrySetupState;
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
      <ActionGuide
        snapshot={snapshot}
        isOpen={isActionGuideOpen}
        onToggle={() =>
          setActionGuideOpen((isOpen) => !isOpen)
        }
      />
    </header>
  );
}

function CountrySetupActions({
  snapshot,
  flushState
}: {
  snapshot: CountrySetupState;
  flushState: CountryRuntimeCacheState | null;
}) {
  const { canOpenMap, country } = snapshot;
  const isCacheFlushing = flushState?.status === "loading";
  const mapAction = canOpenMap
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
      <ActionButton
        action="countries"
        label="Back to countries"
        info="Return to the full country list."
        onClick={snapshot.commands.backToCountries}
      />
      <ActionButton
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
      <ActionButton
        {...mapAction}
        onClick={snapshot.commands.openOrBuildMap}
      />
    </section>
  );
}

function ActionButton({
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

function ImageQualitySetting({
  selectedValue,
  options,
  onChange
}: {
  selectedValue: string;
  options: readonly ImageQualityOption[];
  onChange: (value: string) => void;
}) {
  return (
    <section
      className="country-image-quality"
      aria-labelledby="image-quality-title"
    >
      <div className="country-image-quality-copy">
        <p className="eyebrow">Illustration quality</p>
        <h2 id="image-quality-title">Generated image detail</h2>
        <p>
          Choose the quality for new and regenerated map
          illustrations. High is recommended for the clearest atlas
          artwork.
        </p>
      </div>
      <div
        className="image-quality-options"
        role="radiogroup"
        aria-label="Generated image quality"
      >
        {options.map((option) => {
          const isActive = selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`image-quality-option${isActive ? " is-active" : ""}`}
              data-country-action="set-image-quality"
              data-image-quality={option.value}
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.value)}
            >
              <span className="image-quality-option-title">
                {option.label}
                {option.recommended ? (
                  <span className="image-quality-recommended">
                    Recommended
                  </span>
                ) : null}
              </span>
              <small>{option.description}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActionGuide({
  snapshot,
  isOpen,
  onToggle
}: {
  snapshot: CountrySetupState;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { canOpenMap, country } = snapshot;
  const mapLabel = canOpenMap
    ? `Open ${country.name} map`
    : `Build ${country.name} map`;
  const mapDescription = canOpenMap
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

function CacheFlushNotice({
  state
}: {
  state: CountryRuntimeCacheState | null;
}) {
  if (
    !state ||
    !["loading", "failed"].includes(state.status)
  ) {
    return null;
  }
  const visualsOnly = state.scope === "visuals";
  const title =
    state.status === "failed"
      ? visualsOnly
        ? "Visual reset failed"
        : "Runtime reset failed"
      : visualsOnly
        ? "Resetting generated visuals"
        : "Resetting runtime artifacts";
  const message =
    state.message ??
    (visualsOnly
      ? "Clearing generated images and visual cache."
      : "Clearing generated runtime artifacts.");

  return (
    <section
      className={
        state.status === "failed"
          ? "cache-flush-notice cache-flush-notice--failed"
          : "cache-flush-notice"
      }
      aria-live="polite"
    >
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  );
}

function useCountryRuntimeCacheState(
  store: CountryRuntimeCacheStore,
  countrySlug: string
): CountryRuntimeCacheState | null {
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(countrySlug, listener),
    [countrySlug, store]
  );
  const getSnapshot = useCallback(
    () => store.getSnapshot(countrySlug),
    [countrySlug, store]
  );
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null
  );
}
