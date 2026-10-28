import { useStore } from "zustand";
import { AtlasMark } from "../landingVariants/AtlasMark";
import styles from "./CountrySetupSurface.module.css";

import { CountryDraftSurface } from "../countryDraft/CountryDraftSurface";
import {
  createCountryDraftRenderState
} from "../countryDraft/countryDraftViewModel";
import { useCountryDraftState } from "../countryDraft/useCountryDraftState";
import { useCountryArtworkQualityLock } from "../artwork/useCountryArtworkQualityLock";
import { CacheFlushNotice } from "./components/CacheFlushNotice";
import { CountrySetupActions } from "./components/CountrySetupActions";
import { CountrySetupHeader } from "./components/CountrySetupHeader";
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
    <article className={`country-shell-panel country-setup-theme ${styles.surface}`}>
      <div className={styles.workspace}>
        <CacheFlushNotice state={flushState} />
        <section className={styles["atlas-panel"]} aria-label="Atlas contents">
          <div
            className={`setup-map-content ${styles.contents}`}
            role="region"
            aria-label="Scrollable atlas contents"
            tabIndex={0}
          >
            <CountryDraftSurface
              compact
              key={`draft:${snapshot.country.slug}`}
              buildPhotoUrl={snapshot.buildDraftPhotoUrl}
              commands={snapshot.draftCommands}
              countryName={snapshot.country.name}
              countrySlug={snapshot.country.slug}
              draft={draft}
              isSourceControlled={snapshot.isSourceControlled}
              renderHeader={(review) => (
                <CountrySetupHeader
                  snapshot={snapshot}
                  lockState={artworkQualityLock}
                  review={review}
                  actions={(identity, settings) => (
                    <CountrySetupActions
                      identity={identity}
                      settings={settings}
                      snapshot={snapshot}
                      flushState={flushState}
                      canOpenMap={canOpenMap}
                      isMapLocked={isMapLocked}
                    />
                  )}
                />
              )}
            />
          </div>
        </section>
      </div>
      <footer className={styles.footer}>
        <p className={styles["fact-note"]}>
          AI illustrates the atlas. Sources ground the facts.
        </p>
        <a href="/" className={styles["footer-brand"]} aria-label="RoamAtlas home">
          <AtlasMark /><span>roam<span>atlas</span></span>
        </a>
      </footer>
    </article>
  );
}
