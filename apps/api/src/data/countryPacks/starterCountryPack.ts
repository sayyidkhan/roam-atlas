import type {
  CountryPackAmbientLayer,
  CountryPackSource,
  WorldCountry
} from "./countryPackTypes.ts";

export function createStarterCountryPackData(
  country: WorldCountry
): CountryPackSource {
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
    registration: "unregistered",
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
        tags: [
          "overview",
          "starter-map",
          "worldwide",
          countrySlug
        ],
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
      }
    }
  };
}

function createStarterAmbientLayers():
CountryPackAmbientLayer[] {
  return [
    {
      id: "{sceneId}-light",
      kind: "light",
      bounds: {
        unit: "ratio",
        x: 0,
        y: 0,
        width: 1,
        height: 1
      },
      intensity: "subtle"
    },
    {
      id: "{sceneId}-clouds",
      kind: "cloud",
      bounds: {
        unit: "ratio",
        x: 0,
        y: 0,
        width: 1,
        height: 0.36
      },
      intensity: "subtle"
    },
    {
      id: "{sceneId}-water",
      kind: "water",
      bounds: {
        unit: "ratio",
        x: 0,
        y: 0.28,
        width: 1,
        height: 0.58
      },
      intensity: "subtle"
    },
    {
      id: "{sceneId}-foliage",
      kind: "foliage",
      bounds: {
        unit: "ratio",
        x: 0,
        y: 0.36,
        width: 1,
        height: 0.5
      },
      intensity: "subtle"
    }
  ];
}
