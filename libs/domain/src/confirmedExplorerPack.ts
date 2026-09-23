import {
  isRecord,
  safeText,
  slugifyDraftId
} from "./countryDraftTextPolicy.ts";

const TILE_WIDTH = 320;
const TILE_HEIGHT = 520;
const MAX_CHAPTERS = 12;
const MAX_CHILD_DEPTH = 4;

type ExplorerConfidence = "likely" | "unconfirmed";

type ExplorerCandidate = {
  children: ExplorerCandidate[];
  confidence: ExplorerConfidence;
  kind: string;
  name: string;
  sourceUrl: string | null;
  tags: string[];
  why: string;
};

type ExplorerNode = {
  childIds: string[];
  facts: Array<{
    confidence: ExplorerConfidence;
    id: string;
    sourceType: "ai_generated" | "exa_grounded";
    sourceUrl: string | null;
    text: string;
  }>;
  id: string;
  parentId?: string;
  tags: string[];
  title: string;
  type: string;
};

export type ConfirmedExplorerPackSource = {
  confidence: "unconfirmed";
  countryCode: string;
  countrySlug: string;
  factBoundary: string;
  nodes: Record<string, ExplorerNode>;
  overviewSceneId: string;
  registration: "runtime_draft";
  rootNodeId: string;
  scenes: Record<string, ExplorerScene>;
  sourceRegistry: Record<string, {
    id: string;
    title: string;
    type: "candidate";
    url: string;
  }>;
  tileDefaults: {
    overlapPx: number;
    tileHeight: number;
    tileWidth: number;
  };
  title: string;
  versions: {
    data: string;
    prompt: string;
    style: string;
  };
};

type ExplorerScene = {
  ambientLayers: Array<{
    bounds: {
      height: number;
      unit: "ratio";
      width: number;
      x: number;
      y: number;
    };
    id: string;
    intensity: "subtle";
    kind: string;
  }>;
  cameraPresets: Array<{
    id: string;
    label: string;
    targetBounds: {
      height: number;
      unit: "ratio";
      width: number;
      x: number;
      y: number;
    };
    zoom: number;
  }>;
  continuityPromptTemplate: string;
  density: "minimal";
  hotspots: Array<{
    confidence: ExplorerConfidence;
    id: string;
    kind: "poi" | "region";
    label: string;
    nodeId: string;
    shape: {
      height: number;
      width: number;
      x: number;
      y: number;
    };
    zIndex: number;
  }>;
  id: string;
  pageType: string;
  rootNodeId: string;
  tileGrid: {
    columns: number;
    rows: number;
  };
  title: string;
  visualContext: string;
  zoomLevel: number;
};

/**
 * Builds an explorable country pack from a starter map that a person has
 * confirmed for curation. Facts stay likely or unconfirmed.
 */
export function createConfirmedExplorerPackSource(
  value: unknown
): ConfirmedExplorerPackSource | null {
  const draft = readConfirmedDraft(value);
  if (!draft) return null;
  const chapters = readCandidates(draft.regions).slice(0, MAX_CHAPTERS);
  if (!chapters.length) return null;

  const usedIds = new Set<string>([draft.countrySlug]);
  const nodes: Record<string, ExplorerNode> = {};
  const chapterNodes = chapters.map((chapter) =>
    buildNodeTree({
      candidate: chapter,
      countrySlug: draft.countrySlug,
      nodes,
      parentId: draft.countrySlug,
      type: chapter.kind || "district",
      usedIds
    })
  );
  nodes[draft.countrySlug] = {
    id: draft.countrySlug,
    type: "country",
    title: draft.countryName,
    childIds: chapterNodes.map((node) => node.id),
    tags: ["overview", "starter-map", draft.countrySlug],
    facts: createFacts(
      `${draft.countrySlug}-summary`,
      draft.summary,
      "unconfirmed",
      null
    )
  };

  const overviewSceneId = `${draft.countrySlug}-overview`;
  const scenes: Record<string, ExplorerScene> = {
    [overviewSceneId]: createScene({
      childNodes: chapterNodes,
      countryName: draft.countryName,
      hotspotKind: "region",
      id: overviewSceneId,
      pageType: "homepage_overview",
      rootNodeId: draft.countrySlug,
      title: `${draft.countryName} Overview Scroll`
    })
  };
  for (const chapter of chapterNodes) {
    const sceneId = `${chapter.id}-scroll`;
    scenes[sceneId] = createScene({
      childNodes: chapter.childIds
        .map((childId) => nodes[childId])
        .filter((node): node is ExplorerNode => Boolean(node)),
      countryName: draft.countryName,
      hotspotKind: "poi",
      id: sceneId,
      pageType: "region_chapter",
      rootNodeId: chapter.id,
      title: `${chapter.title} Scroll`
    });
  }

  return {
    countryCode: draft.countryCode,
    countrySlug: draft.countrySlug,
    title: draft.countryName,
    rootNodeId: draft.countrySlug,
    overviewSceneId,
    confidence: "unconfirmed",
    registration: "runtime_draft",
    factBoundary:
      `${draft.countryName} is open for exploration from a starter map ` +
      "confirmed for curation. Chapter notes stay unconfirmed or likely " +
      "until source review.",
    versions: {
      data: `${draft.countrySlug}-runtime-draft-${slugifyDraftId(
        chapterNodes.map((node) => node.title).join(" ")
      )}`,
      style: "atlas-qingming-v1",
      prompt: "prompt-v1"
    },
    tileDefaults: {
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      overlapPx: 32
    },
    sourceRegistry: draft.sources,
    nodes,
    scenes
  };
}

function buildNodeTree({
  candidate,
  countrySlug,
  nodes,
  parentId,
  type,
  usedIds
}: {
  candidate: ExplorerCandidate;
  countrySlug: string;
  nodes: Record<string, ExplorerNode>;
  parentId: string;
  type: string;
  usedIds: Set<string>;
}): ExplorerNode {
  const id = uniqueId(
    `${countrySlug}-${slugifyDraftId(candidate.name)}`,
    usedIds
  );
  const childNodes = candidate.children.map((child) =>
    buildNodeTree({
      candidate: child,
      countrySlug,
      nodes,
      parentId: id,
      type: child.kind || "attraction",
      usedIds
    })
  );
  const node: ExplorerNode = {
    id,
    type: normalizeNodeType(type),
    title: candidate.name,
    parentId,
    childIds: childNodes.map((child) => child.id),
    tags: uniqueTags([
      candidate.kind,
      "starter-map",
      countrySlug,
      ...candidate.tags
    ]),
    facts: createFacts(
      `${id}-note`,
      candidate.why,
      candidate.confidence,
      candidate.sourceUrl
    )
  };
  nodes[id] = node;
  return node;
}

function createScene({
  childNodes,
  countryName,
  hotspotKind,
  id,
  pageType,
  rootNodeId,
  title
}: {
  childNodes: ExplorerNode[];
  countryName: string;
  hotspotKind: "poi" | "region";
  id: string;
  pageType: string;
  rootNodeId: string;
  title: string;
}): ExplorerScene {
  const grid = sceneGrid(Math.max(childNodes.length, 1));
  const labels = childNodes.map((node) => node.title);
  const labelText = labels.length
    ? labels.join(", ")
    : title;
  return {
    id,
    title,
    rootNodeId,
    pageType,
    zoomLevel: 0,
    density: "minimal",
    tileGrid: grid,
    visualContext:
      `A restrained illustrated travel-atlas page for ${title} in ` +
      `${countryName}. Show separate clickable areas for ${labelText}. ` +
      "Use warm ivory paper, thin grey ink, muted pastel land, pale blue " +
      "water, desaturated greens, and generous spacing. Short anchor labels only.",
    continuityPromptTemplate:
      `This tile is part of a larger panoramic ${countryName} scroll. ` +
      "Scene: {title}. Tile position: row {row}, column {column} of " +
      "{rows} x {columns}. Keep the same paper texture, line weight, " +
      "lighting, perspective, and density. Do not add readable labels, " +
      "fake signs, ticket prices, opening hours, official claims, source " +
      "citations, routes, or official logos.",
    hotspots: childNodes.map((node, index) => ({
      id: `${id}-hotspot-${index + 1}`,
      nodeId: node.id,
      kind: hotspotKind,
      shape: hotspotShape(index, grid.columns),
      zIndex: 2,
      label: node.title,
      confidence: node.facts[0]?.confidence ?? "unconfirmed"
    })),
    ambientLayers: createAmbientLayers(),
    cameraPresets: [
      {
        id: "overview",
        label: "Overview",
        targetBounds: {
          unit: "ratio",
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        zoom: 1
      }
    ]
  };
}

function createFacts(
  id: string,
  text: string,
  confidence: ExplorerConfidence,
  sourceUrl: string | null
): ExplorerNode["facts"] {
  if (!text) return [];
  return [
    {
      id,
      text,
      sourceType: sourceUrl ? "exa_grounded" : "ai_generated",
      confidence: sourceUrl ? confidence : "unconfirmed",
      sourceUrl
    }
  ];
}

function readConfirmedDraft(value: unknown): {
  countryCode: string;
  countryName: string;
  countrySlug: string;
  regions: unknown;
  sources: ConfirmedExplorerPackSource["sourceRegistry"];
  summary: string;
} | null {
  const record = unwrapDraft(value);
  if (!record || record.curationStatus !== "confirmed_for_curation") {
    return null;
  }
  const countrySlug = safeText(record.countrySlug, "", 80);
  const countryName = safeText(record.countryName, "", 80);
  const countryCode = safeText(record.countryCode, "", 8);
  if (!countrySlug || !countryName || !countryCode) return null;
  return {
    countryCode,
    countryName,
    countrySlug,
    regions: record.regions,
    sources: readSources(record.sourceRegistry),
    summary: safeText(
      record.summary,
      `${countryName} explorer chapters are open for curation review.`,
      320
    )
  };
}

function unwrapDraft(
  value: unknown
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (
    isRecord(value.draft) &&
    value.draft.curationStatus === "confirmed_for_curation"
  ) {
    return value.draft;
  }
  return value;
}

function readCandidates(value: unknown, depth = 0): ExplorerCandidate[] {
  if (depth >= MAX_CHILD_DEPTH || !Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = safeText(item.name, "", 80);
    if (!name) return [];
    const sourceUrl = readHttpsUrl(item.sourceUrl);
    return [{
      name,
      kind: safeText(item.kind, "", 40).toLowerCase(),
      why: safeText(item.why, "", 320),
      confidence: readConfidence(item.confidence, sourceUrl),
      sourceUrl,
      tags: readTags(item.tags),
      children: readCandidates(item.children, depth + 1)
    }];
  });
}

function readSources(
  value: unknown
): ConfirmedExplorerPackSource["sourceRegistry"] {
  if (!Array.isArray(value)) return {};
  const sources: ConfirmedExplorerPackSource["sourceRegistry"] = {};
  for (const item of value) {
    if (!isRecord(item)) continue;
    const url = readHttpsUrl(item.url);
    const id = slugifyDraftId(item.id ?? item.title ?? url);
    const title = safeText(item.title, "", 120);
    if (!url || !title || sources[id]) continue;
    sources[id] = {
      id,
      title,
      type: "candidate",
      url
    };
  }
  return sources;
}

function readConfidence(
  value: unknown,
  sourceUrl: string | null
): ExplorerConfidence {
  if (!sourceUrl) return "unconfirmed";
  return value === "likely" || value === "confirmed"
    ? "likely"
    : "unconfirmed";
}

function readHttpsUrl(value: unknown): string | null {
  const url = String(value ?? "").trim();
  return /^https:\/\/\S+$/i.test(url) ? url : null;
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => safeText(tag, "", 32).toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function uniqueId(base: string, usedIds: Set<string>): string {
  const seed = base || "candidate";
  let id = seed;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${seed}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function normalizeNodeType(value: string): string {
  const type = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{0,31}$/.test(type) ? type : "attraction";
}

function sceneGrid(count: number): { columns: number; rows: number } {
  const columns = count <= 2 ? 2 : 3;
  return {
    columns,
    rows: Math.max(1, Math.ceil(count / columns))
  };
}

function hotspotShape(
  index: number,
  columns: number
): { height: number; width: number; x: number; y: number } {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const padX = 28;
  return {
    x: column * TILE_WIDTH + padX,
    y: row * TILE_HEIGHT + 132,
    width: TILE_WIDTH - padX * 2,
    height: 168
  };
}

function createAmbientLayers(): ExplorerScene["ambientLayers"] {
  return [
    ["light", 0, 0, 1, 1],
    ["cloud", 0, 0, 1, 0.36],
    ["water", 0, 0.28, 1, 0.58],
    ["foliage", 0, 0.36, 1, 0.5]
  ].map(([kind, x, y, width, height]) => ({
    id: `{sceneId}-${kind}`,
    kind: String(kind),
    bounds: {
      unit: "ratio" as const,
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height)
    },
    intensity: "subtle" as const
  }));
}
