import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type { AppToastOptions } from "../notifications/appToastController";
import type {
  CountryRuntimeCacheStore
} from "./countryRuntimeCacheStore";
import type {
  CountryRuntimeCacheState,
  RuntimeCacheScope
} from "./runtimeCacheTypes";
import type {
  CountryDraftStore
} from "../countryDraft/countryDraftTypes";
import type {
  PlaceImageSessionStore
} from "../placeImages/placeImageSessionStore";

type CountryRuntimeCacheControllerDependencies = {
  apiPath: (path: string) => string;
  clearCountryGeneratedState: (countrySlug: string) => void;
  draftStore: CountryDraftStore;
  errorToastDurationMs: number;
  explainError: (error: unknown) => string;
  flushCountryRuntimeCache: (input: {
    countrySlug: string;
    scope: RuntimeCacheScope;
    fetchFn: typeof fetch;
  }) => Promise<unknown>;
  placeImageSessionStore: PlaceImageSessionStore;
  runtimeCacheStore: CountryRuntimeCacheStore;
  render: () => void;
  showToast: (options: AppToastOptions) => void;
};

/**
 * Coordinates country-scoped runtime deletion and its UI state.
 *
 * It deliberately distinguishes generated visuals from full runtime
 * artifacts so resetting artwork cannot silently remove reviewed starter-map
 * information or reference photos.
 */
export function createCountryRuntimeCacheController({
  apiPath,
  clearCountryGeneratedState,
  draftStore,
  errorToastDurationMs,
  explainError,
  flushCountryRuntimeCache,
  placeImageSessionStore,
  runtimeCacheStore,
  render,
  showToast
}: CountryRuntimeCacheControllerDependencies) {
  async function flush(
    country: CountrySummary,
    {
      confirm = true,
      scope = "all"
    }: { confirm?: boolean; scope?: RuntimeCacheScope } = {}
  ): Promise<boolean> {
    const existing = runtimeCacheStore.getSnapshot(country.slug);
    if (existing?.status === "loading") return false;

    const visualsOnly = scope === "visuals";
    if (confirm && !confirmFlush(country, visualsOnly)) {
      return false;
    }

    runtimeCacheStore.set(country.slug, {
      status: "loading",
      scope,
      message: visualsOnly
        ? `Clearing generated ${country.name} map visuals.`
        : `Clearing generated ${country.name} runtime artifacts.`
    } satisfies CountryRuntimeCacheState);
    render();

    try {
      await flushCountryRuntimeCache({
        countrySlug: country.slug,
        scope,
        fetchFn: (path, options) =>
          fetch(apiPath(String(path)), options)
      });
      clearCountryGeneratedState(country.slug);
      clearFeatureState(country.slug, visualsOnly);
      runtimeCacheStore.set(country.slug, {
        status: "ready",
        scope,
        message: visualsOnly
          ? "Generated map visuals and AI click understanding were cleared. Starter-map builder information and reference photos were kept."
          : "Generated runtime artifacts were cleared. Open the map or rebuild starter info to create fresh data."
      } satisfies CountryRuntimeCacheState);
      render();
      showToast({
        title: visualsOnly
          ? "Generated visuals reset"
          : "Runtime artifacts reset",
        message: visualsOnly
          ? "Map illustrations, visual cache, and AI click understanding were cleared. Builder information and reference photos were kept."
          : "Generated runtime artifacts were cleared."
      });
      return true;
    } catch (error) {
      const message = explainError(error);
      runtimeCacheStore.set(country.slug, {
        status: "failed",
        scope,
        message
      } satisfies CountryRuntimeCacheState);
      render();
      showToast({
        title: visualsOnly
          ? "Generated visuals were not reset"
          : "Runtime artifacts were not reset",
        message: `No changes were completed. ${message}`,
        tone: "error",
        durationMs: errorToastDurationMs
      });
      return false;
    }
  }

  function clearFeatureState(
    countrySlug: string,
    visualsOnly: boolean
  ): void {
    if (visualsOnly) {
      placeImageSessionStore.clearCountryRefresh(countrySlug);
      return;
    }
    draftStore.delete(countrySlug);
  }

  function confirmFlush(
    country: CountrySummary,
    visualsOnly: boolean
  ): boolean {
    return window.confirm(
      visualsOnly
        ? `Reset generated visuals for ${country.name}? This clears generated map illustrations, image jobs, ambience, and AI click understanding. Starter-map builder information, reference photos, and review artifacts stay.`
        : `Reset all runtime artifacts for ${country.name}? This clears generated images, click data, stored starter-map artifacts, and review artifacts. Source-controlled country pack data is not changed.`
    );
  }

  return { flush };
}
