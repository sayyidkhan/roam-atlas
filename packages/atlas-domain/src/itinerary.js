const ITINERARY_NODE_TYPES = new Set(["district", "attraction"]);

export function filterCuratedItineraryNodes(savedNodeIds, nodes) {
  return savedNodeIds
    .map((id) => nodes[id])
    .filter(Boolean)
    .filter((node) => ITINERARY_NODE_TYPES.has(node.type))
    .filter((node) => node.itineraryHints?.typicalDurationMinutes);
}

export function buildItinerary({ days, pace, savedNodeIds, nodes }) {
  const curatedNodes = filterCuratedItineraryNodes(savedNodeIds, nodes);
  const paceLimit = pace === "packed" ? 5 : pace === "relaxed" ? 3 : 4;
  const dayCount = Math.max(1, Math.min(Number(days) || 1, 3));
  const buckets = Array.from({ length: dayCount }, (_, index) => ({
    day: index + 1,
    theme: index === 0 ? "Visual country highlights" : "Curated discoveries",
    items: [],
    warnings: [
      "Only curated RoamAtlas nodes are used. Times are approximate and do not claim live opening hours."
    ]
  }));

  const sorted = [...curatedNodes].sort(compareByGeography);
  sorted.forEach((node, index) => {
    const bucket = buckets[index % dayCount];
    if (bucket.items.length >= paceLimit) return;

    bucket.items.push({
      nodeId: node.id,
      title: node.title,
      startTime: approximateStartTime(bucket.items.length),
      durationMinutes: node.itineraryHints.typicalDurationMinutes,
      reason: reasonForNode(node),
      notes: [
        `Budget: ${node.itineraryHints.budgetLevel ?? "medium"}`,
        "Verify same-day opening hours and tickets before travel."
      ]
    });
  });

  return { days: buckets };
}

export function createUnmappedDetour(query) {
  return {
    id: `detour-${slugify(query)}`,
    type: "detour",
    title: query,
    confidence: "unconfirmed",
    message:
      "This is not mapped in RoamAtlas' verified data yet. You can explore it as an AI-imagined detour, but it will not be treated as a confirmed travel fact until reviewed."
  };
}

function compareByGeography(a, b) {
  const aNearby = a.itineraryHints?.nearbyNodeIds?.[0] ?? "";
  const bNearby = b.itineraryHints?.nearbyNodeIds?.[0] ?? "";
  return aNearby.localeCompare(bNearby) || a.title.localeCompare(b.title);
}

function reasonForNode(node) {
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

function approximateStartTime(index) {
  const starts = ["approximate 09:30", "approximate 12:00", "approximate 15:00", "approximate 18:00", "approximate 20:00"];
  return starts[index] ?? "approximate flexible";
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
