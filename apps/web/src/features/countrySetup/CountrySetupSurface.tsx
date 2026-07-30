import { useStore } from "zustand";

import { CountryDraftSurface } from "../countryDraft/CountryDraftSurface";
import {
  createCountryDraftRenderState
} from "../countryDraft/countryDraftViewModel";
import { useCountryDraftState } from "../countryDraft/useCountryDraftState";
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
