import type {
  RuntimePack,
  RuntimePage
} from "./browserRuntime";
import type {
  ExplorerControllerState
} from "../features/explorer/explorerController";
import type {
  PreloadedImageSize
} from "../features/explorer/explorerImagePreloader";
import type {
  BrowserExperienceConfig
} from "../features/experience/experienceConfigClient";
import type {
  ArtworkJob as PrefetchArtworkJob
} from "../features/artwork/artworkPrefetchTypes";

export type CountrySummary = {
  code: string;
  name: string;
  slug: string;
  [key: string]: unknown;
};

export type RouteNotice = {
  confidence: string;
  title: string;
  message: string;
};

export type ApplicationState = ExplorerControllerState & {
  artworkImageLoads: Map<
    string,
    Promise<PreloadedImageSize>
  >;
  experienceConfig:
    ExplorerControllerState["experienceConfig"] &
    Partial<BrowserExperienceConfig> & {
      loadNextDestinationsEarly: boolean;
      maxParallelImageJobs: number;
      showLoadingSteps: boolean;
    };
  history: Array<{
    page: RuntimePage | null;
    nodeId: string | null;
  }>;
  pendingJob: {
    intervalId?: number;
  } | null;
  selectedCountry: CountrySummary | null;
  prefetchRequests: Set<string>;
  prefetchJobs: Map<string, PrefetchArtworkJob>;
  prefetchSceneId: string | null;
  routeNotice: RouteNotice | null;
};

export type AppRoute =
  | { type: "country_landing" }
  | { type: "country_overview"; countrySlug: string; country: CountrySummary; pack: RuntimePack }
  | { type: "curated_place"; countrySlug: string; nodeId: string; pack: RuntimePack }
  | { type: "invalid_place"; countrySlug: string; nodeId: string; pack: RuntimePack }
  | { type: "country_unmapped_place"; countrySlug: string; nodeId: string }
  | { type: "country_config"; countrySlug: string; country: CountrySummary; pack: RuntimePack | null }
  | { type: "country_needs_config"; countrySlug: string; country: CountrySummary }
  | { type: "unknown_country"; slug: string };

export type NavigationOptions = {
  updateUrl?: boolean;
  shouldRender?: boolean;
};

export type CountryShellNavigationOptions = NavigationOptions & {
  replaceUrl?: boolean;
};

export type CuratedPlaceRoute = {
  countrySlug: string;
  nodeId: string;
  pack: RuntimePack;
};

export type RuntimeHistoryEntry = {
  page: RuntimePage;
  nodeId: string | null;
};
