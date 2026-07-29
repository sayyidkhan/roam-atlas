import type {
  AppRoute,
  CountryShellNavigationOptions,
  CountrySummary,
  CuratedPlaceRoute,
  NavigationOptions
} from "./applicationRuntimeTypes";
import type { RuntimePack } from "./browserRuntime";

type RouteControllerDependencies = {
  countries: CountrySummary[];
  countryPacks: Record<string, RuntimePack>;
  ensureCountryPack: (
    countrySlug: string
  ) => Promise<RuntimePack | null>;
  enterCountryLanding: (options?: NavigationOptions) => void;
  enterCountryShell: (
    country: CountrySummary,
    options?: CountryShellNavigationOptions
  ) => void;
  enterCuratedPlace: (
    route: CuratedPlaceRoute,
    options?: NavigationOptions
  ) => void;
  enterMappedCountry: (
    pack: RuntimePack | null,
    options?: NavigationOptions
  ) => void;
  render: () => void;
  isRouteCurrent: () => boolean;
  resolveRoute: (
    pathname: string,
    options: {
      countries: CountrySummary[];
      countryPacks: Record<string, RuntimePack>;
    }
  ) => AppRoute;
  setUnknownNodeNotice: (route: {
    nodeId: string;
    pack: RuntimePack;
  }) => void;
};

export async function applyApplicationRoute(
  pathname: string,
  {
    shouldRender = true
  }: Pick<NavigationOptions, "shouldRender">,
  dependencies: RouteControllerDependencies
): Promise<void> {
  const {
    countries,
    countryPacks,
    ensureCountryPack,
    enterCountryLanding,
    enterCountryShell,
    enterCuratedPlace,
    enterMappedCountry,
    isRouteCurrent,
    render,
    resolveRoute,
    setUnknownNodeNotice
  } = dependencies;
  let route = resolveRoute(pathname, { countries, countryPacks });

  if (requiresCountryPack(route)) {
    const pack = await ensureCountryPack(route.countrySlug);
    if (!isRouteCurrent()) return;
    route = resolveRoute(pathname, {
      countries,
      countryPacks: pack
        ? { ...countryPacks, [route.countrySlug]: pack }
        : countryPacks
    });
  }

  if (!isRouteCurrent()) return;
  switch (route.type) {
    case "country_landing":
      enterCountryLanding({ updateUrl: false, shouldRender });
      return;
    case "country_overview":
      enterMappedCountry(route.pack, {
        updateUrl: false,
        shouldRender
      });
      return;
    case "curated_place":
      enterCuratedPlace(route, { updateUrl: false, shouldRender });
      return;
    case "invalid_place":
      enterMappedCountry(route.pack, {
        updateUrl: false,
        shouldRender: false
      });
      setUnknownNodeNotice(route);
      if (shouldRender) render();
      return;
    case "country_config":
      enterCountryShell(route.country, {
        updateUrl: false,
        shouldRender
      });
      return;
    case "country_needs_config":
      enterCountryShell(route.country, {
        updateUrl: true,
        shouldRender,
        replaceUrl: true
      });
      return;
    default:
      enterCountryLanding({
        updateUrl: true,
        shouldRender: false
      });
  }
}

function requiresCountryPack(
  route: AppRoute
): route is Extract<
  AppRoute,
  {
    type: "country_overview" | "curated_place" | "invalid_place";
  }
> {
  return (
    route.type === "country_overview" ||
    route.type === "curated_place" ||
    route.type === "invalid_place"
  );
}
