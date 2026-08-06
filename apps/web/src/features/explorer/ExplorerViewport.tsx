import { useStore } from "zustand";

import { ExplorerDetailSheet } from "./ExplorerDetailSheet";
import { ExplorerCompactDetailActions } from "./ExplorerCompactDetailActions";
import { ExplorerBreadcrumbTrail } from "./ExplorerBreadcrumbTrail";
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
        <nav
          className="hud-actions"
          aria-label="Explorer navigation"
        >
          <button
            type="button"
            className="ghost-button explorer-header-action"
            disabled={snapshot?.backDisabled ?? true}
            onClick={snapshot?.commands.back}
          >
            <BackIcon />
            <span>Back</span>
          </button>
          <button
            type="button"
            className="ghost-button explorer-header-action"
            onClick={snapshot?.commands.countries}
          >
            <CountriesIcon />
            <span>Countries</span>
          </button>
        </nav>

        <div
          className="scene-hud-info"
          aria-label="Current explorer location"
        >
          <div className="scene-hud-copy">
            <ExplorerBreadcrumbTrail
              currentLabel={
                snapshot?.title ?? "Country Overview Scroll"
              }
              items={snapshot?.breadcrumbs ?? []}
              onSelect={
                snapshot?.commands.openBreadcrumb ?? (() => {})
              }
            />
          </div>
          <ExplorerCompactDetailActions />
        </div>
      </header>

      <ExplorerSceneStage />
      <ExplorerRegionRail />
      <ExplorerDetailSheet />
      <ExplorerNavigationFeedback />
    </section>
  );
}

function BackIcon() {
  return (
    <svg
      className="explorer-header-action-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.75 4.75 6.5 10l5.25 5.25" />
      <path d="M7 10h7" />
    </svg>
  );
}

function CountriesIcon() {
  return (
    <svg
      className="explorer-header-action-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="4" height="4" rx="0.75" />
      <rect x="12" y="4" width="4" height="4" rx="0.75" />
      <rect x="4" y="12" width="4" height="4" rx="0.75" />
      <rect x="12" y="12" width="4" height="4" rx="0.75" />
    </svg>
  );
}
