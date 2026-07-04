import { buildTileCacheKey } from "../../domain/scrollScene.js";
import { DEFAULT_IMAGE_MODEL } from "../../domain/imageProvider.js";
import { buildWanderImagePrompt } from "../../domain/imagePromptBuilder.js";

const DATA_VERSION = "malaysia-starter-v1";
const STYLE_VERSION = "atlas-qingming-v1";
const PROMPT_VERSION = "prompt-v1";
const TILE_WIDTH = 320;
const TILE_HEIGHT = 520;

export const malaysiaSourceRegistry = {
  starter: {
    id: "malaysia-starter-pack",
    title: "WanderSG Malaysia starter country pack",
    type: "ai_generated",
    url: null
  }
};

export const malaysiaNodes = {
  malaysia: node({
    id: "malaysia",
    type: "country",
    title: "Malaysia",
    childIds: [
      "malaysia-kuala-lumpur",
      "malaysia-penang",
      "malaysia-langkawi",
      "malaysia-johor",
      "malaysia-sabah",
      "malaysia-sarawak",
      "malaysia-melaka"
    ],
    tags: ["overview", "malaysia", "starter-map"],
    facts: [
      starterFact(
        "malaysia-starter-summary",
        "Malaysia is mapped as a WanderSG starter explorer. Region notes are unconfirmed until source review."
      )
    ]
  }),
  "malaysia-kuala-lumpur": starterRegion("malaysia-kuala-lumpur", "Kuala Lumpur", "city"),
  "malaysia-penang": starterRegion("malaysia-penang", "Penang", "state"),
  "malaysia-langkawi": starterRegion("malaysia-langkawi", "Langkawi", "region"),
  "malaysia-johor": starterRegion("malaysia-johor", "Johor", "state"),
  "malaysia-sabah": starterRegion("malaysia-sabah", "Sabah", "state"),
  "malaysia-sarawak": starterRegion("malaysia-sarawak", "Sarawak", "state"),
  "malaysia-melaka": starterRegion("malaysia-melaka", "Melaka", "state")
};

export const malaysiaScenes = {
  "malaysia-overview": createScene({
    id: "malaysia-overview",
    title: "Malaysia Overview Scroll",
    rootNodeId: "malaysia",
    columns: 4,
    rows: 1,
    hotspots: [
      regionHotspot("hotspot-kl", "malaysia-kuala-lumpur", "Kuala Lumpur", { x: 90, y: 150, width: 260, height: 128 }, 2),
      regionHotspot("hotspot-penang", "malaysia-penang", "Penang", { x: 382, y: 150, width: 250, height: 128 }, 2),
      regionHotspot("hotspot-langkawi", "malaysia-langkawi", "Langkawi", { x: 664, y: 150, width: 250, height: 128 }, 2),
      regionHotspot("hotspot-johor", "malaysia-johor", "Johor", { x: 944, y: 150, width: 246, height: 128 }, 2),
      regionHotspot("hotspot-sabah", "malaysia-sabah", "Sabah", { x: 170, y: 324, width: 250, height: 128 }, 2),
      regionHotspot("hotspot-sarawak", "malaysia-sarawak", "Sarawak", { x: 510, y: 324, width: 250, height: 128 }, 2),
      regionHotspot("hotspot-melaka", "malaysia-melaka", "Melaka", { x: 850, y: 324, width: 250, height: 128 }, 2)
    ]
  })
};

export const malaysiaCountryPack = {
  countryCode: "MY",
  countrySlug: "malaysia",
  title: "Malaysia",
  rootNodeId: "malaysia",
  overviewSceneId: "malaysia-overview",
  nodes: malaysiaNodes,
  scenes: malaysiaScenes,
  sourceRegistry: malaysiaSourceRegistry,
  confidence: "unconfirmed",
  factBoundary:
    "Malaysia is an actual WanderSG explorer route, but current facts are starter-map data until source review."
};

function createScene({ id, title, rootNodeId, columns, rows, hotspots }) {
  const width = columns * TILE_WIDTH;
  const height = rows * TILE_HEIGHT;
  const visualContext = visualContextForScene(rootNodeId);

  return {
    id,
    title,
    rootNodeId,
    coordinateSpace: {
      width,
      height,
      unit: "virtual_px"
    },
    tileGrid: {
      columns,
      rows,
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      overlapPx: 32
    },
    tiles: Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const tileId = `${id}-r${row}-c${column}`;
      return {
        id: tileId,
        sceneId: id,
        row,
        column,
        bounds: {
          x: column * TILE_WIDTH,
          y: row * TILE_HEIGHT,
          width: TILE_WIDTH,
          height: TILE_HEIGHT
        },
        status: "missing",
        prompt: buildWanderImagePrompt({
          nodeTitle: title,
          visualContext,
          pageType: "homepage_overview",
          zoomLevel: 0,
          density: "minimal",
          countryName: "Malaysia",
          knownChildNodeTitles: malaysiaNodes[rootNodeId]?.childIds.map((nodeId) => malaysiaNodes[nodeId]?.title).filter(Boolean) ?? []
        }),
        continuityPrompt: `This tile is part of a larger panoramic Malaysia scroll. Scene: ${title}. Tile position: row ${row}, column ${column} of ${rows} x ${columns}. Keep paper texture, line weight, lighting, perspective, and density consistent. Do not add readable labels, fake signs, ticket prices, opening hours, official claims, or official logos.`,
        cacheKey: buildTileCacheKey({
          sceneId: id,
          tileId,
          styleVersion: STYLE_VERSION,
          dataVersion: DATA_VERSION,
          promptVersion: PROMPT_VERSION,
          imageModel: DEFAULT_IMAGE_MODEL
        }),
        imageModel: DEFAULT_IMAGE_MODEL
      };
    }),
    hotspots,
    ambientLayers: [
      { id: `${id}-light`, kind: "light", bounds: { x: 0, y: 0, width, height }, intensity: "subtle" },
      { id: `${id}-clouds`, kind: "cloud", bounds: { x: 0, y: 0, width, height: height * 0.36 }, intensity: "subtle" },
      { id: `${id}-water`, kind: "water", bounds: { x: 0, y: height * 0.28, width, height: height * 0.58 }, intensity: "subtle" },
      { id: `${id}-foliage`, kind: "foliage", bounds: { x: 0, y: height * 0.36, width, height: height * 0.5 }, intensity: "subtle" }
    ],
    cameraPresets: [
      { id: "overview", label: "Overview", targetBounds: { x: 0, y: 0, width, height }, zoom: 1 }
    ],
    styleVersion: STYLE_VERSION,
    dataVersion: DATA_VERSION
  };
}

function visualContextForScene(rootNodeId) {
  if (rootNodeId === "malaysia") {
    return "A restrained Malaysia overview page for a travel explorer. Show broad candidate region clusters for Kuala Lumpur, Penang, Langkawi, Johor, Sabah, Sarawak, and Melaka as clickable atlas areas. Use warm paper texture, clean ink outlines, terrain washes, coast and island hints, forest and city clusters, calm water, and short readable anchor labels only. Do not add opening hours, prices, official claims, source citations, routes, or long factual captions.";
  }

  return "A restrained Malaysia starter region page with clear atlas composition, warm paper texture, clean ink outlines, and sparse clickable clusters. Do not add opening hours, prices, official claims, source citations, routes, or long factual captions.";
}

function regionHotspot(id, nodeId, label, shape, zIndex) {
  return {
    id,
    sceneId: "malaysia-overview",
    nodeId,
    kind: "region",
    shape,
    zIndex,
    label,
    confidence: "unconfirmed",
    action: { type: "open_node", nodeId }
  };
}

function starterRegion(id, title, kind) {
  return node({
    id,
    type: "district",
    title,
    parentId: "malaysia",
    childIds: [],
    tags: [kind, "malaysia", "starter-map", "unconfirmed"],
    facts: [
      starterFact(
        `${id}-starter-note`,
        `${title} is a starter-map region in the Malaysia explorer. Replace this note with source-reviewed facts before using it for trip planning.`
      )
    ]
  });
}

function node({ id, type, title, parentId, childIds = [], tags = [], facts = [] }) {
  return {
    id,
    type,
    title,
    parentId,
    childIds,
    tags,
    facts
  };
}

function starterFact(id, text) {
  return {
    id,
    text,
    sourceType: "ai_generated",
    confidence: "unconfirmed",
    sourceUrl: null
  };
}
