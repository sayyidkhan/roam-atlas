import type {
  FlipbookAction,
  FlipbookNode,
  FlipbookScene,
  FlipbookShape
} from "@roamatlas/domain/flipbookPage.js";

export type JsonRecord = Record<string, unknown>;

export type WorldCountry = {
  code: string;
  name: string;
  slug: string;
};

export type CountryPackVersions = {
  data?: string;
  prompt?: string;
  style?: string;
};

export type CountryPackTileDefaults = {
  imageModel?: unknown;
  overlapPx?: number;
  tileHeight?: number;
  tileWidth?: number;
};

export type CountryPackNode = JsonRecord & {
  childIds?: string[];
  facts?: FlipbookNode["facts"];
  id: string;
  tags?: string[];
  title: string;
  type?: string;
};

export type RatioOrPixelBounds = {
  height: number;
  unit?: string;
  width: number;
  x: number;
  y: number;
};

export type CountryPackHotspot = JsonRecord & {
  action?: FlipbookAction;
  confidence: string;
  id: string;
  kind: string;
  label?: string;
  nodeId?: string;
  shape: FlipbookShape;
  zIndex: number;
};

export type CountryPackAmbientLayer = JsonRecord & {
  bounds?: RatioOrPixelBounds;
  id: string;
};

export type CountryPackCameraPreset = JsonRecord & {
  targetBounds?: RatioOrPixelBounds;
};

export type CountryPackScene = JsonRecord & {
  ambientLayers?: CountryPackAmbientLayer[];
  artworkVisualContext?: string;
  cameraPresets?: CountryPackCameraPreset[];
  columns?: number;
  continuityPromptTemplate?: string;
  density?: string;
  hotspots?: CountryPackHotspot[];
  id?: string;
  imageModel?: unknown;
  knownChildNodeTitles?: string[];
  pageType?: string;
  rootNodeId: string;
  rows?: number;
  tileGrid?: {
    columns?: number;
    overlapPx?: number;
    rows?: number;
    tileHeight?: number;
    tileWidth?: number;
  };
  tileStatus?: string;
  title: string;
  visualContext: string;
  zoomLevel?: number;
};

export type CountryPackSource = {
  confidence: string;
  countryCode: string;
  countrySlug: string;
  factBoundary?: string;
  nodes?: Record<string, CountryPackNode>;
  overviewSceneId: string;
  registration?: string;
  rootNodeId: string;
  scenes?: Record<string, CountryPackScene>;
  sourceRegistry?: Record<string, JsonRecord>;
  tileDefaults?: CountryPackTileDefaults;
  title: string;
  versions?: CountryPackVersions;
};

export type CompiledCountryPackNode =
  FlipbookNode & JsonRecord;

export type CompiledCountryPackScene = Omit<
  FlipbookScene,
  "coordinateSpace"
> &
  JsonRecord & {
    ambientLayers: JsonRecord[];
    artworkVisualContext?: string;
    cameraPresets: JsonRecord[];
    coordinateSpace: {
      height: number;
      unit: "virtual_px";
      width: number;
    };
    dataVersion: string;
    pageType?: string;
    styleVersion: string;
    tiles: JsonRecord[];
    title: string;
    visualContext: string;
  };

export type CompiledCountryPack = {
  confidence: string;
  countryCode: string;
  countrySlug: string;
  factBoundary?: string;
  nodes: Record<string, CompiledCountryPackNode>;
  overviewSceneId: string;
  registration: string;
  rootNodeId: string;
  scenes: Record<string, CompiledCountryPackScene>;
  sourceRegistry: Record<string, JsonRecord>;
  title: string;
  versions: CountryPackVersions;
};
