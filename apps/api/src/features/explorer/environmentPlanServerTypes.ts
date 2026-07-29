export type BoundsInput = {
  height?: unknown;
  width?: unknown;
  x?: unknown;
  y?: unknown;
};

export type EnvironmentNode = {
  childIds?: string[];
  id: string;
  title?: string;
};

export type EnvironmentScene = {
  hotspots?: Array<{
    mapNumber?: unknown;
    nodeId?: string | null;
  }>;
  rootNodeId?: string;
};

export type EnvironmentPack = {
  nodes: Record<string, EnvironmentNode | undefined>;
  scenes?: Record<string, EnvironmentScene | undefined>;
  title: string;
};

export type EnvironmentPage = {
  id?: string;
  imageUrl?: string | null;
  nodeId?: string | null;
  pageType?: string;
  plan?: {
    pageType?: string;
    title?: string;
  } | null;
  sceneId?: string | null;
  title?: string;
};

export type RawEnvironmentTarget = {
  confidence?: unknown;
  labelBounds?: BoundsInput | null;
  nodeId?: unknown;
  reason?: unknown;
  visualBounds?: BoundsInput | null;
};

export type RawEnvironmentLayer = {
  avoid?: unknown;
  bounds?: BoundsInput | null;
  id?: unknown;
  intensity?: unknown;
  kind?: unknown;
  reason?: unknown;
  safePlacement?: unknown;
};

export type RawEnvironmentPlan = {
  layers?: RawEnvironmentLayer[] | null;
  targets?: RawEnvironmentTarget[] | null;
  warnings?: unknown;
};

export type EnvironmentTargetPlan = {
  targets?: unknown;
};

export type TargetCandidate = {
  mapNumber: unknown;
  nodeId: string;
  title?: string;
};

export type PlanMetadata = {
  model: string | null;
  source: string;
};

export type EnvelopeOptions = PlanMetadata & {
  layers: unknown[];
  status: "fallback" | "ready";
  targets?: unknown[];
  warnings: string[];
};

export type EnvironmentPlanServerPolicyDependencies = {
  getCountryPackForPage: (
    page: EnvironmentPage
  ) => EnvironmentPack;
  getRuntimeCountrySlugForPage: (
    page: EnvironmentPage
  ) => string;
};
