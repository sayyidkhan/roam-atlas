export type ItineraryNode = {
  id: string;
  itineraryHints?: {
    budgetLevel?: string;
    nearbyNodeIds?: readonly string[];
    typicalDurationMinutes?: number;
  };
  tags: readonly string[];
  title: string;
  type: string;
};

export type ItineraryPlan = {
  days: Array<{
    day: number;
    items: Array<{
      durationMinutes: number;
      nodeId: string;
      notes: string[];
      reason: string;
      startTime: string;
      title: string;
    }>;
    theme: string;
    warnings: string[];
  }>;
};

const ITINERARY_NODE_TYPES = new Set([
  "district",
  "attraction"
]);

export function filterCuratedItineraryNodes(
  savedNodeIds: readonly string[],
  nodes: Readonly<Record<string, ItineraryNode | undefined>>
): ItineraryNode[] {
  return savedNodeIds
    .map((id) => nodes[id])
    .filter((node): node is ItineraryNode => Boolean(node))
    .filter((node) => ITINERARY_NODE_TYPES.has(node.type))
    .filter(
      (node) =>
        typeof node.itineraryHints?.typicalDurationMinutes ===
          "number" &&
        node.itineraryHints.typicalDurationMinutes > 0
    );
}

export function buildItinerary({
  days,
  pace,
  savedNodeIds,
  nodes
}: {
  days: number | string;
  nodes: Readonly<Record<string, ItineraryNode | undefined>>;
  pace: string;
  savedNodeIds: readonly string[];
}): ItineraryPlan {
  const curatedNodes = filterCuratedItineraryNodes(savedNodeIds, nodes);
  const paceLimit = pace === "packed" ? 5 : pace === "relaxed" ? 3 : 4;
  const dayCount = Math.max(1, Math.min(Number(days) || 1, 3));
  const buckets: ItineraryPlan["days"] = Array.from(
    { length: dayCount },
    (_, index) => ({
    day: index + 1,
    theme: index === 0 ? "Visual country highlights" : "Curated discoveries",
    items: [],
    warnings: [
      "Only curated RoamAtlas nodes are used. Times are approximate and do not claim live opening hours."
    ]
    })
  );

  const sorted = [...curatedNodes].sort(compareByGeography);
  sorted.forEach((node, index) => {
    const bucket = buckets[index % dayCount];
    if (!bucket) return;
    if (bucket.items.length >= paceLimit) return;
    const durationMinutes =
      node.itineraryHints?.typicalDurationMinutes;
    if (!durationMinutes) return;

    bucket.items.push({
      nodeId: node.id,
      title: node.title,
      startTime: approximateStartTime(bucket.items.length),
      durationMinutes,
      reason: reasonForNode(node),
      notes: [
        `Budget: ${node.itineraryHints?.budgetLevel ?? "medium"}`,
        "Verify same-day opening hours and tickets before travel."
      ]
    });
  });

  return { days: buckets };
}

export function createUnmappedDetour(query: string) {
  return {
    id: `detour-${slugify(query)}`,
    type: "detour",
    title: query,
    confidence: "unconfirmed",
    message:
      "This is not mapped in RoamAtlas' verified data yet. You can explore it as an AI-imagined detour, but it will not be treated as a confirmed travel fact until reviewed."
  };
}

function compareByGeography(
  a: ItineraryNode,
  b: ItineraryNode
): number {
  const aNearby = a.itineraryHints?.nearbyNodeIds?.[0] ?? "";
  const bNearby = b.itineraryHints?.nearbyNodeIds?.[0] ?? "";
  return aNearby.localeCompare(bNearby) || a.title.localeCompare(b.title);
}

function reasonForNode(node: ItineraryNode): string {
  if (node.tags.includes("wildlife")) {
    return `${node.title} fits wildlife and family exploration from the curated graph.`;
  }
  if (node.tags.includes("skyline")) {
    return `${node.title} anchors a skyline-focused part of the country scroll.`;
  }
  if (node.tags.includes("culture")) {
    return `${node.title} adds cultural texture without leaving the verified graph.`;
  }
  return `${node.title} is one of the saved curated discoveries.`;
}

function approximateStartTime(index: number): string {
  const starts = [
    "approximate 09:30",
    "approximate 12:00",
    "approximate 15:00",
    "approximate 18:00",
    "approximate 20:00"
  ];
  return starts[index] ?? "approximate flexible";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
