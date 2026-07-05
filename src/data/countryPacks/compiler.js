import { buildTileCacheKey } from "../../domain/scrollScene.js";
import { DEFAULT_IMAGE_MODEL } from "../../domain/imageProvider.js";
import { buildRoamAtlasImagePrompt } from "../../domain/imagePromptBuilder.js";

export function createStarterCountryPackData(country) {
  const countrySlug = country.slug;
  const countryName = country.name;
  const rootNodeId = countrySlug;
  const overviewSceneId = `${countrySlug}-overview`;

  return {
    countryCode: country.code,
    countrySlug,
    title: countryName,
    rootNodeId,
    overviewSceneId,
    confidence: "unconfirmed",
    registration: "worldwide_generated",
    factBoundary: `${countryName} uses a worldwide RoamAtlas starter pack. It is a planning scaffold only until source review adds verified facts.`,
    versions: {
      data: `${countrySlug}-world-starter-v1`,
      style: "atlas-qingming-v1",
      prompt: "prompt-v1"
    },
    tileDefaults: {
      tileWidth: 320,
      tileHeight: 520,
      overlapPx: 32,
      imageModel: "default"
    },
    sourceRegistry: {
      starter: {
        id: `${countrySlug}-world-starter-pack`,
        title: `RoamAtlas ${countryName} worldwide starter country pack`,
        type: "ai_generated",
        url: null
      }
    },
    nodes: {
      [rootNodeId]: {
        id: rootNodeId,
        type: "country",
        title: countryName,
        childIds: [],
        tags: ["overview", "starter-map", "worldwide", countrySlug],
        facts: [
          {
            id: `${countrySlug}-starter-summary`,
            text: `${countryName} has a RoamAtlas starter explorer shell. Add source-reviewed regions and facts before using it for verified trip planning.`,
            sourceType: "ai_generated",
            confidence: "unconfirmed",
            sourceUrl: null
          }
        ]
      }
    },
    scenes: {
      [overviewSceneId]: {
        id: overviewSceneId,
        title: `${countryName} Overview Scroll`,
        rootNodeId,
        pageType: "homepage_overview",
        zoomLevel: 0,
        density: "minimal",
        tileGrid: {
          columns: 2,
          rows: 1
        },
        visualContext: `A restrained starter-map overview page for ${countryName}. Show a generic travel-atlas composition for the country as an unconfirmed planning scaffold. Use warm paper texture, clean ink outlines, broad land and water shapes, terrain washes, anonymous city texture, and sparse generic visual anchors only. Do not name real cities, attractions, routes, opening hours, prices, source citations, official claims, rankings, slogans, or long factual captions.`,
        continuityPromptTemplate: `This tile is part of a larger panoramic ${countryName} starter scroll. Scene: {title}. Tile position: row {row}, column {column} of {rows} x {columns}. Keep paper texture, line weight, lighting, perspective, and density consistent. Do not add readable labels except the supplied country title and generic unconfirmed starter-map anchors. Do not add fake signs, ticket prices, opening hours, official claims, source citations, routes, or official logos.`,
        hotspots: [],
        ambientLayers: createStarterAmbientLayers(),
        cameraPresets: [
          {
            id: "overview",
            label: "Overview",
            targetBounds: { unit: "ratio", x: 0, y: 0, width: 1, height: 1 },
            zoom: 1
          }
        ]
      }
    }
  };
}

export function compileCountryPackData(data) {
  const versions = data.versions ?? {};
  const tileDefaults = data.tileDefaults ?? {};
  const nodes = cloneRecord(data.nodes ?? {});
  const sourceRegistry = cloneRecord(data.sourceRegistry ?? {});
  const scenes = Object.fromEntries(
    Object.entries(data.scenes ?? {}).map(([sceneId, scene]) => [
      sceneId,
      compileScene({
        sceneId,
        scene,
        nodes,
        countryName: data.title,
        versions,
        tileDefaults
      })
    ])
  );

  return {
    countryCode: data.countryCode,
    countrySlug: data.countrySlug,
    title: data.title,
    rootNodeId: data.rootNodeId,
    overviewSceneId: data.overviewSceneId,
    nodes,
    scenes,
    sourceRegistry,
    confidence: data.confidence,
    registration: data.registration ?? "source_controlled",
    factBoundary: data.factBoundary,
    versions: cloneJson(versions)
  };
}

function compileScene({ sceneId, scene, nodes, countryName, versions, tileDefaults }) {
  const columns = scene.tileGrid?.columns ?? scene.columns ?? 1;
  const rows = scene.tileGrid?.rows ?? scene.rows ?? 1;
  const tileWidth = scene.tileGrid?.tileWidth ?? tileDefaults.tileWidth ?? 320;
  const tileHeight = scene.tileGrid?.tileHeight ?? tileDefaults.tileHeight ?? 520;
  const overlapPx = scene.tileGrid?.overlapPx ?? tileDefaults.overlapPx ?? 0;
  const width = columns * tileWidth;
  const height = rows * tileHeight;
  const dataVersion = versions.data ?? "country-pack-data-v1";
  const styleVersion = versions.style ?? "atlas-qingming-v1";
  const promptVersion = versions.prompt ?? "prompt-v1";
  const imageModel = normalizeImageModel(scene.imageModel ?? tileDefaults.imageModel);

  return {
    id: scene.id ?? sceneId,
    title: scene.title,
    rootNodeId: scene.rootNodeId,
    pageType: scene.pageType,
    zoomLevel: scene.zoomLevel,
    density: scene.density,
    visualContext: scene.visualContext,
    artworkVisualContext: scene.artworkVisualContext,
    coordinateSpace: {
      width,
      height,
      unit: "virtual_px"
    },
    tileGrid: {
      columns,
      rows,
      tileWidth,
      tileHeight,
      overlapPx
    },
    tiles: Array.from({ length: rows * columns }, (_, index) =>
      compileTile({
        scene,
        sceneId,
        row: Math.floor(index / columns),
        column: index % columns,
        rows,
        columns,
        tileWidth,
        tileHeight,
        countryName,
        nodes,
        dataVersion,
        styleVersion,
        promptVersion,
        imageModel
      })
    ),
    hotspots: (scene.hotspots ?? []).map((hotspot) => compileHotspot(hotspot, sceneId)),
    ambientLayers: (scene.ambientLayers ?? []).map((layer) => compileAmbientLayer(layer, { sceneId, width, height })),
    cameraPresets: (scene.cameraPresets ?? []).map((preset) => compileCameraPreset(preset, { width, height })),
    styleVersion,
    dataVersion
  };
}

function compileTile({
  scene,
  sceneId,
  row,
  column,
  rows,
  columns,
  tileWidth,
  tileHeight,
  countryName,
  nodes,
  dataVersion,
  styleVersion,
  promptVersion,
  imageModel
}) {
  const tileId = `${sceneId}-r${row}-c${column}`;
  const rootNode = nodes[scene.rootNodeId];
  const knownChildNodeTitles =
    scene.knownChildNodeTitles ??
    rootNode?.childIds?.map((nodeId) => nodes[nodeId]?.title).filter(Boolean) ??
    [];

  return {
    id: tileId,
    sceneId,
    row,
    column,
    bounds: {
      x: column * tileWidth,
      y: row * tileHeight,
      width: tileWidth,
      height: tileHeight
    },
    status: scene.tileStatus ?? "missing",
    prompt: buildRoamAtlasImagePrompt({
      nodeId: scene.rootNodeId,
      nodeTitle: scene.title,
      visualContext: scene.visualContext,
      pageType: scene.pageType ?? "homepage_overview",
      zoomLevel: scene.zoomLevel ?? 0,
      density: scene.density ?? "minimal",
      countryName,
      knownChildNodeTitles
    }),
    continuityPrompt: compileContinuityPrompt(scene, {
      sceneId,
      title: scene.title,
      row,
      column,
      rows,
      columns,
      countryName
    }),
    cacheKey: buildTileCacheKey({
      sceneId,
      tileId,
      styleVersion,
      dataVersion,
      promptVersion,
      imageModel
    }),
    imageModel
  };
}

function compileContinuityPrompt(scene, values) {
  const template =
    scene.continuityPromptTemplate ??
    "This tile is part of a larger panoramic {countryName} scroll. Scene: {title}. Tile position: row {row}, column {column} of {rows} x {columns}. Keep paper texture, line weight, lighting, perspective, and density consistent. Do not add readable labels, fake signs, ticket prices, opening hours, official claims, source citations, routes, or official logos.";

  return replaceTokens(template, values);
}

function compileHotspot(hotspot, sceneId) {
  const nodeId = hotspot.nodeId;
  return {
    ...hotspot,
    sceneId,
    action: hotspot.action ?? (nodeId ? { type: "open_node", nodeId } : undefined)
  };
}

function compileAmbientLayer(layer, { sceneId, width, height }) {
  return {
    ...layer,
    id: replaceTokens(layer.id, { sceneId }),
    bounds: resolveBounds(layer.bounds, { width, height })
  };
}

function compileCameraPreset(preset, { width, height }) {
  return {
    ...preset,
    targetBounds: resolveBounds(preset.targetBounds, { width, height })
  };
}

function resolveBounds(bounds, { width, height }) {
  if (!bounds) return bounds;
  if (bounds.unit !== "ratio") {
    return { ...bounds };
  }

  return {
    x: bounds.x * width,
    y: bounds.y * height,
    width: bounds.width * width,
    height: bounds.height * height
  };
}

function normalizeImageModel(imageModel) {
  if (!imageModel || imageModel === "default") return DEFAULT_IMAGE_MODEL;
  return imageModel;
}

function replaceTokens(value, replacements) {
  if (typeof value !== "string") return value;
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    Object.hasOwn(replacements, key) ? String(replacements[key]) : match
  );
}

function cloneRecord(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneJson(value)]));
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createStarterAmbientLayers() {
  return [
    {
      id: "{sceneId}-light",
      kind: "light",
      bounds: { unit: "ratio", x: 0, y: 0, width: 1, height: 1 },
      intensity: "subtle"
    },
    {
      id: "{sceneId}-clouds",
      kind: "cloud",
      bounds: { unit: "ratio", x: 0, y: 0, width: 1, height: 0.36 },
      intensity: "subtle"
    },
    {
      id: "{sceneId}-water",
      kind: "water",
      bounds: { unit: "ratio", x: 0, y: 0.28, width: 1, height: 0.58 },
      intensity: "subtle"
    },
    {
      id: "{sceneId}-foliage",
      kind: "foliage",
      bounds: { unit: "ratio", x: 0, y: 0.36, width: 1, height: 0.5 },
      intensity: "subtle"
    }
  ];
}
