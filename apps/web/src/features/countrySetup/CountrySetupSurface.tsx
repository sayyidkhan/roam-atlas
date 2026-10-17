import { useStore } from "zustand";
import { AtlasMark } from "../landingVariants/AtlasMark";
import "./countrySetupTheme.css";

import { CountryDraftSurface } from "../countryDraft/CountryDraftSurface";
import {
  createCountryDraftRenderState
} from "../countryDraft/countryDraftViewModel";
import { useCountryDraftState } from "../countryDraft/useCountryDraftState";
import { useCountryArtworkQualityLock } from "../artwork/useCountryArtworkQualityLock";
import { CacheFlushNotice } from "./components/CacheFlushNotice";
import { CountrySetupActions } from "./components/CountrySetupActions";
import { CountrySetupHero } from "./components/CountrySetupHero";
import { ImageQualitySetting } from "./components/ImageQualitySetting";
import {
  countrySetupStore,
  type CountrySetupState
} from "./countrySetupStore";
import { useCountryRuntimeCacheState } from "./useCountryRuntimeCacheState";

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
  const artworkQualityLock = useCountryArtworkQualityLock(
    snapshot.artworkQualityLockStore,
    snapshot.country.slug
  );
  const draft = createCountryDraftRenderState(draftState);
  const isCurationConfirmed =
    snapshot.isSourceControlled ||
    (draft.status === "ready" &&
      Boolean(draft.review.confirmation));
  const canOpenMap =
    snapshot.canOpenMap && isCurationConfirmed;
  const isMapLocked =
    snapshot.canOpenMap && !isCurationConfirmed;

  return (
    <article className="country-shell-panel country-setup-theme">
      <nav className="setup-brand-bar" aria-label="Atlas navigation">
        <button type="button" className="ghost-button setup-back" onClick={snapshot.commands.backToCountries}>← Back to countries</button>
        <a href="/" className="setup-brand" aria-label="RoamAtlas home"><AtlasMark /><span>roam<span>atlas</span></span></a>
      </nav>
      <div className="setup-workspace">
      <div className="setup-country-column">
      <CountrySetupHero
        key={`hero:${snapshot.country.slug}`}
        snapshot={snapshot}
        canOpenMap={canOpenMap}
        isMapLocked={isMapLocked}
      />
      <CountrySetupActions
        snapshot={snapshot}
        flushState={flushState}
        canOpenMap={canOpenMap}
        isMapLocked={isMapLocked}
      />
      <ImageQualitySetting
        selectedValue={snapshot.imageQuality}
        options={snapshot.imageQualityOptions}
        lockState={artworkQualityLock}
        onChange={snapshot.commands.setImageQuality}
      />
      <CacheFlushNotice state={flushState} />
      </div>
      <section className="setup-atlas-column" aria-labelledby="setup-atlas-title">
        <header className="setup-atlas-heading"><p className="setup-atlas-kicker">Contents &amp; source review</p><h2 id="setup-atlas-title">Inside the atlas</h2></header>
        <div className="setup-map-content" role="region" aria-label="Scrollable atlas contents" tabIndex={0}>
      <CountryDraftSurface
        compact
        key={`draft:${snapshot.country.slug}`}
        buildPhotoUrl={snapshot.buildDraftPhotoUrl}
        commands={snapshot.draftCommands}
        countryName={snapshot.country.name}
        countrySlug={snapshot.country.slug}
        draft={draft}
        isSourceControlled={snapshot.isSourceControlled}
      />
        </div>
      </section>
      </div>
    </article>
  );
}
