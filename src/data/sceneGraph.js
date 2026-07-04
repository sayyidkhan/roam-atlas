import { buildTileCacheKey } from "../domain/scrollScene.js";
import { DEFAULT_IMAGE_MODEL } from "../domain/imageProvider.js";
import { buildRoamAtlasImagePrompt } from "../domain/imagePromptBuilder.js";

export const DATA_VERSION = "data-v1";
export const STYLE_VERSION = "atlas-qingming-v1";
export const PROMPT_VERSION = "prompt-v1";

export const sourceRegistry = {
  mandaiZoo: {
    id: "mandai-zoo",
    title: "Singapore Zoo official visitor page",
    type: "official",
    url: "https://www.mandai.com/en/singapore-zoo.html"
  },
  mandaiTickets: {
    id: "mandai-zoo-admission",
    title: "Singapore Zoo official admission page",
    type: "official",
    url: "https://buy.mandai.com/web-storefront/en/products/singapore-zoo-adm"
  },
  gardens: {
    id: "gardens-by-the-bay",
    title: "Gardens by the Bay official site",
    type: "official",
    url: "https://www.gardensbythebay.com.sg/"
  },
  marinaBay: {
    id: "ura-marina-bay",
    title: "URA Marina Bay planning page",
    type: "official",
    url: "https://www.ura.gov.sg/Corporate/Data/Planning/Marina-Bay"
  },
  sentosa: {
    id: "sentosa-overview",
    title: "Sentosa official overview",
    type: "official",
    url: "https://www.sentosa.gov.sg/who-we-are/overview/"
  },
  curated: {
    id: "roamatlas-curated",
    title: "RoamAtlas curated MVP dataset",
    type: "curated",
    url: "docs/PRODUCT.md"
  },
  generalBiology: {
    id: "general-biology",
    title: "General natural history background",
    type: "general_reference"
  }
};

export const atlasNodes = {
  singapore: node({
    id: "singapore",
    type: "country",
    title: "Singapore",
    childIds: [
      "west-campus-scroll",
      "marina-bay-scroll",
      "heritage-belt-scroll",
      "sentosa-south-scroll",
      "changi-east-scroll",
      "nature-wildlife-scroll"
    ],
    tags: ["overview", "singapore"],
    facts: [
      fact("sg-curated", "Singapore is the only country mapped in this RoamAtlas first slice.", "curated", "confirmed", sourceRegistry.curated.url)
    ]
  }),
  "marina-bay-scroll": node({
    id: "marina-bay-scroll",
    type: "district",
    title: "Marina Bay and Civic District",
    parentId: "singapore",
    childIds: ["marina-bay-sands", "gardens-by-the-bay", "merlion-park"],
    tags: ["skyline", "photography", "waterfront"],
    facts: [
      fact("marina-bay-ura", "Marina Bay is presented by URA as a waterfront district with major leisure destinations and civic space.", "official", "confirmed", sourceRegistry.marinaBay.url)
    ],
    itineraryHints: hints(120, "evening", "medium", ["gardens-by-the-bay"])
  }),
  "west-campus-scroll": node({
    id: "west-campus-scroll",
    type: "district",
    title: "West Campus and Gardens",
    parentId: "singapore",
    childIds: ["nus", "ntu", "jurong-lake-gardens"],
    tags: ["west", "campus", "gardens", "architecture"],
    facts: [
      fact("west-campus-curated", "This MVP groups NUS, NTU, and Jurong Lake Gardens as west-side curated exploration nodes.", "curated", "confirmed", sourceRegistry.curated.url)
    ],
    itineraryHints: hints(180, "morning", "medium", ["jurong-lake-gardens"])
  }),
  "heritage-belt-scroll": node({
    id: "heritage-belt-scroll",
    type: "district",
    title: "Heritage Belt",
    parentId: "singapore",
    childIds: ["chinatown", "kampong-glam", "little-india"],
    tags: ["culture", "food", "walking"],
    facts: [
      fact("heritage-curated", "This MVP groups Chinatown, Kampong Glam, and Little India as a culture-focused exploration belt.", "curated", "confirmed", sourceRegistry.curated.url)
    ],
    itineraryHints: hints(180, "afternoon", "low", ["chinatown"])
  }),
  "sentosa-south-scroll": node({
    id: "sentosa-south-scroll",
    type: "district",
    title: "Sentosa and Southern Waterfront",
    parentId: "singapore",
    childIds: ["sentosa-island", "southern-ridges"],
    tags: ["family", "beach", "resort"],
    facts: [
      fact("sentosa-official", "Sentosa is Singapore's island resort destination and includes beaches, attractions, resorts, and leisure experiences.", "official", "confirmed", sourceRegistry.sentosa.url)
    ],
    itineraryHints: hints(240, "afternoon", "medium", ["sentosa-island"])
  }),
  "changi-east-scroll": node({
    id: "changi-east-scroll",
    type: "district",
    title: "Changi and East Coast",
    parentId: "singapore",
    childIds: ["changi-airport", "jewel-changi", "east-coast-park"],
    tags: ["east", "airport", "food", "waterfront"],
    facts: [
      fact("changi-east-curated", "This MVP groups Changi Airport, Jewel Changi, and East Coast Park as east-side curated exploration nodes.", "curated", "confirmed", sourceRegistry.curated.url)
    ],
    itineraryHints: hints(180, "afternoon", "medium", ["jewel-changi"])
  }),
  "nature-wildlife-scroll": node({
    id: "nature-wildlife-scroll",
    type: "district",
    title: "Nature and Wildlife",
    parentId: "singapore",
    childIds: ["mandai-scroll", "botanic-gardens", "east-coast-park"],
    tags: ["nature", "wildlife", "family"],
    facts: [
      fact("nature-curated", "This MVP uses Mandai as the confirmed wildlife deep-dive path.", "curated", "confirmed", sourceRegistry.curated.url)
    ],
    itineraryHints: hints(240, "morning", "medium", ["mandai-scroll"])
  }),
  "marina-bay-sands": node({
    id: "marina-bay-sands",
    type: "attraction",
    title: "Marina Bay Sands",
    parentId: "marina-bay-scroll",
    tags: ["skyline", "architecture", "photography"],
    facts: [
      fact("mbs-stb", "Singapore Tourism Board identifies Marina Bay Sands as one of Singapore's two integrated resorts.", "official", "confirmed", "https://www.stb.gov.sg/industries-experience-development/integrated-resorts/")
    ],
    itineraryHints: hints(90, "evening", "high", ["gardens-by-the-bay"])
  }),
  "gardens-by-the-bay": node({
    id: "gardens-by-the-bay",
    type: "attraction",
    title: "Gardens by the Bay",
    parentId: "marina-bay-scroll",
    childIds: ["supertree-grove", "flower-dome", "cloud-forest"],
    tags: ["nature", "skyline", "family", "glass", "conservatories", "domes", "supertrees"],
    facts: [
      fact("gbtb-official", "Gardens by the Bay describes itself as a garden destination with attractions including Cloud Forest, Flower Dome, Floral Fantasy, and Supertree Observatory.", "official", "confirmed", sourceRegistry.gardens.url)
    ],
    itineraryHints: hints(150, "afternoon", "medium", ["marina-bay-sands"])
  }),
  "supertree-grove": node({
    id: "supertree-grove",
    type: "zone",
    title: "Supertree Grove",
    parentId: "gardens-by-the-bay",
    childIds: ["supertree-structure-plate"],
    tags: ["supertree", "trees", "canopy", "garden", "vertical", "grove"],
    facts: [
      fact("supertree-curated", "Supertree Grove is included as a curated Gardens by the Bay drill-down node for the RoamAtlas demo path.", "curated", "confirmed", sourceRegistry.curated.url)
    ]
  }),
  "flower-dome": node({
    id: "flower-dome",
    type: "zone",
    title: "Flower Dome",
    parentId: "gardens-by-the-bay",
    tags: ["flower", "dome", "conservatory", "glass", "garden"],
    facts: [
      fact("flower-dome-curated", "Flower Dome is included as a curated Gardens by the Bay drill-down node for the RoamAtlas demo path.", "curated", "confirmed", sourceRegistry.curated.url)
    ]
  }),
  "cloud-forest": node({
    id: "cloud-forest",
    type: "zone",
    title: "Cloud Forest",
    parentId: "gardens-by-the-bay",
    tags: ["cloud", "forest", "conservatory", "glass", "waterfall", "dome"],
    facts: [
      fact("cloud-forest-curated", "Cloud Forest is included as a curated Gardens by the Bay drill-down node for the RoamAtlas demo path.", "curated", "confirmed", sourceRegistry.curated.url)
    ]
  }),
  "supertree-structure-plate": node({
    id: "supertree-structure-plate",
    type: "anatomy_plate",
    title: "Supertree Structure Plate",
    parentId: "supertree-grove",
    tags: ["supertree", "structure", "canopy", "cutaway", "vertical garden"],
    facts: [
      fact("supertree-plate-general", "This structure plate is a general visual explanation, not proof of hidden structural details.", "general_reference", "general", undefined)
    ]
  }),
  "merlion-park": node({
    id: "merlion-park",
    type: "attraction",
    title: "Merlion Park",
    parentId: "marina-bay-scroll",
    tags: ["photography", "waterfront"],
    facts: [
      fact("merlion-curated", "Merlion Park is included as a curated photo stop in the Marina Bay demo path.", "curated", "confirmed", sourceRegistry.curated.url)
    ],
    itineraryHints: hints(30, "evening", "low", ["marina-bay-sands"])
  }),
  chinatown: poi("chinatown", "Chinatown", "heritage-belt-scroll", ["culture", "food"], 120),
  "kampong-glam": poi("kampong-glam", "Kampong Glam", "heritage-belt-scroll", ["culture", "shopping"], 90),
  "little-india": poi("little-india", "Little India", "heritage-belt-scroll", ["culture", "food"], 90),
  "sentosa-island": poi("sentosa-island", "Sentosa Island", "sentosa-south-scroll", ["family", "beach"], 180),
  "southern-ridges": poi("southern-ridges", "Southern Ridges", "sentosa-south-scroll", ["nature", "walking"], 120),
  nus: poi("nus", "NUS", "west-campus-scroll", ["campus", "architecture", "west"], 90),
  ntu: poi("ntu", "NTU", "west-campus-scroll", ["campus", "architecture", "west"], 90),
  "jurong-lake-gardens": poi("jurong-lake-gardens", "Jurong Lake Gardens", "west-campus-scroll", ["nature", "gardens", "west"], 120),
  "changi-airport": poi("changi-airport", "Changi Airport", "changi-east-scroll", ["airport", "east", "architecture"], 90),
  "jewel-changi": poi("jewel-changi", "Jewel Changi", "changi-east-scroll", ["airport", "waterfall", "shopping"], 120),
  "botanic-gardens": poi("botanic-gardens", "Singapore Botanic Gardens", "nature-wildlife-scroll", ["nature", "family"], 150),
  "east-coast-park": poi("east-coast-park", "East Coast Park", "nature-wildlife-scroll", ["food", "cycling"], 150),
  "mandai-scroll": node({
    id: "mandai-scroll",
    type: "district",
    title: "Mandai Wildlife Reserve",
    parentId: "nature-wildlife-scroll",
    childIds: ["singapore-zoo"],
    tags: ["wildlife", "family", "nature"],
    facts: [
      fact("mandai-destination", "Mandai Wildlife Reserve presents itself as Singapore's wildlife destination with multiple wildlife attractions.", "official", "confirmed", "https://www.mandai.com/en/visit.html")
    ],
    itineraryHints: hints(240, "morning", "medium", ["singapore-zoo"])
  }),
  "singapore-zoo": node({
    id: "singapore-zoo",
    type: "attraction",
    title: "Singapore Zoo",
    parentId: "mandai-scroll",
    childIds: ["wild-africa", "primate-kingdom", "fragile-forest"],
    tags: ["wildlife", "family", "animals"],
    facts: [
      fact("zoo-official", "Singapore Zoo is an official Mandai Wildlife Reserve attraction.", "official", "confirmed", sourceRegistry.mandaiZoo.url),
      fact("zoo-animal-count", "Mandai describes Singapore Zoo as home to over 4,200 animals.", "official", "confirmed", sourceRegistry.mandaiZoo.url)
    ],
    itineraryHints: hints(240, "morning", "medium", ["mandai-scroll"])
  }),
  "wild-africa": node({
    id: "wild-africa",
    type: "zone",
    title: "Wild Africa",
    parentId: "singapore-zoo",
    childIds: ["giraffe", "white-rhinoceros", "zebra"],
    tags: ["wildlife", "zone", "animals"],
    facts: [
      fact("wild-africa-feeding", "Mandai's admission add-ons list giraffe, zebra, and white rhino feeding experiences at Wild Africa.", "official", "confirmed", sourceRegistry.mandaiTickets.url)
    ]
  }),
  "primate-kingdom": zone("primate-kingdom", "Primate Kingdom", ["orangutan", "colobus-monkey"]),
  "fragile-forest": zone("fragile-forest", "Fragile Forest", ["ring-tailed-lemur", "two-toed-sloth"]),
  giraffe: animal("giraffe", "Giraffe", "wild-africa", ["giraffe-anatomy-plate"], [
    fact("giraffe-exhibit", "Giraffe is confirmed in the current Singapore Zoo Wild Africa demo path from Mandai's official feeding listing.", "official", "confirmed", sourceRegistry.mandaiTickets.url),
    fact("giraffe-biology", "Giraffes are herbivorous mammals known for long necks and high browsing behavior.", "general_reference", "general", undefined)
  ]),
  "white-rhinoceros": animal("white-rhinoceros", "White Rhinoceros", "wild-africa", [], [
    fact("rhino-exhibit", "White rhino is confirmed in the current Wild Africa demo path from Mandai's official feeding listing.", "official", "confirmed", sourceRegistry.mandaiTickets.url)
  ]),
  zebra: animal("zebra", "Zebra", "wild-africa", [], [
    fact("zebra-exhibit", "Zebra is confirmed in the current Wild Africa demo path from Mandai's official feeding listing.", "official", "confirmed", sourceRegistry.mandaiTickets.url)
  ]),
  orangutan: animal("orangutan", "Orangutan", "primate-kingdom", [], [
    fact("orangutan-zoo", "Mandai's Singapore Zoo visitor page names orangutans among wildlife guests may meet.", "official", "confirmed", sourceRegistry.mandaiZoo.url)
  ]),
  "colobus-monkey": animal("colobus-monkey", "Colobus Monkey", "primate-kingdom", [], [
    fact("colobus-general", "Colobus monkey content is included as general encyclopedia background until attraction-specific sourcing is reviewed.", "general_reference", "general", undefined)
  ]),
  "ring-tailed-lemur": animal("ring-tailed-lemur", "Ring-tailed Lemur", "fragile-forest", [], [
    fact("lemur-general", "Ring-tailed lemur content is included as general encyclopedia background until attraction-specific sourcing is reviewed.", "general_reference", "general", undefined)
  ]),
  "two-toed-sloth": animal("two-toed-sloth", "Two-toed Sloth", "fragile-forest", [], [
    fact("sloth-general", "Two-toed sloth content is included as general encyclopedia background until attraction-specific sourcing is reviewed.", "general_reference", "general", undefined)
  ]),
  "giraffe-anatomy-plate": node({
    id: "giraffe-anatomy-plate",
    type: "anatomy_plate",
    title: "Giraffe Anatomy Plate",
    parentId: "giraffe",
    tags: ["animal", "anatomy", "general"],
    facts: [
      fact("giraffe-neck-general", "The anatomy plate is general biology content, not proof of a specific live exhibit.", "general_reference", "general", undefined)
    ]
  })
};

export const scrollScenes = {
  "singapore-overview": createScene({
    id: "singapore-overview",
    title: "Singapore Overview Scroll",
    rootNodeId: "singapore",
    columns: 4,
    rows: 1,
    hotspots: [
      regionHotspot("hotspot-west-campus", "west-campus-scroll", "NTU / NUS", { x: 155, y: 185, width: 365, height: 160 }, 2, { type: "enter_scene", sceneId: "west-campus-scroll" }),
      regionHotspot("hotspot-marina", "marina-bay-scroll", "Marina Bay", { x: 500, y: 175, width: 380, height: 190 }, 2, { type: "enter_scene", sceneId: "marina-bay-scroll" }),
      regionHotspot("hotspot-heritage", "heritage-belt-scroll", "Heritage Belt", { x: 720, y: 95, width: 250, height: 120 }, 2, { type: "enter_scene", sceneId: "heritage-belt-scroll" }),
      regionHotspot("hotspot-nature", "nature-wildlife-scroll", "Nature", { x: 980, y: 130, width: 320, height: 155 }, 2, { type: "enter_scene", sceneId: "nature-wildlife-scroll" }),
      regionHotspot("hotspot-changi", "changi-east-scroll", "Changi", { x: 1285, y: 165, width: 330, height: 185 }, 2, { type: "enter_scene", sceneId: "changi-east-scroll" }),
      regionHotspot("hotspot-sentosa", "sentosa-south-scroll", "Sentosa", { x: 900, y: 345, width: 500, height: 130 }, 2, { type: "enter_scene", sceneId: "sentosa-south-scroll" }),
      regionHotspot("hotspot-zoo", "singapore-zoo", "Singapore Zoo", { x: 1065, y: 230, width: 130, height: 55 }, 3, { type: "enter_scene", sceneId: "singapore-zoo-scroll" })
    ]
  }),
  "west-campus-scroll": simpleScene("west-campus-scroll", "West Campus Scroll", "west-campus-scroll", ["nus", "ntu", "jurong-lake-gardens"]),
  "marina-bay-scroll": simpleScene("marina-bay-scroll", "Marina Bay Scroll", "marina-bay-scroll", ["marina-bay-sands", "gardens-by-the-bay", "merlion-park"]),
  "heritage-belt-scroll": simpleScene("heritage-belt-scroll", "Heritage Belt Scroll", "heritage-belt-scroll", ["chinatown", "kampong-glam", "little-india"]),
  "sentosa-south-scroll": simpleScene("sentosa-south-scroll", "Sentosa South Scroll", "sentosa-south-scroll", ["sentosa-island", "southern-ridges"]),
  "changi-east-scroll": simpleScene("changi-east-scroll", "Changi East Scroll", "changi-east-scroll", ["changi-airport", "jewel-changi", "east-coast-park"]),
  "nature-wildlife-scroll": simpleScene("nature-wildlife-scroll", "Nature and Wildlife Scroll", "nature-wildlife-scroll", ["mandai-scroll", "botanic-gardens", "east-coast-park"]),
  "mandai-scroll": simpleScene("mandai-scroll", "Mandai Scroll", "mandai-scroll", ["singapore-zoo"]),
  "singapore-zoo-scroll": simpleScene("singapore-zoo-scroll", "Singapore Zoo Scroll", "singapore-zoo", ["wild-africa", "primate-kingdom", "fragile-forest"]),
  "wild-africa-scroll": simpleScene("wild-africa-scroll", "Wild Africa Scroll", "wild-africa", ["giraffe", "white-rhinoceros", "zebra"])
};

export function createInitialSavedState(savedNodeIds = []) {
  return {
    savedNodeIds: [...new Set(savedNodeIds)],
    createdAt: new Date().toISOString()
  };
}

export function searchKnownNode(query) {
  const normalized = normalize(query);
  const match = Object.values(atlasNodes).find(
    (node) => normalize(node.title) === normalized || node.id === normalized
  );

  if (!match) {
    return {
      status: "unmapped",
      nodeId: null,
      reason: "No curated RoamAtlas node matched this search."
    };
  }

  return {
    status: "matched",
    nodeId: match.id,
    reason: "Matched against curated RoamAtlas node ids and titles."
  };
}

export function findAnimalExhibitClaim(nodeId) {
  const node = atlasNodes[nodeId];
  if (!node || node.type !== "animal") {
    return { status: "unmapped", nodeId: null };
  }

  const confirmed = node.facts.some(
    (item) => item.confidence === "confirmed" && item.sourceType === "official"
  );

  return confirmed
    ? { status: "confirmed", nodeId: node.id }
    : { status: "general", nodeId: node.id };
}

function createScene({ id, title, rootNodeId, columns, rows, hotspots }) {
  const tileWidth = 420;
  const tileHeight = 520;
  const width = columns * tileWidth;
  const height = rows * tileHeight;

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
      tileWidth,
      tileHeight,
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
        bounds: { x: column * tileWidth, y: row * tileHeight, width: tileWidth, height: tileHeight },
        status: "missing",
        prompt: buildRoamAtlasImagePrompt({
          nodeTitle: title,
          visualContext: visualContextForScene(rootNodeId),
          pageType: "singapore_overview_scroll",
          zoomLevel: 0,
          density: rootNodeId === "singapore" ? "sparse" : "balanced"
        }),
        continuityPrompt: `This tile is part of a larger panoramic Singapore scroll. Scene: ${title}. Tile position: row ${row}, column ${column} of ${rows} x ${columns}. Keep paper texture, line weight, lighting, perspective, and density consistent. Do not add readable labels, fake signs, ticket prices, opening hours, or official logos.`,
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
      { id: `${id}-clouds`, kind: "cloud", bounds: { x: 0, y: 0, width, height: height * 0.34 }, intensity: "subtle" },
      { id: `${id}-water`, kind: "water", bounds: { x: 0, y: height * 0.32, width, height: height * 0.46 }, intensity: "subtle" },
      { id: `${id}-foliage`, kind: "foliage", bounds: { x: 0, y: height * 0.44, width, height: height * 0.42 }, intensity: "subtle" }
    ],
    cameraPresets: [
      { id: "overview", label: "Overview", targetBounds: { x: 0, y: 0, width, height }, zoom: 1 }
    ],
    styleVersion: STYLE_VERSION,
    dataVersion: DATA_VERSION
  };
}

function visualContextForScene(rootNodeId) {
  const contexts = {
    singapore:
      "A simplified Singapore overview with visual icon clusters for west-side NUS, NTU, and Jurong Lake Gardens; Marina Bay and Gardens by the Bay; heritage districts; Sentosa; east-side Changi Airport, Jewel Changi, and East Coast Park; and north-side Mandai Wildlife Reserve and Singapore Zoo. Use open water, garden districts, calm roads, bridges, transit lines, modern towers, and spacious green areas.",
    "marina-bay-scroll":
      "Gardens by the Bay and nearby Marina Bay waterfront with two glass conservatories, Supertrees, calm blue water canals, a few bridges, simple roads, a landscaped park, simplified towers, and light transit infrastructure.",
    "heritage-belt-scroll":
      "A compact heritage district with shophouse blocks, shaded walkways, small courtyards, calm roads, planted plazas, and a few modern edges.",
    "sentosa-south-scroll":
      "A clean southern waterfront district with coastline, simple resort blocks, greenery, paths, bridges, light transit, and open water.",
    "nature-wildlife-scroll":
      "A spacious nature and wildlife district with forest edges, habitat-like clearings, paths, water, light visitor infrastructure, and simple transit access.",
    "mandai-scroll":
      "A clean wildlife reserve planning illustration with forest paths, habitat zones, water edges, visitor pavilions, and light transit access.",
    "singapore-zoo":
      "A zoo planning illustration with habitat zones, shaded visitor paths, pavilions, water, planted areas, and a calm readable layout.",
    "wild-africa":
      "A simplified wildlife habitat zone with open grassy areas, paths, water, trees, viewing shelters, and a few distant animal silhouettes."
  };

  return contexts[rootNodeId] ?? contexts.singapore;
}

function simpleScene(id, title, rootNodeId, nodeIds) {
  return createScene({
    id,
    title,
    rootNodeId,
    columns: Math.max(2, nodeIds.length),
    rows: 1,
    hotspots: nodeIds.map((nodeId, index) =>
      regionHotspot(
        `${id}-${nodeId}`,
        nodeId,
        atlasNodes[nodeId]?.title ?? nodeId,
        { x: 80 + index * 320, y: 170, width: 230, height: 190 },
        3,
        nodeAction(nodeId)
      )
    )
  });
}

function nodeAction(nodeId) {
  if (nodeId === "mandai-scroll") return { type: "enter_scene", sceneId: "mandai-scroll" };
  if (nodeId === "singapore-zoo") return { type: "enter_scene", sceneId: "singapore-zoo-scroll" };
  if (nodeId === "wild-africa") return { type: "enter_scene", sceneId: "wild-africa-scroll" };
  return { type: "open_node", nodeId };
}

function regionHotspot(id, nodeId, label, shape, zIndex, action) {
  return {
    id,
    sceneId: action.sceneId ?? "scene",
    nodeId,
    kind: "region",
    shape,
    zIndex,
    label,
    confidence: "confirmed",
    action
  };
}

function poi(id, title, parentId, tags, duration) {
  return node({
    id,
    type: "attraction",
    title,
    parentId,
    tags,
    facts: [
      fact(`${id}-curated`, `${title} is included as a curated RoamAtlas first-slice point of interest.`, "curated", "confirmed", sourceRegistry.curated.url)
    ],
    itineraryHints: hints(duration, "afternoon", "low", [parentId])
  });
}

function zone(id, title, childIds) {
  return node({
    id,
    type: "zone",
    title,
    parentId: "singapore-zoo",
    childIds,
    tags: ["wildlife", "zone"],
    facts: [
      fact(`${id}-curated`, `${title} is included as a zoo-zone node for the RoamAtlas demo path.`, "curated", "confirmed", sourceRegistry.curated.url)
    ]
  });
}

function animal(id, title, parentId, childIds, facts) {
  return node({
    id,
    type: "animal",
    title,
    parentId,
    childIds,
    tags: ["animal", "wildlife"],
    facts
  });
}

function node({ childIds = [], facts = [], tags = [], ...rest }) {
  return { childIds, facts, tags, ...rest };
}

function fact(id, text, sourceType, confidence, sourceUrl) {
  return {
    id,
    text,
    sourceType,
    confidence,
    sourceUrl,
    checkedAt: sourceUrl?.startsWith("http") ? "2026-05-09" : undefined
  };
}

function hints(typicalDurationMinutes, bestTimeOfDay, budgetLevel, nearbyNodeIds) {
  return { typicalDurationMinutes, bestTimeOfDay, budgetLevel, nearbyNodeIds };
}

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}
