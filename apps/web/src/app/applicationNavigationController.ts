import { hasUnconfirmedNodeFacts } from "@roamatlas/domain/guardrails.js";
import {
  canonicalRouteForNode,
  findSceneIdForNode,
  routeForCountryConfig,
  routeForCountryLanding
} from "@roamatlas/domain/routes.js";

import {
  createRootPage,
  type RuntimePack
} from "./browserRuntime";
import {
  activateCountryLanding,
  activateCountryShell,
  activateCuratedPlace,
  activateMappedCountry
} from "./applicationNavigationState";
import type {
  ApplicationState,
  CountryShellNavigationOptions,
  CountrySummary,
  CuratedPlaceRoute,
  NavigationOptions
} from "./applicationRuntimeTypes";

type ApplicationNavigationDependencies = {
  cancelPendingNavigation: () => void;
  clearPendingJob: () => void;
  invalidatePrefetchState: () => void;
  loadStoredCountryDraft: (country: CountrySummary) => unknown;
  render: () => void;
  setBrowserPath: (
    path: string,
    options?: { replace?: boolean }
  ) => void;
  state: ApplicationState;
};

export function createApplicationNavigationController(
  dependencies: ApplicationNavigationDependencies
) {
  const {
    cancelPendingNavigation,
    clearPendingJob,
    invalidatePrefetchState,
    loadStoredCountryDraft,
    render,
    setBrowserPath,
    state
  } = dependencies;

  function enterMappedCountry(
    pack: RuntimePack | null,
    {
      updateUrl = true,
      shouldRender = true
    }: NavigationOptions = {}
  ): void {
    if (!pack) return;
    clearPendingJob();
    cancelPendingNavigation();
    invalidatePrefetchState();
    activateMappedCountry(state, pack, createRootPage(pack));
    if (updateUrl) setBrowserPath(`/${pack.countrySlug}`);
    if (shouldRender) render();
  }

  function enterCountryShell(
    country: CountrySummary,
    {
      updateUrl = true,
      shouldRender = true,
      replaceUrl = false
    }: CountryShellNavigationOptions = {}
  ): void {
    clearPendingJob();
    cancelPendingNavigation();
    invalidatePrefetchState();
    activateCountryShell(state, country);
    if (updateUrl) {
      setBrowserPath(routeForCountryConfig(country), {
        replace: replaceUrl
      });
    }
    if (shouldRender) render();
    void loadStoredCountryDraft(country);
  }

  function enterCuratedPlace(
    {
      countrySlug,
      nodeId,
      pack
    }: CuratedPlaceRoute,
    {
      updateUrl = true,
      shouldRender = true
    }: NavigationOptions = {}
  ): void {
    cancelPendingNavigation();
    invalidatePrefetchState();
    const activated = activateCuratedPlace(
      state,
      { countrySlug, nodeId, pack },
      { findSceneIdForNode, hasUnconfirmedNodeFacts }
    );
    if (!activated) {
      enterMappedCountry(pack, {
        updateUrl: false,
        shouldRender: false
      });
      setUnknownNodeNotice(nodeId, pack);
      if (shouldRender) render();
      return;
    }
    if (updateUrl) {
      setBrowserPath(
        canonicalRouteForNode(countrySlug, nodeId, pack)
      );
    }
    if (shouldRender) render();
  }

  function enterCountryLanding(
    {
      updateUrl = true,
      shouldRender = true
    }: NavigationOptions = {}
  ): void {
    clearPendingJob();
    cancelPendingNavigation();
    invalidatePrefetchState();
    activateCountryLanding(state);
    if (updateUrl) {
      setBrowserPath(routeForCountryLanding());
    }
    if (shouldRender) render();
  }

  function setUnknownNodeNotice(
    nodeId: string,
    pack: RuntimePack
  ): void {
    state.routeNotice = {
      confidence: "unconfirmed",
      title: "Unknown RoamAtlas node",
      message:
        `${nodeId} is not mapped in RoamAtlas' verified ` +
        `${pack.title} graph.`
    };
  }

  return {
    enterCountryLanding,
    enterCountryShell,
    enterCuratedPlace,
    enterMappedCountry,
    setUnknownNodeNotice
  };
}
