import { useStore } from "zustand";

import { ExplorerDetailSheet } from "./ExplorerDetailSheet";
import {
  ExplorerRegionRail
} from "./ExplorerDestinationNavigation";
import { ExplorerSceneStage } from "./ExplorerSceneStage";
import { ExplorerNavigationFeedback } from "./ExplorerNavigationFeedback";
import { explorerChromeStore } from "./explorerChromeStore";

export function ExplorerViewport() {
  const snapshot = useStore(
    explorerChromeStore,
    (state) => state.snapshot
  );

  return (
    <section
      className={[
        "scroll-viewport",
        snapshot?.isVisible ? "" : "is-hidden",
        snapshot?.isBusy ? "is-busy" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      id="scroll-viewport"
      aria-label="RoamAtlas visual explorer"
    >
      <header className="scene-hud">
        <div>
          <p className="eyebrow">RoamAtlas</p>
          <h1>{snapshot?.title ?? "Country Overview Scroll"}</h1>
          <p>
            {snapshot?.breadcrumb ??
              "Curated facts. Generated-style visuals."}
          </p>
        </div>
      </header>

      <div className="corner-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={snapshot?.commands.countries}
        >
          Countries
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={snapshot?.backDisabled ?? true}
          onClick={snapshot?.commands.back}
        >
          Back
        </button>
      </div>

      <ExplorerSceneStage />
      <ExplorerRegionRail />
      <ExplorerDetailSheet />
      <ExplorerNavigationFeedback />
    </section>
  );
}
