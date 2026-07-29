import type {
  FlipbookHotspot,
  FlipbookNode,
  FlipbookScene
} from "@roamatlas/domain/flipbookPage.js";
import { APP_CONFIG } from "../config/appConfig.js";

export type RootPage = {
  id: "root";
  countrySlug: string;
  sceneId: string;
  nodeId: string;
  imageUrl: null;
  parentId: null;
  parentClick: null;
  status: "ready";
};

type RootPagePack = {
  countrySlug: string;
  overviewSceneId: string;
  rootNodeId: string;
};

export type RuntimePage = {
  id?: string;
  countrySlug?: string;
  sceneId: string | null;
  nodeId: string | null;
  imageUrl?: string | null;
  environmentUrl?: string | null;
  artworkDecoded?: boolean;
  parentId?: string | null;
  parentClick?: unknown;
  status?: string;
  plan?: {
    title?: string;
    factMode?: string;
    [key: string]: unknown;
  } | null;
};

export type RuntimeNode = FlipbookNode & {
  artworkCalloutLabels?: string[];
  parentId?: string | null;
  tags?: string[];
};

export type RuntimeHotspot = FlipbookHotspot & {
  anchorNumber?: string | number;
  displayNumber?: string | number;
  mapNumber?: string | number;
};

export type RuntimeScene = Omit<
  FlipbookScene,
  "hotspots"
> & {
  ambientLayers?: unknown[];
  hotspots?: RuntimeHotspot[];
  pageType?: string;
  tiles: Array<{
    bounds: {
      height: number;
      width: number;
      x: number;
      y: number;
    };
    cacheKey: string;
    column: number;
    id: string;
  }>;
  title: string;
};

export type RuntimePack = {
  countrySlug: string;
  overviewSceneId: string;
  rootNodeId: string;
  title: string;
  nodes: Record<string, RuntimeNode>;
  scenes: Record<string, RuntimeScene>;
};

export function apiPath(path: string): string {
  if (!window.location.origin.startsWith("http")) {
    throw new Error("RoamAtlas must be opened through the dev server, not as a local file.");
  }
  return path;
}

export function toApiUrl(path: string): string {
  if (String(path).startsWith("http")) return path;
  return apiPath(String(path).replace(/^\.\//, "/"));
}

export function fetchArtworkResource(
  resource: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  const timeoutMs = APP_CONFIG.artwork.requestTimeoutMs;
  const timeoutSignal = typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(timeoutMs)
    : createTimeoutAbortSignal(timeoutMs);
  const signal = options.signal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([options.signal, timeoutSignal])
    : options.signal ?? timeoutSignal;
  return fetch(resource, { ...options, signal });
}

export function createRootPage(pack: RootPagePack): RootPage {
  return {
    id: "root",
    countrySlug: pack.countrySlug,
    sceneId: pack.overviewSceneId,
    nodeId: pack.rootNodeId,
    imageUrl: null,
    parentId: null,
    parentClick: null,
    status: "ready"
  };
}

export function setBrowserPath(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (window.location.pathname === path) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function createTimeoutAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(new Error("Artwork request timed out.")), timeoutMs);
  return controller.signal;
}
