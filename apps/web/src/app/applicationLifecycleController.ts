import { worldCountries } from "@roamatlas/data/countries.js";
import { resolveAppRoute } from "@roamatlas/domain/routes.js";

import {
  countryPacks,
  ensureCountryPack,
  initCountryPackRegistry
} from "../data/countryPacks/index.js";
import type { RuntimePack } from "./browserRuntime";
import { createApplicationGeneratedStateController } from "./applicationGeneratedStateController";
import { createApplicationNavigationController } from "./applicationNavigationController";
import { applyApplicationRoute } from "./applicationRouteController";
import type {
  AppRoute,
  CountrySummary,
  NavigationOptions
} from "./applicationRuntimeTypes";

type NavigationDependencies = Parameters<
  typeof createApplicationNavigationController
>[0];
type GeneratedStateDependencies = Parameters<
  typeof createApplicationGeneratedStateController
>[0];

type ApplicationLifecycleDependencies =
  NavigationDependencies &
  GeneratedStateDependencies & {
  bindPageClick: () => () => void;
  elements: {
    runtimeNotice: HTMLElement;
  };
  explainClickError: (error: unknown) => string;
  loadExperienceConfig: () => void | Promise<void>;
};

const resolveRuntimeRoute = (
  pathname: string,
  options: {
    countries: CountrySummary[];
    countryPacks: Record<string, RuntimePack>;
  }
): AppRoute =>
  resolveAppRoute<CountrySummary, RuntimePack>(
    pathname,
    options
  );

export function createApplicationLifecycleController(
  dependencies: ApplicationLifecycleDependencies
) {
  const {
    bindPageClick,
    cancelPendingNavigation,
    clearEnvironmentState,
    clearPendingJob,
    elements,
    explainClickError,
    invalidatePrefetchState,
    loadExperienceConfig,
    loadStoredCountryDraft,
    render,
    setBrowserPath,
    state,
    stopArtworkPoller
  } = dependencies;
  let unbindPageClick: (() => void) | null = null;
  let routeRequestSequence = 0;
  const navigationController =
    createApplicationNavigationController({
      cancelPendingNavigation,
      clearPendingJob,
      invalidatePrefetchState,
      loadStoredCountryDraft,
      render,
      setBrowserPath,
      state
    });
  const generatedStateController =
    createApplicationGeneratedStateController({
      cancelPendingNavigation,
      clearEnvironmentState,
      clearPendingJob,
      invalidatePrefetchState,
      state,
      stopArtworkPoller
    });
  const {
    enterCountryLanding,
    enterCountryShell,
    enterCuratedPlace,
    enterMappedCountry,
    setUnknownNodeNotice
  } = navigationController;

  async function applyRoute(
    pathname: string,
    {
      shouldRender = true
    }: Pick<NavigationOptions, "shouldRender"> = {}
  ): Promise<void> {
    const routeRequestId = ++routeRequestSequence;
    await applyApplicationRoute(
      pathname,
      { shouldRender },
      {
        countries: worldCountries,
        countryPacks:
          countryPacks as Record<string, RuntimePack>,
        ensureCountryPack,
        enterCountryLanding,
        enterCountryShell,
        enterCuratedPlace,
        enterMappedCountry,
        isRouteCurrent: () =>
          routeRequestId === routeRequestSequence,
        render,
        resolveRoute: resolveRuntimeRoute,
        setUnknownNodeNotice: (route) =>
          setUnknownNodeNotice(route.nodeId, route.pack)
      }
    );
  }

  async function bootstrap(): Promise<void> {
    unbindPageClick?.();
    unbindPageClick = bindPageClick();
    state.currentView = "countries";

    try {
      await initCountryPackRegistry();
      render();
      void loadExperienceConfig();
    } catch (error) {
      showBootstrapError(error);
      throw error;
    }
  }

  function showBootstrapError(error: unknown): void {
    elements.runtimeNotice.hidden = false;
    elements.runtimeNotice.textContent =
      explainClickError(error);
  }

  function dispose(): void {
    routeRequestSequence += 1;
    unbindPageClick?.();
    unbindPageClick = null;
  }

  return {
    ...generatedStateController,
    ...navigationController,
    applyRoute,
    bootstrap,
    dispose,
    showBootstrapError
  };
}
