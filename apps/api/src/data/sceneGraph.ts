import {
  DEFAULT_COUNTRY_SLUG,
  getCountryPack
} from "./countryPacks/serverRegistry.ts";

const defaultPack = getCountryPack(
  DEFAULT_COUNTRY_SLUG
);

if (!defaultPack) {
  throw new Error(
    "A default country pack is required for legacy scene graph exports."
  );
}

const overviewScene =
  defaultPack.scenes[
    defaultPack.overviewSceneId
  ];

export const DATA_VERSION =
  overviewScene?.dataVersion ?? "data-v1";
export const STYLE_VERSION =
  overviewScene?.styleVersion ??
  "atlas-qingming-v1";
export const PROMPT_VERSION =
  defaultPack.versions?.prompt ?? "prompt-v1";

export const sourceRegistry =
  defaultPack.sourceRegistry;
export const atlasNodes = defaultPack.nodes;
export const scrollScenes = defaultPack.scenes;

export type InitialSavedState = {
  createdAt: string;
  savedNodeIds: string[];
};

export function createInitialSavedState(
  savedNodeIds: string[] = []
): InitialSavedState {
  return {
    savedNodeIds: [...new Set(savedNodeIds)],
    createdAt: new Date().toISOString()
  };
}

export function searchKnownNode(
  query: unknown
):
  | {
      nodeId: null;
      reason: string;
      status: "unmapped";
    }
  | {
      nodeId: string;
      reason: string;
      status: "matched";
    } {
  const normalized = normalize(query);
  const match = Object.values(
    atlasNodes
  ).find(
    (node) =>
      normalize(node.title) === normalized ||
      node.id === normalized
  );

  if (!match) {
    return {
      status: "unmapped",
      nodeId: null,
      reason:
        "No curated RoamAtlas node matched this search."
    };
  }

  return {
    status: "matched",
    nodeId: match.id,
    reason:
      "Matched against curated RoamAtlas node ids and titles."
  };
}

export function findAnimalExhibitClaim(
  nodeId: string
):
  | {
      nodeId: null;
      status: "unmapped";
    }
  | {
      nodeId: string;
      status: "confirmed" | "general";
    } {
  const node = atlasNodes[nodeId];
  if (!node || node.type !== "animal") {
    return {
      status: "unmapped",
      nodeId: null
    };
  }

  const facts = Array.isArray(node.facts)
    ? node.facts
    : [];
  const confirmed = facts.some(
    (item) =>
      isRecord(item) &&
      item.confidence === "confirmed" &&
      item.sourceType === "official"
  );

  return confirmed
    ? {
        status: "confirmed",
        nodeId: node.id
      }
    : {
        status: "general",
        nodeId: node.id
      };
}

function normalize(value: unknown): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
