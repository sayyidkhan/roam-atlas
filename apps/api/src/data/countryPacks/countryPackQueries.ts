import type {
  CompiledCountryPack
} from "./compiler.ts";

type CountryPackNodes = CompiledCountryPack["nodes"];

export function searchKnownNode(
  nodes: CountryPackNodes,
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
  const match = Object.values(nodes).find(
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
  nodes: CountryPackNodes,
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
  const node = nodes[nodeId];
  if (!node || node.type !== "animal") {
    return {
      status: "unmapped",
      nodeId: null
    };
  }

  const confirmed = (node.facts ?? []).some(
    (fact) =>
      fact.confidence === "confirmed" &&
      fact.sourceType === "official"
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
