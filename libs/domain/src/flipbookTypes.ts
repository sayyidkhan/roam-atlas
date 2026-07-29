export type FlipbookPoint = {
  x: number;
  y: number;
};

export type FlipbookNode = {
  artworkCalloutLabels?: unknown;
  childIds: string[];
  facts?: Array<{
    confidence?: string;
    sourceType?: string;
    [key: string]: unknown;
  }>;
  id: string;
  tags?: string[];
  title: string;
  type?: string;
};

export type FlipbookAction =
  | { sceneId: string; type: "enter_scene" }
  | { nodeId: string; type: "open_node" }
  | { detourId: string; type: "show_detour" };

export type FlipbookShape =
  | {
      height: number;
      width: number;
      x: number;
      y: number;
    }
  | {
      points: FlipbookPoint[];
    };

export type FlipbookHotspot = {
  action: FlipbookAction;
  confidence: string;
  id: string;
  kind: string;
  label?: string;
  nodeId?: string;
  sceneId: string;
  shape: FlipbookShape;
  zIndex: number;
};

export type FlipbookScene = {
  coordinateSpace: {
    height: number;
    width: number;
  };
  hotspots?: FlipbookHotspot[];
  id: string;
  rootNodeId: string;
};

export type FlipbookPlan = {
  factMode?: string;
  nextNodeId: string | null;
  pageType?: string;
  title?: string;
  [key: string]: unknown;
};

export type FlipbookPage = {
  countryName: string;
  countrySlug: string;
  id: string;
  imageUrl: string | null;
  nodeId: string | null;
  parentClick: FlipbookPoint | null;
  parentId: string | null;
  plan: FlipbookPlan | null;
  sceneId: string | null;
  status: string;
};

export type FlipbookClick = {
  action?: FlipbookAction;
  confidence: string;
  nodeId: string | null;
  phrase: string;
  reason: string;
  resolver?: string;
  status: string;
};

export type FlipbookResult = {
  click: FlipbookClick;
  page: FlipbookPage;
};

export type ResolveFlipbookClickInput = {
  countryName?: string;
  currentPage: {
    countryName?: string;
    countrySlug?: string;
    id?: string;
    imageUrl?: string | null;
    nodeId: string | null;
    sceneId: string | null;
  };
  detourPhrase?: string | null;
  nodes: Record<string, FlipbookNode>;
  normalizedClick: FlipbookPoint;
  resolvedPhrase?: string | null;
  sceneArtwork: Record<
    string,
    { imageUrl?: string | null } | null | undefined
  >;
  scenes: Record<string, FlipbookScene>;
  targetNodeId?: string | null;
};

export type CreateFlipbookPageInput = {
  countryName?: string;
  countrySlug?: string;
  id: string;
  imageUrl?: string | null;
  nodeId: string | null;
  parentClick?: FlipbookPoint | null;
  parentId?: string | null;
  plan?: FlipbookPlan | null;
  sceneId: string | null;
  status?: string;
};
