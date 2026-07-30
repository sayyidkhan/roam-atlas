import { buildTileCacheKey } from "@roamatlas/domain/scrollScene.js";
import type {
  FlipbookHotspot
} from "@roamatlas/domain/flipbookPage.js";
import { DEFAULT_IMAGE_MODEL } from "../../domain/imageGenerationPolicy.ts";
import { buildRoamAtlasImagePrompt } from "@roamatlas/prompts/imagePromptBuilder.js";
import type {
  CompiledCountryPack,
  CompiledCountryPackNode,
  CompiledCountryPackScene,
  CountryPackAmbientLayer,
  CountryPackCameraPreset,
  CountryPackHotspot,
  CountryPackNode,
  CountryPackScene,
  CountryPackSource,
  CountryPackTileDefaults,
  CountryPackVersions,
  JsonRecord,
  RatioOrPixelBounds
} from "./countryPackTypes.ts";

export type {
  CompiledCountryPack,
  CountryPackSource
} from "./countryPackTypes.ts";

type CompileSceneOptions = {
  countryName: string;
  nodes: Record<string, CountryPackNode>;
  scene: CountryPackScene;
  sceneId: string;
  tileDefaults: CountryPackTileDefaults;
  versions: CountryPackVersions;
};

type CompileTileOptions = {
  column: number;
  columns: number;
  countryName: string;
  dataVersion: string;
  imageModel: string;
  nodes: Record<string, CountryPackNode>;
  promptVersion: string;
  row: number;
  rows: number;
  scene: CountryPackScene;
  sceneId: string;
  styleVersion: string;
  tileHeight: number;
  tileWidth: number;
};

type TokenReplacements = Record<string, string | number>;

export function compileCountryPackData(
  data: CountryPackSource
): CompiledCountryPack {
  const versions = data.versions ?? {};
  const tileDefaults = data.tileDefaults ?? {};
  const nodes = compileNodes(data.nodes ?? {});
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

function compileScene({
  sceneId,
  scene,
  nodes,
  countryName,
  versions,
  tileDefaults
}: CompileSceneOptions): CompiledCountryPackScene {
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
}: CompileTileOptions) {
  const tileId = `${sceneId}-r${row}-c${column}`;
  const rootNode = nodes[scene.rootNodeId];
  const knownChildNodeTitles =
    scene.knownChildNodeTitles ??
    rootNode?.childIds
      ?.map((nodeId) => nodes[nodeId]?.title)
      .filter((title): title is string => Boolean(title)) ??
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
      parentNodeTitle: null,
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

function compileContinuityPrompt(
  scene: CountryPackScene,
  values: TokenReplacements
): string {
  const template =
    scene.continuityPromptTemplate ??
    "This tile is part of a larger panoramic {countryName} scroll. Scene: {title}. Tile position: row {row}, column {column} of {rows} x {columns}. Keep paper texture, line weight, lighting, perspective, and density consistent. Do not add readable labels, fake signs, ticket prices, opening hours, official claims, source citations, routes, or official logos.";

  return replaceTokens(template, values);
}

function compileHotspot(
  hotspot: CountryPackHotspot,
  sceneId: string
): FlipbookHotspot & JsonRecord {
  const nodeId = hotspot.nodeId;
  const action =
    hotspot.action ??
    (nodeId ? { type: "open_node" as const, nodeId } : undefined);
  if (!action) {
    throw new Error(
      `Country-pack hotspot ${hotspot.id} requires an action or nodeId.`
    );
  }
  return {
    ...hotspot,
    sceneId,
    action
  };
}

function compileNodes(
  nodes: Record<string, CountryPackNode>
): Record<string, CompiledCountryPackNode> {
  return Object.fromEntries(
    Object.entries(nodes).map(([nodeId, node]) => [
      nodeId,
      {
        ...cloneJson(node),
        childIds: [...(node.childIds ?? [])],
        id: node.id,
        title: node.title
      }
    ])
  );
}

function compileAmbientLayer(
  layer: CountryPackAmbientLayer,
  {
    sceneId,
    width,
    height
  }: { height: number; sceneId: string; width: number }
): JsonRecord {
  return {
    ...layer,
    id: replaceTokens(layer.id, { sceneId }),
    bounds: resolveBounds(layer.bounds, { width, height })
  };
}

function compileCameraPreset(
  preset: CountryPackCameraPreset,
  { width, height }: { height: number; width: number }
): JsonRecord {
  return {
    ...preset,
    targetBounds: resolveBounds(preset.targetBounds, { width, height })
  };
}

function resolveBounds(
  bounds: RatioOrPixelBounds | undefined,
  { width, height }: { height: number; width: number }
): Omit<RatioOrPixelBounds, "unit"> | RatioOrPixelBounds | undefined {
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

function normalizeImageModel(imageModel: unknown): string {
  if (!imageModel || imageModel === "default") return DEFAULT_IMAGE_MODEL;
  return String(imageModel);
}

function replaceTokens(
  value: string,
  replacements: TokenReplacements
): string {
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    Object.hasOwn(replacements, key) ? String(replacements[key]) : match
  );
}

function cloneRecord<T extends JsonRecord>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      cloneJson(value)
    ])
  ) as T;
}

function cloneJson<T>(value: T): T {
  return value == null
    ? value
    : (JSON.parse(JSON.stringify(value)) as T);
}
