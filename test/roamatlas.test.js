import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  atlasNodes,
  createInitialSavedState,
  findAnimalExhibitClaim,
  scrollScenes,
  searchKnownNode
} from "../src/data/sceneGraph.js";
import {
  ROAMATLAS_CONFIG,
  resolveRoamAtlasConfig
} from "../src/config/roamAtlasConfig.js";
import {
  ROAMATLAS_EXPERIENCE_CONFIG,
  resolveRoamAtlasExperienceConfig
} from "../src/config/experienceConfig.js";
import {
  approveDraftItem,
  appendUnconfirmedRegionCandidates,
  isDraftItemApproved,
  unapproveDraftItem
} from "../src/domain/countryDraftReview.js";
import { buildLoadingStepTrail, resolveLoadingStep } from "../src/domain/loadingSteps.js";
import {
  PLACE_IMAGE_SELECTION_VERSION,
  formatExaPlaceImageQuery,
  inferPlaceImageProfile,
  isUsablePlaceImageUrl,
  rankPlaceImageCandidates,
  scorePlaceImageCandidate
} from "../src/domain/placeImageSelection.js";
import { listNextArtworkDestinations } from "../src/domain/nextArtworkDestinations.js";
import {
  getCountryBySlug,
  getCountryCardState,
  worldCountries
} from "../src/data/countries.js";
import {
  getCountryImageOverrideUrl,
  getCountryImageTopics
} from "../src/data/countryImageTopics.js";
import { countryPacks } from "../src/data/countryPacks/index.js";
import {
  buildItinerary,
  createUnmappedDetour,
  filterCuratedItineraryNodes
} from "../src/domain/itinerary.js";
import {
  buildTileCacheKey,
  findTopmostHotspot,
  getMissingTiles,
  resolveHotspotAction,
  viewportToScenePoint
} from "../src/domain/scrollScene.js";
import { assertGeneratedImagesAreNotFactSources } from "../src/domain/guardrails.js";
import {
  precomputeClickableRegions,
  resolveImageClick
} from "../src/domain/clickResolver.js";
import { matchClickPhraseToNode } from "../src/domain/nodeMatcher.js";
import { buildRoamAtlasImagePrompt } from "../src/domain/imagePromptBuilder.js";
import { planNextFlipbookPage } from "../src/domain/pagePlanner.js";
import { getSceneArtwork } from "../src/data/sceneArtwork.js";
import { sceneArtwork } from "../src/data/sceneArtwork.js";
import {
  getCanonicalArtworkPageForGeneration,
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "../src/data/defaultArtworkPages.js";
import { resolveFlipbookClick } from "../src/domain/flipbookPage.js";
import {
  buildHomepagePrompt,
  buildRegionPrompt,
  buildEncyclopediaPrompt,
  buildRoamAtlasImagePrompt as buildPromptOutput
} from "../src/lib/prompts/index.js";
import {
  DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT,
  normalizeImageModel
} from "../src/domain/imageProvider.js";
import {
  shouldQueueDefaultArtwork,
  sortImageJobsForProcessing
} from "../src/domain/imageJobQueue.js";
import {
  RUNTIME_CACHE_URL_PREFIX,
  createCountryStarterMapCachePaths,
  createPlaceImageCachePaths,
  createRuntimeCachePaths,
  resolveRuntimeCacheRoot
} from "../src/domain/runtimeCache.js";
import {
  canonicalRouteForNode,
  resolveAppRoute,
  routeForCountry,
  routeForCountryConfig,
  routeForNode,
  routeForPlace
} from "../src/domain/routes.js";
import {
  buildCountryDraftInfluencePrompt,
  buildCountryDraftPrompt,
  createCountryPackDraftFromStarterMap,
  createCountryPackStarterMap,
  normalizeCountryDraftInstruction,
  normalizeCountryDraftPayload
} from "../src/domain/countryDraft.js";

test("country landing lists world countries with routable country shells", () => {
  const countryCodes = worldCountries.map((country) => country.code);

  assert.equal(worldCountries.length, 195);
  assert.equal(new Set(countryCodes).size, worldCountries.length);
  assert.equal(new Set(worldCountries.map((country) => country.slug)).size, worldCountries.length);
  assert.deepEqual(
    countryCodes,
    [...countryCodes].sort((a, b) =>
      worldCountries.find((country) => country.code === a).name.localeCompare(
        worldCountries.find((country) => country.code === b).name
      )
    )
  );
  assert.equal(getCountryCardState("SG").status, "available");
  assert.equal(getCountryCardState("MY").status, "available");
  assert.equal(getCountryCardState("US").status, "available");
  assert.equal(getCountryCardState("AE").displayCode, "UAE");
  assert.equal(getCountryCardState("GB").displayCode, "UK");
  assert.equal(getCountryCardState("US").displayCode, "USA");
  assert.equal(getCountryBySlug("malaysia").code, "MY");
  assert.equal(getCountryBySlug("palestine").code, "PS");
  assert.equal(getCountryBySlug("palestinian-territories").name, "Palestine");
  assert.equal(routeForCountry(getCountryBySlug("malaysia")), "/malaysia");
  assert.equal(routeForCountryConfig(getCountryBySlug("austria")), "/austria/config");
});

test("country landing cards request country-specific media images", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.deepEqual(getCountryImageTopics(getCountryBySlug("singapore")).slice(0, 1), [
    "Singapore Marina Bay Sands"
  ]);
  assert.deepEqual(getCountryImageTopics(getCountryBySlug("malaysia")).slice(0, 1), [
    "Malaysia Petronas Towers"
  ]);
  assert.deepEqual(getCountryImageTopics(getCountryBySlug("united-arab-emirates")).slice(0, 1), [
    "Dubai Burj Al Arab"
  ]);
  assert.match(getCountryImageOverrideUrl(getCountryBySlug("singapore")), /Marina_Bay_Sands/);
  assert.match(getCountryImageOverrideUrl(getCountryBySlug("malaysia")), /Petronas/);
  assert.match(getCountryImageOverrideUrl(getCountryBySlug("united-arab-emirates")), /Burj_Al-Arab/);
  assert.match(getCountryImageOverrideUrl(getCountryBySlug("south-korea")), /Gyeongbokgung/);
  assert.match(getCountryImageOverrideUrl(getCountryBySlug("palestinian-territories")), /Church_of_the_Nativity/);
  assert.match(appSource, /country-card-photo/);
  assert.match(appSource, /setAttribute\("data-country-card-action", "config"\)/);
  assert.match(appSource, /setAttribute\("data-country-card-action", "open"\)/);
  assert.match(appSource, /openCountryFromLanding/);
  assert.match(appSource, /enterCountryShell\(country\)/);
  assert.match(appSource, /getCountryPhotoUrl/);
  assert.match(appSource, /\/api\/country-image\?countrySlug=/);
  assert.match(appSource, /country-media-v7/);
  assert.match(appSource, /observeCountryCardPhotos/);
  assert.match(appSource, /resetCountryPhotoQueue/);
  assert.match(appSource, /IntersectionObserver/);
  assert.match(appSource, /COUNTRY_CARD_IMAGE_CONCURRENCY = 2/);
  assert.match(appSource, /queueCountryCardPhoto/);
  assert.match(serverSource, /handleCountryImageRequest/);
  assert.match(serverSource, /\/api\/country-image/);
  assert.match(serverSource, /result = await persistCountryCardImage\(country, result\);/);
  assert.match(serverSource, /result\.imageUrl\.startsWith\(COUNTRY_CARD_IMAGE_PUBLIC_PREFIX\)/);
  assert.match(serverSource, /resolveCountryWikipediaArticleImage/);
  assert.match(serverSource, /wikipedia-article-pageimage/);
  assert.match(serverSource, /COUNTRY_CARD_IMAGE_PUBLIC_PREFIX = "\/public\/country-cards"/);
  assert.match(serverSource, /withCountryImageCacheVersion/);
  assert.match(serverSource, /persistCountryCardImage/);
  assert.match(serverSource, /local-country-card/);
  assert.match(serverSource, /resolveCountryLandmarkSearchImage/);
  assert.match(serverSource, /country-image-override/);
  assert.match(serverSource, /wikimedia-commons-search/);
  assert.match(serverSource, /commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(serverSource, /wikimedia-commons-category/);
  assert.match(serverSource, /COUNTRY_MEDIA_EXCLUDE_PATTERN/);
  assert.match(serverSource, /COUNTRY_MEDIA_PLACE_PATTERN/);
  assert.doesNotMatch(serverSource, /flag-fallback/);
  assert.doesNotMatch(serverSource, /flagcdn\.com\/w640/);
  assert.match(styleSource, /\.country-card-photo/);
  assert.match(styleSource, /\.country-card-menu/);
  assert.match(styleSource, /\.country-card-menu-icon/);
  assert.doesNotMatch(styleSource, /\.country-card-menu-popover/);
  assert.doesNotMatch(styleSource, /country-card-atlas\.jpg/);
});

test("app routes only open configured country packs directly in the explorer", () => {
  const routeContext = { countries: worldCountries, countryPacks };
  const singaporePack = countryPacks.singapore;
  const malaysiaPack = countryPacks.malaysia;
  const austriaPack = countryPacks.austria;

  assert.deepEqual(resolveAppRoute("/", routeContext), {
    type: "country_landing"
  });
  assert.deepEqual(resolveAppRoute("/singapore", routeContext), {
    type: "country_overview",
    country: getCountryBySlug("singapore"),
    countrySlug: "singapore",
    pack: singaporePack
  });
  assert.deepEqual(resolveAppRoute("/malaysia", routeContext), {
    type: "country_overview",
    country: getCountryBySlug("malaysia"),
    countrySlug: "malaysia",
    pack: malaysiaPack
  });
  assert.deepEqual(resolveAppRoute("/austria", routeContext), {
    type: "country_needs_config",
    country: getCountryBySlug("austria"),
    countrySlug: "austria"
  });
  assert.deepEqual(resolveAppRoute("/austria/config", routeContext), {
    type: "country_config",
    country: getCountryBySlug("austria"),
    countrySlug: "austria",
    pack: austriaPack
  });
  assert.deepEqual(resolveAppRoute("/malaysia/config", routeContext), {
    type: "country_config",
    country: getCountryBySlug("malaysia"),
    countrySlug: "malaysia",
    pack: malaysiaPack
  });
  assert.deepEqual(resolveAppRoute("/singapore/place/giraffe", routeContext), {
    type: "curated_place",
    countrySlug: "singapore",
    nodeId: "giraffe",
    pack: singaporePack
  });
  assert.deepEqual(resolveAppRoute("/singapore/place/not-real", routeContext), {
    type: "invalid_place",
    countrySlug: "singapore",
    nodeId: "not-real",
    pack: singaporePack
  });
  assert.equal(routeForPlace("singapore", "giraffe"), "/singapore/place/giraffe");
  assert.equal(routeForPlace("malaysia", "malaysia-johor"), "/malaysia/place/malaysia-johor");
  assert.equal(routeForNode("singapore", "giraffe"), "/singapore/place/giraffe");
  assert.equal(canonicalRouteForNode("singapore", "singapore", singaporePack), "/singapore");
  assert.equal(canonicalRouteForNode("singapore", "giraffe", singaporePack), "/singapore/place/giraffe");
  assert.equal(canonicalRouteForNode("malaysia", "malaysia", malaysiaPack), "/malaysia");
  assert.equal(canonicalRouteForNode("malaysia", "malaysia-johor", malaysiaPack), "/malaysia/place/malaysia-johor");
  assert.equal(Object.keys(countryPacks).length, worldCountries.length);
  assert.equal(austriaPack.confidence, "unconfirmed");
  assert.equal(austriaPack.rootNodeId, "austria");
  assert.equal(austriaPack.overviewSceneId, "austria-overview");
});

test("planner only uses curated itinerary nodes and rejects unknown ids", () => {
  const saved = createInitialSavedState([
    "marina-bay-sands",
    "fake-night-market",
    "giraffe",
    "singapore-zoo"
  ]);

  const curated = filterCuratedItineraryNodes(saved.savedNodeIds, atlasNodes);

  assert.deepEqual(
    curated.map((node) => node.id),
    ["marina-bay-sands", "singapore-zoo"]
  );
});

test("saved discoveries produce an approximate itinerary with warnings", () => {
  const saved = createInitialSavedState([
    "singapore-zoo",
    "wild-africa",
    "giraffe",
    "gardens-by-the-bay"
  ]);

  const itinerary = buildItinerary({
    days: 1,
    pace: "balanced",
    savedNodeIds: saved.savedNodeIds,
    nodes: atlasNodes
  });

  assert.equal(itinerary.days.length, 1);
  assert.equal(itinerary.days[0].items[0].nodeId, "singapore-zoo");
  assert.match(itinerary.days[0].items[0].startTime, /^approximate /);
  assert.ok(
    itinerary.days[0].warnings.some((warning) =>
      warning.includes("Only curated RoamAtlas nodes")
    )
  );
  assert.ok(
    itinerary.days[0].items.every((item) => atlasNodes[item.nodeId])
  );
});

test("unknown searches become unmapped detours instead of invented nodes", () => {
  const result = searchKnownNode("blue whale");

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);

  const detour = createUnmappedDetour("blue whale");
  assert.equal(detour.type, "detour");
  assert.equal(detour.confidence, "unconfirmed");
  assert.match(detour.message, /not mapped/);
});

test("animal exhibit claims require confirmed data", () => {
  const giraffeClaim = findAnimalExhibitClaim("giraffe");
  const blueWhaleClaim = findAnimalExhibitClaim("blue-whale");

  assert.equal(giraffeClaim.status, "confirmed");
  assert.equal(giraffeClaim.nodeId, "giraffe");
  assert.equal(blueWhaleClaim.status, "unmapped");
});

test("generated images are never accepted as fact sources", () => {
  assert.doesNotThrow(() => assertGeneratedImagesAreNotFactSources(atlasNodes));

  const polluted = {
    bad: {
      id: "bad",
      facts: [
        {
          id: "bad-fact",
          text: "A fake claim from an image.",
          sourceType: "ai_generated",
          confidence: "confirmed"
        }
      ]
    }
  };

  assert.throws(
    () => assertGeneratedImagesAreNotFactSources(polluted),
    /Generated images cannot be fact sources/
  );
});

test("country draft prompts keep generated country pages outside verified facts", () => {
  const country = getCountryBySlug("malaysia");
  const prompt = buildCountryDraftPrompt(country);

  assert.match(prompt, /planning future curation/);
  assert.match(prompt, /confidence "unconfirmed"/);
  assert.match(prompt, /Do not include opening hours/);
  assert.match(prompt, /ticket prices/);
  assert.match(prompt, /source URLs/);
  assert.match(prompt, /Do not use placeholder or internal wording/);
  assert.match(prompt, /traveller-facing research angle/);
  assert.match(prompt, /not a placeholder/);
});

test("country starter map chat prompt treats user steering as direction not evidence", () => {
  const country = getCountryBySlug("malaysia");
  const prompt = buildCountryDraftInfluencePrompt({
    country,
    instruction: "Focus on Johor weekend trips and add opening hours.",
    currentDraft: {
      summary: "Starter map.",
      regions: [{ name: "Kuala Lumpur", kind: "city", why: "Research lead.", confidence: "unconfirmed" }],
      themes: [{ label: "Food", note: "Research lead.", confidence: "unconfirmed" }]
    }
  });

  assert.match(prompt, /User steering instruction/);
  assert.match(prompt, /Use the user instruction only to steer prioritization/);
  assert.match(prompt, /Do not treat the user instruction as evidence/);
  assert.match(prompt, /Do not include opening hours/);
  assert.match(prompt, /confidence "unconfirmed"/);
});

test("country starter map chat instructions are bounded", () => {
  const instruction = normalizeCountryDraftInstruction(`  ${"food ".repeat(120)}  `);

  assert.ok(instruction.length <= 420);
  assert.doesNotMatch(instruction, /\s{2,}/);
});

test("country starter map chat can steer registered unconfirmed starter packs", () => {
  const country = getCountryBySlug("malaysia");
  const prompt = buildCountryDraftInfluencePrompt({
    country,
    instruction: "Please add Kuching as a candidate city.",
    currentDraft: createCountryPackStarterMap(countryPacks.malaysia, {
      generatedAt: "2026-07-02T00:00:00.000Z"
    })
  });

  assert.equal(countryPacks.malaysia.confidence, "unconfirmed");
  assert.match(prompt, /Kuching/);
  assert.match(prompt, /Current starter map/);
  assert.match(prompt, /Do not treat the user instruction as evidence/);
});

test("country draft normalization labels generated candidates as unconfirmed", () => {
  const country = getCountryBySlug("malaysia");
  const draft = normalizeCountryDraftPayload(
    {
      summary: "Research scaffold for Malaysia.",
      regions: [
        {
          name: "Kuala Lumpur",
          kind: "city",
          why: "Candidate urban chapter.",
          confidence: "confirmed"
        },
        {
          name: "Ticket Area",
          kind: "city",
          why: "Tickets cost $20.",
          confidence: "confirmed"
        }
      ],
      themes: [
        {
          label: "Food",
          note: "Use as a research lead.",
          confidence: "confirmed"
        }
      ]
    },
    country,
    { generatedAt: "2026-07-02T00:00:00.000Z", model: "test-model" }
  );

  assert.equal(draft.mode, "ai_draft");
  assert.equal(draft.confidence, "unconfirmed");
  assert.equal(draft.sourceType, "ai_generated");
  assert.equal(draft.regions.length, 1);
  assert.equal(draft.regions[0].name, "Kuala Lumpur");
  assert.equal(draft.regions[0].confidence, "unconfirmed");
  assert.equal(draft.themes[0].confidence, "unconfirmed");
  assert.match(draft.factBoundary, /not confirmed travel facts/);
});

test("country draft prompt switches to a grounded variant when Exa snippets are supplied", () => {
  const country = getCountryBySlug("malaysia");
  const groundingSnippets = [
    {
      title: "Visit Malaysia - Kuala Lumpur",
      url: "https://malaysia.travel/kuala-lumpur",
      text: "Kuala Lumpur is the capital city of Malaysia."
    },
    {
      title: "Tourism Malaysia - Penang",
      url: "https://tourism.gov.my/penang",
      text: "Penang is known for its heritage sites."
    },
    {
      title: "Visit Malaysia - Langkawi",
      url: "https://malaysia.travel/langkawi",
      text: "Langkawi is an archipelago known for its beaches."
    }
  ];

  const ungroundedPrompt = buildCountryDraftPrompt(country);
  const groundedPrompt = buildCountryDraftPrompt(country, { groundingSnippets });

  assert.match(ungroundedPrompt, /Do not include opening hours, ticket prices, exact transport times, closures, source URLs/);
  assert.doesNotMatch(ungroundedPrompt, /Research snippets/);

  assert.match(groundedPrompt, /Research snippets \(from an external search API, not your own memory\)/);
  assert.match(groundedPrompt, /https:\/\/malaysia\.travel\/kuala-lumpur/);
  assert.match(groundedPrompt, /Never invent a URL that is not one of the snippet URLs listed above/);
  assert.match(groundedPrompt, /confidence to "likely"/);
  assert.doesNotMatch(groundedPrompt, /source URLs, citations/);
});

test("country draft prompt falls back to the ungrounded variant when fewer than 3 usable snippets are supplied", () => {
  const country = getCountryBySlug("malaysia");
  const tooFewSnippets = [
    { title: "Visit Malaysia - Kuala Lumpur", url: "https://malaysia.travel/kuala-lumpur", text: "Kuala Lumpur is the capital city of Malaysia." },
    { title: "Tourism Malaysia - Penang", url: "https://tourism.gov.my/penang", text: "Penang is known for its heritage sites." }
  ];

  const prompt = buildCountryDraftPrompt(country, { groundingSnippets: tooFewSnippets });

  assert.doesNotMatch(prompt, /Research snippets/);
  assert.match(prompt, /Do not include opening hours, ticket prices, exact transport times, closures, source URLs/);
});

test("country starter map chat prompt also switches to a grounded variant when Exa snippets are supplied", () => {
  const country = getCountryBySlug("malaysia");
  const groundingSnippets = [
    {
      title: "Tourism Malaysia - Penang",
      url: "https://tourism.gov.my/penang",
      text: "Penang is known for its heritage sites."
    },
    {
      title: "Tourism Johor",
      url: "https://tourism.johor.gov.my/",
      text: "Johor is known for its cultural heritage."
    },
    {
      title: "myPenang",
      url: "https://mypenang.gov.my/",
      text: "Penang heritage zones and street art."
    }
  ];

  const prompt = buildCountryDraftInfluencePrompt({
    country,
    instruction: "Focus on Penang heritage sites.",
    currentDraft: null,
    groundingSnippets
  });

  assert.match(prompt, /Research snippets \(from an external search API, not your own memory\)/);
  assert.match(prompt, /https:\/\/tourism\.gov\.my\/penang/);
  assert.match(prompt, /Never invent a URL that is not one of the snippet URLs listed above/);
});

test("normalizeCountryDraftPayload upgrades confidence to likely only when sourceUrl matches a grounding snippet", () => {
  const country = getCountryBySlug("malaysia");
  const groundingSnippets = [
    { title: "Official Penang guide", url: "https://tourism.gov.my/penang", text: "Penang heritage." },
    { title: "Tourism Johor", url: "https://tourism.johor.gov.my/", text: "Johor culture." },
    { title: "myPenang", url: "https://mypenang.gov.my/", text: "Penang heritage zones." }
  ];

  const draft = normalizeCountryDraftPayload(
    {
      summary: "Grounded research scaffold for Malaysia.",
      regions: [
        {
          name: "Penang",
          kind: "state",
          why: "Heritage sites referenced by an official tourism source.",
          confidence: "likely",
          sourceUrl: "https://tourism.gov.my/penang"
        },
        {
          name: "Made Up Place",
          kind: "city",
          why: "Not actually supported by any snippet.",
          confidence: "likely",
          sourceUrl: "https://not-a-real-grounding-source.example.com/fake"
        }
      ],
      themes: [
        {
          label: "Heritage",
          note: "Backed by the Penang snippet.",
          confidence: "likely",
          sourceUrl: "https://tourism.gov.my/penang"
        }
      ]
    },
    country,
    { generatedAt: "2026-07-06T00:00:00.000Z", model: "test-model", groundingSnippets }
  );

  const penang = draft.regions.find((region) => region.name === "Penang");
  const madeUp = draft.regions.find((region) => region.name === "Made Up Place");

  assert.equal(penang.confidence, "likely");
  assert.equal(penang.sourceUrl, "https://tourism.gov.my/penang");

  assert.equal(madeUp.confidence, "unconfirmed");
  assert.equal(madeUp.sourceUrl, null);

  assert.equal(draft.themes[0].confidence, "likely");
  assert.equal(draft.themes[0].sourceUrl, "https://tourism.gov.my/penang");

  assert.equal(draft.sourceType, "exa_grounded");
  assert.equal(draft.confidence, "unconfirmed", "grounded facts stay 'likely' at most; the overall draft never becomes 'confirmed' automatically");
  assert.ok(draft.warnings.some((warning) => /third-party search results/.test(warning)));
});

test("normalizeCountryDraftPayload does not upgrade confidence when fewer than 3 grounding snippets are available", () => {
  const country = getCountryBySlug("malaysia");
  const tooFewSnippets = [
    { title: "Official Penang guide", url: "https://tourism.gov.my/penang", text: "Penang heritage." }
  ];

  const draft = normalizeCountryDraftPayload(
    {
      summary: "Thin research scaffold for Malaysia.",
      regions: [
        {
          name: "Penang",
          kind: "state",
          why: "Heritage sites referenced by a single source.",
          confidence: "likely",
          sourceUrl: "https://tourism.gov.my/penang"
        }
      ],
      themes: []
    },
    country,
    { generatedAt: "2026-07-06T00:00:00.000Z", model: "test-model", groundingSnippets: tooFewSnippets }
  );

  assert.equal(draft.regions[0].confidence, "unconfirmed");
  assert.equal(draft.regions[0].sourceUrl, null);
  assert.equal(draft.sourceType, "ai_generated");
});

test("normalizeCountryDraftPayload keeps ungrounded drafts on the existing ai_generated path", () => {
  const country = getCountryBySlug("malaysia");
  const draft = normalizeCountryDraftPayload(
    {
      summary: "Plain research scaffold for Malaysia.",
      regions: [
        { name: "Sabah", kind: "state", why: "Nature-focused candidate.", confidence: "unconfirmed" }
      ],
      themes: []
    },
    country,
    { generatedAt: "2026-07-06T00:00:00.000Z", model: "test-model" }
  );

  assert.equal(draft.sourceType, "ai_generated");
  assert.equal(draft.regions[0].sourceUrl, null);
  assert.equal(draft.regions[0].confidence, "unconfirmed");
  assert.deepEqual(draft.warnings, [
    "This is an AI-generated expansion draft, not a curated RoamAtlas country pack.",
    "Generated candidates are not available to verified itinerary or fact flows yet."
  ]);
});

test("confirmed starter maps produce unregistered country-pack draft artifacts", () => {
  const country = getCountryBySlug("malaysia");
  const starterMap = normalizeCountryDraftPayload(
    {
      summary: "Research scaffold for Malaysia.",
      regions: [
        {
          name: "Johor",
          kind: "state",
          why: "Research weekend trip potential.",
          confidence: "unconfirmed"
        }
      ],
      themes: [
        {
          label: "Family Travel",
          note: "Research family-friendly route clusters.",
          confidence: "unconfirmed"
        }
      ]
    },
    country,
    { generatedAt: "2026-07-02T00:00:00.000Z", model: "test-model" }
  );

  const draft = createCountryPackDraftFromStarterMap(starterMap, {
    generatedAt: "2026-07-02T00:00:01.000Z"
  });

  assert.equal(draft.countrySlug, "malaysia");
  assert.equal(draft.status, "pending_source_review");
  assert.equal(draft.confidence, "unconfirmed");
  assert.equal(draft.rootNodeId, "malaysia");
  assert.equal(draft.nodes[0].id, "malaysia");
  assert.equal(draft.nodes[1].id, "malaysia-johor");
  assert.equal(draft.nodes[1].facts[0].sourceType, "ai_generated");
  assert.equal(draft.nodes[1].facts[0].confidence, "unconfirmed");
  assert.match(draft.factBoundary, /not registered as curated data/);
});

test("Malaysia is registered as an actual country pack with unconfirmed starter facts", () => {
  const pack = countryPacks.malaysia;
  const scene = pack.scenes[pack.overviewSceneId];
  const starterMap = createCountryPackStarterMap(pack, {
    generatedAt: "2026-07-02T00:00:00.000Z"
  });

  assert.equal(pack.countrySlug, "malaysia");
  assert.equal(pack.rootNodeId, "malaysia");
  assert.equal(pack.overviewSceneId, "malaysia-overview");
  assert.equal(pack.confidence, "unconfirmed");
  assert.equal(scene.rootNodeId, "malaysia");
  assert.equal(scene.hotspots.length, 7);
  assert.ok(pack.nodes.malaysia.childIds.includes("malaysia-johor"));
  assert.equal(pack.nodes["malaysia-kuala-lumpur"].facts[0].sourceType, "ai_generated");
  assert.equal(pack.nodes["malaysia-kuala-lumpur"].facts[0].confidence, "unconfirmed");
  assert.ok(
    Object.values(pack.nodes).every((node) =>
      node.facts.every((fact) => fact.confidence !== "confirmed" || fact.sourceType !== "ai_generated")
    )
  );
  assert.match(pack.factBoundary, /actual RoamAtlas explorer route/);
  assert.equal(starterMap.sourceType, "ai_generated");
  assert.equal(starterMap.confidence, "unconfirmed");
  assert.ok(starterMap.regions.every((region) => region.confidence === "unconfirmed"));
  assert.match(
    starterMap.regions.find((region) => region.name === "Kuala Lumpur").why,
    /urban gateway chapter/
  );
  assert.doesNotMatch(
    starterMap.regions.find((region) => region.name === "Kuala Lumpur").why,
    /starter RoamAtlas graph|needs source review|replace this note/i
  );
  assert.ok(starterMap.themes.some((theme) => theme.label === "State"));
  assert.ok(starterMap.themes.some((theme) => theme.label === "City"));
  assert.ok(
    starterMap.themes.every(
      (theme) => !["Unconfirmed", "Starter Map", "Malaysia", "Overview"].includes(theme.label)
    )
  );

  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      countrySlug: "malaysia",
      sceneId: "malaysia-overview",
      nodeId: "malaysia",
      imageUrl: null,
      parentId: null,
      parentClick: null,
      status: "ready"
    },
    normalizedClick: { x: 0.16, y: 0.38 },
    scenes: pack.scenes,
    nodes: pack.nodes,
    sceneArtwork: {}
  });

  assert.equal(result.click.nodeId, "malaysia-kuala-lumpur");
  assert.equal(result.page.plan.factMode, "unconfirmed");
  assert.match(result.page.plan.visualContext, /Do not invent named attractions/);
  assert.match(result.page.plan.visualContext, /Use the supplied page title/);
});

test("country packs load source data dynamically instead of hardcoding every pack", () => {
  const registrySource = readFileSync(new URL("../src/data/countryPacks/index.js", import.meta.url), "utf8");
  const packFiles = readdirSync(new URL("../src/data/countryPacks/", import.meta.url));
  const malaysiaSource = readFileSync(new URL("../src/data/countryPacks/malaysia.json", import.meta.url), "utf8");
  const singaporeSource = readFileSync(new URL("../src/data/countryPacks/singapore.json", import.meta.url), "utf8");
  const malaysiaData = JSON.parse(malaysiaSource);
  const singaporeData = JSON.parse(singaporeSource);
  const scene = countryPacks.malaysia.scenes["malaysia-overview"];

  assert.match(registrySource, /loadCountryPacksFromDirectory/);
  assert.match(registrySource, /compileCountryPackData/);
  assert.doesNotMatch(registrySource, /malaysiaCountryPack/);
  assert.doesNotMatch(registrySource, /loadJsCountryPack/);
  assert.ok(packFiles.includes("malaysia.json"));
  assert.ok(packFiles.includes("singapore.json"));
  assert.ok(!packFiles.includes("malaysia.js"));
  assert.ok(!packFiles.includes("singapore.js"));
  assert.equal(malaysiaData.countrySlug, "malaysia");
  assert.equal(singaporeData.countrySlug, "singapore");
  assert.equal(singaporeData.graphSource, undefined);
  assert.ok(singaporeData.nodes.singapore);
  assert.ok(singaporeData.scenes["singapore-overview"]);
  assert.equal(singaporeData.scenes["singapore-overview"].ambientLayers.length, 4);
  assert.equal(singaporeData.scenes["singapore-overview"].cameraPresets[0].id, "overview");
  assert.match(singaporeData.scenes["singapore-overview"].visualContext, /Singapore overview/);
  assert.deepEqual(
    singaporeData.scenes["singapore-overview"].hotspots
      .filter((hotspot) => hotspot.mapNumber)
      .map((hotspot) => [hotspot.label, hotspot.mapNumber]),
    [
      ["NTU / NUS", 1],
      ["Marina Bay", 2],
      ["Heritage Belt", 3],
      ["Nature", 6],
      ["Changi", 5],
      ["Sentosa", 4]
    ]
  );
  assert.equal(malaysiaData.scenes["malaysia-overview"].ambientLayers.length, 4);
  assert.equal(malaysiaData.scenes["malaysia-overview"].cameraPresets[0].id, "overview");
  assert.deepEqual(
    scene.ambientLayers.map((layer) => layer.kind),
    ["light", "cloud", "water", "foliage"]
  );
  assert.equal(scene.cameraPresets[0].targetBounds.width, scene.coordinateSpace.width);
});

test("Singapore country pack can be projected into the starter map storage shape", () => {
  const starterMap = createCountryPackStarterMap(countryPacks.singapore, {
    generatedAt: "2026-07-02T00:00:00.000Z"
  });

  assert.equal(starterMap.countrySlug, "singapore");
  assert.equal(starterMap.mode, "curated_pack_snapshot");
  assert.equal(starterMap.sourceType, "curated");
  assert.equal(starterMap.confidence, "confirmed");
  assert.ok(starterMap.regions.some((region) => region.name === "Marina Bay and Civic District"));

  const marinaBay = starterMap.regions.find((region) => region.name === "Marina Bay and Civic District");
  assert.ok(Array.isArray(marinaBay.children));
  assert.ok(marinaBay.children.length > 0);
  const gardens = marinaBay.children.find((child) => child.name === "Gardens by the Bay");
  assert.ok(gardens, "region children should include curated child nodes");
  assert.equal(gardens.kind, "attraction");
  assert.equal(gardens.confidence, "confirmed");
  assert.ok(
    gardens.children.some((child) => child.name === "Supertree Grove"),
    "nested children should recurse into deeper curated nodes"
  );

  assert.ok(starterMap.themes.length > 0);
  assert.match(starterMap.factBoundary, /source-controlled RoamAtlas country pack/);
  assert.notEqual(starterMap.sourceType, "ai_generated");
});

test("tile cache key changes across fact, prompt, style, and model versions", () => {
  const base = {
    sceneId: "singapore-overview",
    tileId: "overview-r0-c0",
    styleVersion: "atlas-v1",
    dataVersion: "data-v1",
    promptVersion: "prompt-v1",
    imageModel: "gpt-image-2"
  };

  assert.equal(
    buildTileCacheKey(base),
    "scene:singapore-overview:tile:overview-r0-c0:style:atlas-v1:data:data-v1:prompt:prompt-v1:model:gpt-image-2"
  );
  assert.notEqual(
    buildTileCacheKey(base),
    buildTileCacheKey({ ...base, dataVersion: "data-v2" })
  );
  assert.notEqual(
    buildTileCacheKey(base),
    buildTileCacheKey({ ...base, imageModel: "fallback-image-model" })
  );
});

test("image model aliases normalize for OpenAI provider", () => {
  assert.equal(normalizeImageModel("image2"), "gpt-image-2");
  assert.match(DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT, /central 3:2 safe area/);
  assert.match(DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT, /restrained flipbook encyclopedia style/);
  assert.doesNotMatch(DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT, /\bSingapore\b/);
});

test("source config stores non-secret OpenAI model defaults", () => {
  const defaults = resolveRoamAtlasConfig({});
  const withPortOverride = resolveRoamAtlasConfig({ PORT: "5173" });

  assert.equal(ROAMATLAS_CONFIG.image.provider, "openai");
  assert.equal(defaults.image.provider, "openai");
  assert.equal(defaults.image.model, "gpt-image-2");
  assert.equal(defaults.image.fallbackModel, null);
  assert.equal(defaults.image.size, "1536x1024");
  assert.equal(defaults.image.quality, "medium");
  assert.equal(defaults.image.outputFormat, "jpeg");
  assert.equal(defaults.image.outputCompression, 82);
  assert.equal(defaults.server.port, 4150);
  assert.equal(defaults.ai.textModel, "gpt-5.4-mini");
  assert.equal(defaults.ai.vlmModel, "gpt-5.4-mini");
  assert.equal(defaults.ai.environmentModel, "gpt-5.5");
  assert.ok(Object.values(defaults.ai).every((model) => /^gpt-5(?:\.|$|-)/.test(model)));
  assert.equal(withPortOverride.server.port, 5173);
});

test("experience config stores prefetch and parallel job defaults", () => {
  const defaults = resolveRoamAtlasExperienceConfig({});
  const withOverrides = resolveRoamAtlasExperienceConfig({
    ROAMATLAS_LOAD_NEXT_DESTINATIONS_EARLY: "false",
    ROAMATLAS_MAX_PARALLEL_IMAGE_JOBS: "4",
    ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK: "true"
  });

  assert.equal(ROAMATLAS_EXPERIENCE_CONFIG.maxParallelImageJobs, 10);
  assert.equal(ROAMATLAS_EXPERIENCE_CONFIG.providerConcurrency, 10);
  assert.equal(ROAMATLAS_EXPERIENCE_CONFIG.prefetchDestinationLimit, 10);
  assert.equal(defaults.loadNextDestinationsEarly, true);
  assert.equal(defaults.maxParallelImageJobs, 10);
  assert.equal(defaults.loadCountryPackEarly, false);
  assert.equal(withOverrides.loadNextDestinationsEarly, false);
  assert.equal(withOverrides.maxParallelImageJobs, 4);
  assert.equal(withOverrides.loadCountryPackEarly, true);
});

test("next artwork destinations stay one level deep from the current screen", () => {
  const pack = countryPacks.singapore;
  const overviewScene = pack.scenes["singapore-overview"];
  const targets = listNextArtworkDestinations({
    scene: overviewScene,
    scenes: pack.scenes,
    nodes: pack.nodes,
    currentPage: {
      sceneId: overviewScene.id,
      nodeId: pack.rootNodeId
    },
    limit: 10
  });

  assert.ok(targets.some((target) => target.sceneId === "marina-bay-scroll"));
  assert.ok(targets.some((target) => target.sceneId === "heritage-belt-scroll"));
  assert.equal(targets.length, 6);
  assert.ok(!targets.some((target) => target.nodeId === "singapore-zoo"));

  const marinaScene = pack.scenes["marina-bay-scroll"];
  const marinaTargets = listNextArtworkDestinations({
    scene: marinaScene,
    scenes: pack.scenes,
    nodes: pack.nodes,
    currentPage: {
      sceneId: marinaScene.id,
      nodeId: marinaScene.rootNodeId
    },
    limit: 10
  });
  assert.ok(marinaTargets.some((target) => target.nodeId === "marina-bay-sands"));
  assert.ok(marinaTargets.some((target) => target.nodeId === "gardens-by-the-bay"));
});

test("loading steps follow image job status", () => {
  const queued = resolveLoadingStep({
    job: { status: "pending_codex_image_generation" },
    pageTitle: "Marina Bay"
  });
  const generating = resolveLoadingStep({
    job: { status: "processing_openai_image" },
    pageTitle: "Marina Bay"
  });
  const trail = buildLoadingStepTrail({
    job: { status: "processing_openai_image" },
    pageTitle: "Marina Bay"
  });

  assert.match(queued.message, /Marina Bay/);
  assert.match(queued.detail, /still generating/);
  assert.equal(generating.phase, "generating");
  assert.equal(trail.steps.find((step) => step.state === "active")?.label, "Drawing illustration");
});

test("runtime cache paths live outside the repo and expose stable runtime urls", () => {
  const defaultCacheRoot = resolveRuntimeCacheRoot({
    ROAMATLAS_RUNTIME_CACHE_DIR: ""
  });
  const cacheRoot = resolveRuntimeCacheRoot({
    ROAMATLAS_RUNTIME_CACHE_DIR: "/tmp/roamatlas-test-cache"
  });
  const paths = createRuntimeCachePaths({
    cacheRoot,
    pageId: "node-cloud-forest",
    imageModel: "gpt-image-2",
    countrySlug: "singapore"
  });
  const starterMapPaths = createCountryStarterMapCachePaths({
    cacheRoot,
    countrySlug: "malaysia"
  });
  const singaporeStarterMapPaths = createCountryStarterMapCachePaths({
    cacheRoot,
    countrySlug: "singapore"
  });

  assert.ok(defaultCacheRoot.endsWith("roamatlas-runtime-cache"));
  assert.notEqual(defaultCacheRoot, process.cwd());
  assert.equal(cacheRoot, "/tmp/roamatlas-test-cache");
  assert.equal(paths.countrySlug, "singapore");
  assert.equal(paths.jobUrl, `${RUNTIME_CACHE_URL_PREFIX}/singapore/image-jobs/node-cloud-forest.json`);
  assert.equal(paths.imageUrl, `${RUNTIME_CACHE_URL_PREFIX}/singapore/flipbook/node-cloud-forest.gpt-image-2.png`);
  assert.equal(paths.environmentUrl, `${RUNTIME_CACHE_URL_PREFIX}/singapore/environment/node-cloud-forest.gpt-image-2.json`);
  assert.ok(paths.jobPath.startsWith(cacheRoot));
  assert.ok(paths.imagePath.startsWith(cacheRoot));
  assert.ok(paths.environmentPath.startsWith(cacheRoot));
  assert.ok(paths.jobPath.includes("/singapore/image-jobs/"));
  assert.ok(paths.imagePath.includes("/singapore/flipbook/"));
  assert.ok(paths.environmentPath.includes("/singapore/environment/"));
  assert.equal(starterMapPaths.countrySlug, "malaysia");
  assert.equal(
    starterMapPaths.starterMapUrl,
    `${RUNTIME_CACHE_URL_PREFIX}/malaysia/starter-map/country.json`
  );
  assert.equal(
    starterMapPaths.starterMapConfirmationUrl,
    `${RUNTIME_CACHE_URL_PREFIX}/malaysia/starter-map/confirmation.json`
  );
  assert.equal(
    starterMapPaths.countryPackDraftUrl,
    `${RUNTIME_CACHE_URL_PREFIX}/malaysia/country-pack-draft/country.json`
  );
  assert.ok(starterMapPaths.starterMapPath.includes("/malaysia/starter-map/country.json"));
  assert.equal(
    singaporeStarterMapPaths.starterMapUrl,
    `${RUNTIME_CACHE_URL_PREFIX}/singapore/starter-map/country.json`
  );
});

test("default artwork pre-generation is opt-in for interactive dev speed", () => {
  assert.equal(shouldQueueDefaultArtwork({}), false);
  assert.equal(
    shouldQueueDefaultArtwork({ ROAMATLAS_PREGENERATE_DEFAULT_ARTWORK: "true" }),
    true
  );
});

test("interactive image jobs process before prefetch and artwork jobs", () => {
  const jobs = sortImageJobsForProcessing([
    {
      fileName: "artwork-singapore-overview.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "prewarm",
        createdAt: "2026-05-09T01:00:00.000Z"
      }
    },
    {
      fileName: "node-gardens-by-the-bay.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "prefetch",
        createdAt: "2026-05-09T01:10:00.000Z"
      }
    },
    {
      fileName: "node-cloud-forest.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "interactive",
        createdAt: "2026-05-09T02:00:00.000Z"
      }
    },
    {
      fileName: "artwork-marina-bay-scroll.json",
      job: {
        status: "pending_codex_image_generation",
        jobKind: "artwork",
        createdAt: "2026-05-09T01:30:00.000Z"
      }
    }
  ]);

  assert.deepEqual(
    jobs.map((item) => item.fileName),
    [
      "node-cloud-forest.json",
      "node-gardens-by-the-bay.json",
      "artwork-marina-bay-scroll.json",
      "artwork-singapore-overview.json"
    ]
  );
});

test("viewport clicks convert into scene coordinates", () => {
  const point = viewportToScenePoint({
    viewportX: 200,
    viewportY: 120,
    camera: { x: 500, y: 300, zoom: 2 }
  });

  assert.deepEqual(point, { x: 600, y: 360 });
});

test("overlapping hotspots resolve by highest zIndex", () => {
  const hotspots = [
    {
      id: "region",
      zIndex: 1,
      shape: { x: 0, y: 0, width: 300, height: 300 }
    },
    {
      id: "poi",
      zIndex: 5,
      shape: { x: 100, y: 100, width: 80, height: 80 }
    }
  ];

  assert.equal(findTopmostHotspot(hotspots, { x: 120, y: 120 }).id, "poi");
  assert.equal(findTopmostHotspot(hotspots, { x: 20, y: 20 }).id, "region");
  assert.equal(findTopmostHotspot(hotspots, { x: 400, y: 400 }), null);
});

test("Singapore overview Heritage Belt hit area resolves only to Heritage Belt", () => {
  const scene = scrollScenes["singapore-overview"];
  const heritage = scene.hotspots.find((item) => item.nodeId === "heritage-belt-scroll");
  assert.ok(heritage);

  const point = {
    x: heritage.shape.x + heritage.shape.width / 2,
    y: heritage.shape.y + heritage.shape.height / 2
  };
  assert.equal(findTopmostHotspot(scene.hotspots, point).nodeId, "heritage-belt-scroll");
});

test("scene transitions preserve the selected known node", () => {
  const hotspot = scrollScenes["singapore-overview"].hotspots.find(
    (item) => item.nodeId === "nature-wildlife-scroll"
  );

  const result = resolveHotspotAction({
    hotspot,
    scenes: scrollScenes,
    currentSelectedNodeId: "singapore"
  });

  assert.equal(result.kind, "enter_scene");
  assert.equal(result.sceneId, "nature-wildlife-scroll");
  assert.equal(result.selectedNodeId, "nature-wildlife-scroll");
});

test("scene transition history can restore the previous scene", () => {
  const history = [];
  const current = { sceneId: "singapore-overview", nodeId: null };
  const hotspot = scrollScenes["singapore-overview"].hotspots.find(
    (item) => item.nodeId === "nature-wildlife-scroll"
  );
  const next = resolveHotspotAction({
    hotspot,
    scenes: scrollScenes,
    currentSelectedNodeId: current.nodeId
  });

  history.push(current);
  const restored = history.pop();

  assert.equal(next.sceneId, "nature-wildlife-scroll");
  assert.deepEqual(restored, { sceneId: "singapore-overview", nodeId: null });
});

test("missing tiles do not block factual node display", () => {
  const scene = scrollScenes["singapore-overview"];

  assert.ok(getMissingTiles(scene).length > 0);
  assert.ok(scene.hotspots.length > 0);
  assert.ok(atlasNodes[scene.rootNodeId].facts.length > 0);
});

test("scene images can render image-specific ambient environment overlays", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const singaporeLayerKinds = new Set(scrollScenes["singapore-overview"].ambientLayers.map((layer) => layer.kind));
  const malaysiaLayerKinds = new Set(
    countryPacks.malaysia.scenes["malaysia-overview"].ambientLayers.map((layer) => layer.kind)
  );

  for (const kind of ["light", "cloud", "water", "foliage"]) {
    assert.ok(singaporeLayerKinds.has(kind));
    assert.ok(malaysiaLayerKinds.has(kind));
    assert.match(styles, new RegExp(`environment-layer--${kind}`));
  }
  for (const kind of ["marine_life", "birds"]) {
    assert.match(styles, new RegExp(`environment-layer--${kind}`));
  }
  assert.match(appSource, /renderEnvironmentLayerNodes/);
  assert.match(appSource, /requestEnvironmentPlan/);
  assert.match(appSource, /environmentUrl/);
  assert.match(appSource, /image-plan-atmosphere-code-replacement/);
  assert.match(appSource, /renderAtmosphereLayer/);
  assert.match(appSource, /getAtmosphereProfile/);
  assert.match(appSource, /renderWaterZone/);
  assert.match(appSource, /renderMarineAtmosphere/);
  assert.match(appSource, /getNormalizedEnvironmentBounds/);
  assert.match(appSource, /isRenderableEnvironmentLayer/);
  assert.match(appSource, /renderEnvironmentParticleMarkup/);
  assert.match(appSource, /isSafeFallbackEnvironmentLayer/);
  assert.match(appSource, /createEnvironmentParticles/);
  assert.match(appSource, /environmentParticleDuration/);
  assert.match(styles, /--scene-art-width/);
  assert.match(styles, /--scene-art-height/);
  assert.match(styles, /atmosphere-layer/);
  assert.match(styles, /atmosphere-water-field/);
  assert.match(styles, /atmosphere-water-zone/);
  assert.match(styles, /atmosphere-water-glint/);
  assert.match(styles, /atmosphere-shoreline/);
  assert.match(styles, /atmosphere-breeze/);
  assert.match(styles, /atmosphere-cloud-bank/);
  assert.match(styles, /atmosphere-cloud-bank-drift/);
  assert.match(styles, /atmosphere-cloud-wisp/);
  assert.match(styles, /atmosphere-bird/);
  assert.match(styles, /atmosphere-dolphin/);
  assert.match(styles, /ambient-svg/);
  assert.match(styles, /ambient-water-line/);
  assert.match(styles, /ambient-wingbeat/);
  assert.match(styles, /overflow: visible/);
  assert.match(styles, /ambient-marine-jump/);
  assert.match(styles, /ambient-bird/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("image click resolver matches clicks through the curated scene graph", () => {
  const result = resolveImageClick({
    scene: scrollScenes["singapore-overview"],
    point: { x: 1400, y: 130 },
    nodes: atlasNodes
  });

  assert.equal(result.status, "matched");
  assert.equal(result.nodeId, "heritage-belt-scroll");
  assert.equal(result.action.type, "enter_scene");
});

test("overview includes static demo hotspots across west, east, and north Singapore", () => {
  const overview = scrollScenes["singapore-overview"];
  const hotspotNodeIds = overview.hotspots.map((hotspot) => hotspot.nodeId);

  assert.ok(hotspotNodeIds.includes("west-campus-scroll"));
  assert.ok(hotspotNodeIds.includes("changi-east-scroll"));
  assert.ok(hotspotNodeIds.includes("singapore-zoo"));
  assert.ok(atlasNodes["west-campus-scroll"].childIds.includes("nus"));
  assert.ok(atlasNodes["west-campus-scroll"].childIds.includes("ntu"));
  assert.ok(atlasNodes["changi-east-scroll"].childIds.includes("changi-airport"));
});

test("overview hotspot geometry matches Changi and Wildlife positions in the demo art", () => {
  const overview = scrollScenes["singapore-overview"];
  const changi = resolveImageClick({
    scene: overview,
    point: { x: 1450, y: 250 },
    nodes: atlasNodes
  });
  const wildlife = resolveImageClick({
    scene: overview,
    point: { x: 250, y: 330 },
    nodes: atlasNodes
  });

  assert.equal(changi.nodeId, "changi-east-scroll");
  assert.equal(wildlife.nodeId, "nature-wildlife-scroll");
});

test("image click resolver returns unmapped for unknown image regions", () => {
  const result = resolveImageClick({
    scene: scrollScenes["singapore-overview"],
    point: { x: 20, y: 20 },
    nodes: atlasNodes
  });

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);
});

test("clickable region precompute keeps the candidate set small", () => {
  const regions = precomputeClickableRegions(scrollScenes["singapore-overview"], 3);

  assert.equal(regions.length, 3);
  assert.ok(regions.every((region) => region.nodeId));
});

test("VLM click phrase must match curated candidates before becoming verified", () => {
  const result = matchClickPhraseToNode({
    phrase: "lush wildlife nature reserve with forest paths",
    candidates: scrollScenes["singapore-overview"].hotspots,
    nodes: atlasNodes
  });

  assert.equal(result.status, "matched");
  assert.equal(result.nodeId, "nature-wildlife-scroll");
});

test("unmatched VLM phrase remains unmapped", () => {
  const result = matchClickPhraseToNode({
    phrase: "floating moon castle",
    candidates: scrollScenes["singapore-overview"].hotspots,
    nodes: atlasNodes
  });

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);
});

test("unmapped visible buildings do not get forced into nearby curated Marina nodes", () => {
  const result = matchClickPhraseToNode({
    phrase: "The Fullerton Hotel building",
    candidates: scrollScenes["marina-bay-scroll"].hotspots,
    nodes: atlasNodes
  });

  assert.equal(result.status, "unmapped");
  assert.equal(result.nodeId, null);
});

test("image prompt builder enforces planning-board style and avoids dense atlas cues", () => {
  const prompt = buildRoamAtlasImagePrompt({
    nodeTitle: "Marina Bay",
    visualContext: "Gardens by the Bay waterfront",
    density: "sparse"
  });

  assert.match(prompt, /urban planning proposal board/);
  assert.match(prompt, /Density: minimal/);
  assert.match(prompt, /Readable image text is allowed|short readable labels/);
  assert.match(prompt, /crowded travel atlas/);
});

test("homepage prompt is a sparse flipbook visual table of contents", () => {
  const output = buildHomepagePrompt({
    nodeId: "singapore",
    nodeTitle: "Singapore",
    pageType: "homepage_overview",
    zoomLevel: 0,
    visualContext: "Singapore entry page",
    knownChildNodeTitles: ["Marina Bay", "Heritage Belt", "Sentosa", "Mandai"]
  });

  assert.equal(output.promptVersion, "roamatlas-flipbook-v6-fast-focus");
  assert.match(output.prompt, /visual table of contents/);
  assert.match(output.prompt, /5 to 7 major anchor clusters/);
  assert.match(output.prompt, /35% of the image visually open/);
  assert.match(output.prompt, /Do not fully render all of Singapore/);
  assert.match(output.prompt, /Readable image text is allowed/);
  assert.match(output.prompt, /central 3:2 safe area/);
  assert.match(output.prompt, /dense tourist map/);
  assert.match(output.prompt, /busy panoramic city poster/);
  assert.match(output.prompt, /Do not draw dense road networks/);
});

test("Malaysia image prompts do not leak Singapore or app branding", () => {
  const homepage = buildHomepagePrompt({
    nodeId: "malaysia",
    nodeTitle: "Malaysia",
    pageType: "homepage_overview",
    zoomLevel: 0,
    countryName: "Malaysia",
    visualContext: "Malaysia starter page",
    knownChildNodeTitles: ["Kuala Lumpur", "Penang", "Langkawi", "Johor"]
  });
  const region = buildRegionPrompt({
    nodeId: "malaysia-kuala-lumpur",
    nodeTitle: "Kuala Lumpur",
    pageType: "region_overview",
    zoomLevel: 1,
    countryName: "Malaysia",
    visualContext: "city core and heritage district",
    knownChildNodeTitles: ["parks", "waterfront"]
  });
  const encyclopedia = buildEncyclopediaPrompt({
    nodeId: "melaka-red-facade-building",
    nodeTitle: "Melaka red facade building",
    pageType: "architectural_detail",
    zoomLevel: 3,
    countryName: "Malaysia",
    visualContext: "one red facade building study plate"
  });
  const combined = [homepage.prompt, region.prompt, encyclopedia.prompt].join("\n");

  assert.match(combined, /Malaysia/);
  assert.match(homepage.prompt, /Do not fully render all of Malaysia/);
  assert.doesNotMatch(combined, /\bSingapore\b/);
  assert.doesNotMatch(combined, /\bRoamAtlas\b/);
  assert.doesNotMatch(combined, /WanderSG|Wander SG/i);
});

test("region prompt focuses one region and puts short labels in the generated image", () => {
  const output = buildRegionPrompt({
    nodeId: "marina-bay-scroll",
    nodeTitle: "Marina Bay",
    pageType: "region_overview",
    zoomLevel: 1,
    visualContext: "waterfront gardens and civic district",
    knownChildNodeTitles: ["Gardens by the Bay", "Merlion Park"]
  });

  assert.match(output.prompt, /one region only/);
  assert.match(output.prompt, /not the whole city/);
  assert.match(output.prompt, /image itself should include short readable labels/);
  assert.match(output.prompt, /central 3:2 safe area/);
  assert.match(output.prompt, /callout panels|short readable labels/);
  assert.match(output.prompt, /No prices|No hours|No route times/);
});

test("encyclopedia prompt creates explanatory visual plates with constrained image text", () => {
  const output = buildEncyclopediaPrompt({
    nodeId: "supertree-detail",
    nodeTitle: "Supertree Structure",
    pageType: "architectural_detail",
    zoomLevel: 3,
    visualContext: "one Supertree cutaway with canopy, trunk, and planting layers"
  });

  assert.match(output.prompt, /illustrated encyclopedia plate/);
  assert.match(output.prompt, /One main subject only/);
  assert.match(output.prompt, /cutaway, exploded view, sectional view/);
  assert.match(output.prompt, /Readable image text is allowed/);
  assert.match(output.prompt, /central 3:2 safe area/);
  assert.match(output.prompt, /No prices|No hours|No route times/);
  assert.match(output.prompt, /blank callout panels|numbered anchor dots|leader lines/);
});

test("central prompt router sends page depths to the right builders", () => {
  const homepage = buildPromptOutput({
    nodeId: "singapore",
    nodeTitle: "Singapore",
    pageType: "region_overview",
    zoomLevel: 0,
    visualContext: "overview"
  });
  const region = buildPromptOutput({
    nodeId: "marina-bay-scroll",
    nodeTitle: "Marina Bay",
    pageType: "district_or_attraction",
    zoomLevel: 2,
    visualContext: "focused waterfront chapter"
  });
  const encyclopedia = buildPromptOutput({
    nodeId: "giraffe",
    nodeTitle: "Giraffe",
    pageType: "natural_history_detail",
    zoomLevel: 3,
    visualContext: "natural history plate"
  });

  assert.equal(homepage.pageType, "homepage_overview");
  assert.match(homepage.prompt, /visual table of contents/);
  assert.equal(region.pageType, "district_or_attraction");
  assert.match(region.prompt, /one region only/);
  assert.equal(encyclopedia.pageType, "natural_history_detail");
  assert.match(encyclopedia.prompt, /illustrated encyclopedia plate/);
});

test("page planner shifts verified nodes into deeper encyclopedia pages", () => {
  const plan = planNextFlipbookPage({
    currentNode: atlasNodes.singapore,
    matchedNode: atlasNodes["gardens-by-the-bay"],
    clickedPhrase: "glass garden domes"
  });

  assert.equal(plan.factMode, "verified");
  assert.equal(plan.nextNodeId, "gardens-by-the-bay");
  assert.equal(plan.pageType, "district_or_attraction");
  assert.equal(plan.zoomLevel, 2);
  assert.match(plan.imagePrompt, /illustrated encyclopedia plate|architectural (?:visual )?encyclopedia/);
});

test("page planner keeps unmatched clicks as unverified detours", () => {
  const plan = planNextFlipbookPage({
    currentNode: atlasNodes.singapore,
    matchedNode: null,
    clickedPhrase: "mysterious floating garden"
  });

  assert.equal(plan.factMode, "unverified_detour");
  assert.equal(plan.nextNodeId, null);
  assert.equal(plan.pageType, "ai_detour");
  assert.ok(plan.imagePrompt);
});

test("page planner turns fine-grained detours into encyclopedia plates", () => {
  const plan = planNextFlipbookPage({
    currentNode: atlasNodes["marina-bay-scroll"],
    matchedNode: null,
    clickedPhrase: "ferry boat"
  });

  assert.equal(plan.factMode, "unverified_detour");
  assert.equal(plan.pageType, "ai_detour");
  assert.equal(plan.zoomLevel, 3);
  assert.match(plan.visualContext, /focused unverified encyclopedia plate/);
  assert.match(plan.imagePrompt, /illustrated encyclopedia plate/);
  assert.match(plan.imagePrompt, /One main subject only/);
  assert.doesNotMatch(plan.imagePrompt, /one region only/);
});

test("scene artwork registry does not reuse old public generated images", () => {
  assert.deepEqual(sceneArtwork, {});
  assert.equal(getSceneArtwork("singapore-overview"), null);
  assert.equal(getSceneArtwork("unknown-scene"), null);
});

test("frontend homepage requests runtime artwork without hardcoded local host", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /overview-codex-local\.png/);
  assert.doesNotMatch(appSource, /127\.0\.0\.1:4173/);
  assert.match(appSource, /requestSceneArtwork/);
  assert.match(appSource, /renderRegionRail/);
  assert.match(appSource, /renderLoadingSceneBoard/);
  assert.match(appSource, /loading-destination-grid/);
  assert.match(appSource, /loading-destination-card/);
  assert.match(appSource, /buildImmediatePageFromTarget/);
  assert.match(appSource, /buildImmediatePageFromClick/);
  assert.match(appSource, /resolveFlipbookClick/);
  assert.match(appSource, /targetNodeId: target\.nodeId/);
  assert.match(appSource, /getPrefetchTargetState/);
  assert.match(appSource, /region-rail-progress/);
  assert.match(appSource, /getHotspotMapNumber/);
  assert.match(appSource, /region-rail-number/);
  assert.match(styleSource, /\.region-rail-number/);
  assert.match(appSource, /renderRegionRailCheck/);
  assert.match(appSource, /prefetchJobs/);
  assert.match(appSource, /renderLoadingPanel/);
  assert.match(appSource, /import \{ buildLoadingStepTrail \} from "\.\.\/domain\/loadingSteps\.js";/);
  assert.match(appSource, /mergePrefetchedArtwork/);
  assert.match(appSource, /loadExperienceConfig/);
  assert.match(appSource, /requestCurrentPageArtwork/);
  assert.match(appSource, /canCurrentPageUseSceneArtwork/);
  assert.match(appSource, /getPageArtworkJobKey/);
  assert.match(appSource, /pollCurrentPageArtworkJob/);
  assert.match(styleSource, /\.region-rail-item--loading \.region-rail-progress/);
  assert.match(styleSource, /\.loading-scene-board/);
  assert.match(styleSource, /\.loading-destination-grid/);
  assert.match(styleSource, /\.loading-destination-card--loading \.loading-destination-progress/);
  assert.match(styleSource, /\.region-rail-check/);
  assert.match(styleSource, /--prefetch-progress/);
  assert.match(appSource, /nodeId: page\.nodeId/);
  assert.match(appSource, /params\.set\("priority", "interactive"\)/);
  assert.match(appSource, /apiPath\("\/api\/flipbook\/click"\)/);
  assert.match(appSource, /getCurrentRequestPage/);
  assert.match(appSource, /setBrowserPath\(canonicalRouteForNode/);
  assert.match(appSource, /enterCountryShell/);
  assert.match(appSource, /routeForCountryConfig/);
  assert.match(appSource, /route\.type === "country_needs_config"/);
});

test("country shell uses starter map wording instead of generated draft wording", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(appSource, /Back to countries/);
  assert.match(appSource, /Reset Generated Visuals/);
  assert.match(appSource, /Rebuild starter info/);
  assert.match(appSource, /renderDraftResetButton/);
  assert.match(appSource, /renderResetIcon/);
  assert.match(appSource, /draft-tool-menu-button/);
  assert.match(appSource, /draft-tool-menu-dots/);
  assert.match(appSource, /toggle-starter-tools/);
  assert.match(appSource, /countryDraftToolMenuOpen/);
  assert.match(appSource, /if \(action === "toggle-starter-tools"[\s\S]*captureCountryShellScroll\(\)[\s\S]*restoreCountryShellScroll\(scrollSnapshot\)/);
  assert.match(appSource, /<strong>Rebuild starter info<\/strong>/);
  assert.match(appSource, /draft-button-tooltip-title/);
  assert.match(appSource, /Action guide/);
  assert.match(appSource, /toggle-action-guide/);
  assert.match(appSource, /countryActionLegendOpen/);
  assert.match(appSource, /aria-expanded/);
  assert.match(appSource, /renderCountryActionGuide/);
  assert.match(appSource, /renderCountryActionLegend/);
  assert.match(appSource, /Refresh regions, summary, and themes/);
  assert.match(appSource, /Clear cached thumbnails and search again/);
  assert.match(appSource, /preserveScroll: true/);
  assert.match(appSource, /data-country-draft-section-tab/);
  assert.match(appSource, /countryDraftSectionTabs\.set\(state\.selectedCountry\.slug, sectionTab\)/);
  assert.match(appSource, /restoreCountryShellScroll\(scrollSnapshot\)/);
  assert.match(appSource, /reset-generated-visuals/);
  assert.match(appSource, /reset-metadata/);
  assert.match(appSource, /reset-reference-photos/);
  assert.match(appSource, /Reset photos/);
  assert.match(appSource, /requestPlaceImageReset/);
  assert.match(appSource, /\/api\/place-image\/reset/);
  assert.match(styleSource, /\.draft-tool-menu/);
  assert.match(styleSource, /\.draft-tool-menu-dots/);
  assert.match(styleSource, /\.draft-tool-menu-item/);
  assert.match(appSource, /AI starter map/);
  assert.match(appSource, /Edit starter map/);
  assert.match(appSource, /data-country-chat-form/);
  assert.match(appSource, /\/api\/country-draft\/influence/);
  assert.match(appSource, /Confirm for curation/);
  assert.match(appSource, /\/api\/country-draft\/confirm/);
  assert.match(appSource, /Resetting/);
  assert.doesNotMatch(appSource, /Starter country pack/);
  assert.doesNotMatch(appSource, /This starter map comes from source-controlled starter data/);
  assert.match(appSource, /Source-reviewed country pack/);
  assert.match(appSource, /requestCountryRuntimeCacheFlush\(state\.selectedCountry, \{ confirm: false, scope: "visuals" \}\)/);
  assert.match(appSource, /\/api\/runtime-cache\/flush/);
  assert.match(appSource, /clearCountryGeneratedState/);
  assert.match(appSource, /loadStoredCountryDraft/);
  assert.match(appSource, /showAppToast/);
  assert.match(appSource, /Generated visuals reset/);
  assert.match(appSource, /Generated visuals were not reset/);
  assert.match(appSource, /reference photos were kept/);
  assert.match(appSource, /Success/);
  assert.match(appSource, /Failed/);
  assert.match(styleSource, /\.app-toast-region/);
  assert.match(styleSource, /\.app-toast/);
  assert.match(styleSource, /\.app-toast-icon/);
  assert.match(styleSource, /\.app-toast--success/);
  assert.match(styleSource, /\.app-toast--error/);
});

test("starter-map approve tick promotes regions with guardrails", () => {
  const draft = {
    regions: [
      {
        name: "Johor",
        kind: "state",
        why: "Southern gateway region.",
        confidence: "unconfirmed"
      },
      {
        name: "Penang",
        kind: "region",
        why: "Heritage coast.",
        confidence: "unconfirmed",
        sourceUrl: "https://tourism.gov.my/penang"
      }
    ],
    themes: []
  };

  const approvedWithoutSource = approveDraftItem(draft, "region:Johor");
  assert.equal(approvedWithoutSource.item.confidence, "confirmed");
  assert.equal(approvedWithoutSource.item.reviewStatus, "human_approved");
  assert.equal(isDraftItemApproved(approvedWithoutSource.item), true);

  const approvedWithSource = approveDraftItem(draft, "region:Penang");
  assert.equal(approvedWithSource.item.confidence, "confirmed");

  const unapproved = unapproveDraftItem(draft, "region:Johor");
  assert.equal(unapproved.item.confidence, "unconfirmed");
  assert.equal(unapproved.item.reviewStatus, undefined);
});

test("nested starter-map nodes support individual and parent-level curation", () => {
  const draft = {
    regions: [
      {
        name: "Penang",
        kind: "region",
        confidence: "unconfirmed",
        children: [
          {
            name: "George Town",
            kind: "area",
            confidence: "unconfirmed",
            children: [{ name: "Armenian Street", kind: "area", confidence: "unconfirmed" }]
          }
        ]
      },
      {
        name: "Langkawi",
        kind: "region",
        confidence: "confirmed",
        children: [{ name: "Sky Bridge", kind: "attraction", confidence: "confirmed" }]
      }
    ],
    themes: []
  };

  const individuallyApproved = approveDraftItem(draft, "node:1.1");
  assert.equal(individuallyApproved.item.name, "George Town");
  assert.equal(individuallyApproved.item.confidence, "confirmed");
  assert.equal(draft.regions[0].children[0].children[0].confidence, "unconfirmed");

  approveDraftItem(draft, "node:1", { recursive: true });
  assert.equal(draft.regions[0].children[0].confidence, "confirmed");
  assert.equal(draft.regions[0].children[0].children[0].confidence, "confirmed");

  unapproveDraftItem(draft, "node:1", { recursive: true });
  assert.equal(draft.regions[0].children[0].confidence, "unconfirmed");
  assert.equal(draft.regions[0].children[0].children[0].confidence, "unconfirmed");
  assert.equal(draft.regions[1].confidence, "confirmed");
  assert.equal(draft.regions[1].children[0].confidence, "confirmed");
});

test("source-reviewed region suggestions append only unconfirmed new children", () => {
  const draft = {
    regions: [
      {
        name: "West Campus and Gardens",
        kind: "region",
        confidence: "confirmed",
        children: [{ name: "NUS", kind: "attraction", confidence: "confirmed" }]
      },
      {
        name: "Marina Bay and Civic District",
        kind: "region",
        confidence: "confirmed",
        children: [{ name: "Merlion Park", kind: "attraction", confidence: "confirmed" }]
      }
    ]
  };
  const proposed = {
    regions: [
      {
        name: "West Campus and Gardens",
        kind: "region",
        children: [{ name: "JEM", kind: "attraction", confidence: "likely" }]
      }
    ]
  };

  const result = appendUnconfirmedRegionCandidates(draft, "West Campus and Gardens", proposed);

  assert.equal(result.changed, true);
  assert.deepEqual(draft.regions[0].children.map((item) => [item.name, item.confidence]), [
    ["NUS", "confirmed"],
    ["JEM", "unconfirmed"]
  ]);
  assert.deepEqual(draft.regions[1].children.map((item) => item.name), ["Merlion Park"]);
});

test("draft tree reserves controls for nested curation without wrapping the delete button", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(appSource, /approve-draft-descendants/);
  assert.match(appSource, /data-draft-path/);
  assert.match(appSource, /edit-draft-candidate/);
  assert.match(appSource, /showAppToast\(\{\s*tone: "error",\s*title: "Curation update failed"/);
  assert.match(styleSource, /grid-template-columns: auto auto auto minmax\(0, 1fr\) auto auto auto auto/);
  assert.match(styleSource, /grid-template-columns: auto minmax\(0, 1fr\) auto auto auto/);
  assert.match(styleSource, /\.draft-descendant-approval \{[\s\S]*height: 24px/);
});

test("starter-map normalization preserves earlier reviewer approvals", () => {
  const country = { code: "AL", slug: "albania", name: "Albania" };
  const draft = normalizeCountryDraftPayload(
    {
      regions: [
        {
          name: "Northern Albania",
          kind: "region",
          why: "A mountain chapter.",
          reviewStatus: "human_approved",
          reviewedAt: "2026-07-15T00:00:00.000Z"
        }
      ],
      themes: []
    },
    country
  );

  assert.equal(draft.regions[0].reviewStatus, "human_approved");
  assert.equal(draft.regions[0].confidence, "confirmed");
});

test("starter-map normalization preserves nested curated nodes", () => {
  const country = { code: "MY", slug: "malaysia", name: "Malaysia" };
  const draft = normalizeCountryDraftPayload(
    {
      regions: [
        {
          name: "Penang",
          kind: "region",
          reviewStatus: "human_approved",
          children: [{ name: "George Town", kind: "area", reviewStatus: "human_approved" }]
        }
      ],
      themes: []
    },
    country
  );

  assert.equal(draft.regions[0].confidence, "confirmed");
  assert.equal(draft.regions[0].children[0].name, "George Town");
  assert.equal(draft.regions[0].children[0].confidence, "confirmed");
});

test("dev server treats missing static and runtime-cache files as normal 404s", () => {
  const serverSource = readFileSync("scripts/dev-server.js", "utf8");
  assert.match(serverSource, /error\?\.code === "ENOENT" \? 404/);
  assert.match(serverSource, /\.listen\(port, "127\.0\.0\.1"/);
});

test("place image selection prefers capital skylines for states and scenes for tourist islands", () => {
  const johorProfile = inferPlaceImageProfile({
    place: "Johor",
    countryName: "Malaysia",
    countrySlug: "malaysia",
    kind: "state",
    tags: ["state"]
  });
  const langkawiProfile = inferPlaceImageProfile({
    place: "Langkawi",
    countryName: "Malaysia",
    countrySlug: "malaysia",
    kind: "region",
    tags: ["region"]
  });

  assert.equal(johorProfile.strategy, "landmark");
  assert.equal(johorProfile.subject, "Johor Bahru");
  assert.match(johorProfile.queries[0], /Sultan Abu Bakar State Mosque Johor Bahru/);
  assert.equal(langkawiProfile.strategy, "landmark");
  assert.match(langkawiProfile.queries[0], /Langkawi Sky Bridge Malaysia/);
  assert.match(formatExaPlaceImageQuery(langkawiProfile.queries[0]), /no banner no poster/);

  const westCampusProfile = inferPlaceImageProfile({
    place: "West Campus and Gardens",
    countryName: "Singapore",
    countrySlug: "singapore",
    kind: "region"
  });
  assert.equal(westCampusProfile.strategy, "landmark");
  assert.match(westCampusProfile.queries[0], /National University of Singapore Kent Ridge/);

  const ranked = rankPlaceImageCandidates(
    [
      {
        imageUrl: "https://cdn.example.com/langkawi-poster-banner.jpg",
        sourceUrl: "https://visit.example.com/langkawi",
        query: langkawiProfile.queries[0]
      },
      {
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/langkawi-beach-view.jpg",
        sourceUrl: "https://en.wikipedia.org/wiki/Langkawi",
        query: langkawiProfile.queries[1]
      }
    ],
    langkawiProfile
  );

  assert.ok(ranked[0].score > ranked[1].score);
  assert.match(ranked[0].imageUrl, /langkawi-beach-view/);
  assert.equal(isUsablePlaceImageUrl("https://cdn.example.com/langkawi-logo.png"), false);
  assert.equal(PLACE_IMAGE_SELECTION_VERSION, "v5");
});

test("candidate region cards request Exa-backed reference photos through the place-image API", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const runtimeCacheSource = readFileSync(new URL("../src/domain/runtimeCache.js", import.meta.url), "utf8");

  // Frontend renders reference photos on candidate cards through the API only.
  assert.match(appSource, /draft-trust-tick/);
  assert.match(appSource, /approve-draft-item/);
  assert.match(serverSource, /\/api\/country-draft\/approve-item/);
  assert.match(serverSource, /approveDraftItem/);
  assert.match(appSource, /buildPlaceImageUrl/);
  assert.match(appSource, /hydrateDraftPlacePhotos/);
  assert.match(appSource, /loading="eager"/);
  assert.match(appSource, /image\.loading = "eager"/);
  assert.match(appSource, /data-photo-state="queued"/);
  assert.match(appSource, /draft-photo-spinner/);
  assert.match(appSource, /draft-photo-fallback[\s\S]*<svg viewBox="0 0 24 24"/);
  assert.match(appSource, /setDraftPhotoState/);
  assert.match(appSource, /normalizeLoadedDraftPhotoUrl/);
  assert.match(appSource, /\$\{parsed\.origin\}\$\{parsed\.pathname\}\$\{parsed\.search\}/);
  assert.match(appSource, /PLACE_IMAGE_SELECTION_VERSION/);
  assert.match(appSource, /PLACE_IMAGE_REQUEST_SESSION/);
  assert.match(appSource, /request: PLACE_IMAGE_REQUEST_SESSION/);
  assert.match(appSource, /\/api\/place-image\?/);
  assert.match(appSource, /data-reset-draft-photo/);
  assert.match(appSource, /draft-photo-lightbox-reset/);
  assert.match(appSource, /data-draft-photo-feedback/);
  assert.match(appSource, /Search Exa again/);
  assert.match(appSource, /\/api\/place-image\/feedback/);
  assert.match(appSource, /data-suggest-draft-photo-prompts/);
  assert.match(appSource, /Suggest prompts/);
  assert.match(appSource, /\/api\/place-image\/suggestions/);
  assert.match(appSource, /draft-photo-prompt-source/);
  assert.match(appSource, /Gen AI/);
  assert.match(appSource, /Fallback/);
  assert.match(appSource, /data-draft-photo-history/);
  assert.match(appSource, /Keep this photo/);
  assert.match(appSource, /Delete photo/);
  assert.match(appSource, /result\.activeDeleted/);
  assert.match(appSource, /\/api\/place-image\/history/);
  assert.match(appSource, /getPlaceImageRefreshKey/);
  assert.match(appSource, /params\.set\("placeRefresh", String\(placeRefresh\)\)/);
  assert.match(appSource, /map-hotspot-chip-photo/);
  assert.match(appSource, /Not verified travel data/);
  assert.doesNotMatch(appSource, /title="Loading reference photo/);
  assert.doesNotMatch(appSource, /api\.exa\.ai/);
  assert.match(styleSource, /\.draft-photo-spinner/);
  assert.match(styleSource, /\.draft-photo-lightbox-reset/);
  assert.match(styleSource, /\.sheet-close\.draft-photo-lightbox-close/);
  assert.match(styleSource, /draft-photo-lightbox-close svg/);
  assert.match(styleSource, /\.draft-photo-lightbox-feedback/);
  assert.match(styleSource, /\.draft-photo-prompt-suggestions/);
  assert.match(styleSource, /\.draft-photo-prompt-source/);
  assert.match(styleSource, /\.draft-photo-lightbox-history/);
  assert.match(styleSource, /\.draft-photo-fallback svg/);
  assert.match(styleSource, /\.draft-item-photo-button[\s\S]*width: 42px/);
  assert.match(styleSource, /\[data-photo-state="ready"\]/);
  assert.match(styleSource, /draft-photo-spin/);
  assert.doesNotMatch(styleSource, /draft-photo-loading/);

  // Server resolves place images via Exa and caches them in the runtime cache.
  assert.match(serverSource, /handlePlaceImageRequest/);
  assert.match(serverSource, /handlePlaceImageResetRequest/);
  assert.match(serverSource, /handlePlaceImageFeedbackRequest/);
  assert.match(serverSource, /\/api\/place-image\/feedback/);
  assert.match(serverSource, /handlePlaceImageSuggestionsRequest/);
  assert.match(serverSource, /suggestPlaceImagePrompts/);
  assert.match(serverSource, /getMappedPlaceImageSuggestionContext/);
  assert.match(serverSource, /Prompt suggestions only steer an external reference-image search/);
  assert.match(serverSource, /normalizePlaceImageFeedback/);
  assert.match(serverSource, /handlePlaceImageHistoryRequest/);
  assert.match(serverSource, /selectPlaceImageHistoryEntry/);
  assert.match(serverSource, /deleteStoredActivePlaceImage/);
  assert.match(serverSource, /archiveStoredPlaceImage/);
  assert.match(serverSource, /PLACE_IMAGE_HISTORY_LIMIT = 6/);
  assert.match(serverSource, /resetStoredCountryPlaceImages/);
  assert.match(serverSource, /resetStoredPlaceImage/);
  assert.match(serverSource, /searchExaPlaceImageCandidates/);
  assert.match(serverSource, /isPlaceImageClaimedByAnotherPlace/);
  assert.match(serverSource, /reservePlaceImageClaim/);
  assert.match(serverSource, /getPlaceImageCandidateClaimKey/);
  assert.match(serverSource, /placeImageClaimsByCountry/);
  assert.match(serverSource, /buildPlaceImageSearchQueries/);
  assert.match(serverSource, /inferPlaceImageProfile/);
  assert.match(serverSource, /rankPlaceImageCandidates/);
  assert.match(serverSource, /imageLinks/);
  assert.match(serverSource, /createPlaceImageCachePaths/);
  assert.match(serverSource, /PLACE_IMAGE_FACT_BOUNDARY/);

  // Cache paths keep place-image artifacts inside the per-country runtime cache.
  assert.match(runtimeCacheSource, /createPlaceImageCachePaths/);
  assert.match(runtimeCacheSource, /place-images/);
  const placePaths = createPlaceImageCachePaths({ cacheRoot: "/tmp/cache", countrySlug: "singapore", place: "West Campus and Gardens" });
  assert.match(placePaths.historyMetadataPath, /west-campus-and-gardens\.history\.json$/);
  assert.match(placePaths.historyImageUrlForExtension("saved-photo", ".jpg"), /west-campus-and-gardens\.history\/saved-photo\.jpg$/);
});

test("draft tree exposes icon-only GenAI modal triggers", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(appSource, /data-country-action="toggle-genai-prompt"/);
  assert.match(appSource, /data-genai-target/);
  assert.match(appSource, /data-country-genai-form/);
  assert.match(appSource, /countryDraftGenAiOpen/);
  assert.match(appSource, /renderGenAiIcon/);
  assert.match(appSource, /data-tooltip/);
  assert.match(appSource, /role="dialog"/);
  assert.match(appSource, /aria-haspopup="dialog"/);
  assert.match(appSource, /data-genai-target="starter-map"/);
  assert.match(appSource, /`region:\$\{region\.name\}`/);
  assert.match(appSource, /`theme:\$\{theme\.label\}`/);
  assert.match(styleSource, /\.draft-edit-modal-backdrop/);
  assert.match(styleSource, /\.draft-chat-log--modal/);
  assert.match(styleSource, /\.draft-chat-message--processing/);
  assert.match(styleSource, /\.draft-chat-message--done/);
  assert.match(styleSource, /\.visually-hidden/);
  assert.match(appSource, /renderDraftButtonTooltip/);
  assert.match(styleSource, /\.draft-button-tooltip-title/);
  assert.match(styleSource, /font-weight: 900/);
  assert.match(styleSource, /\.draft-meta-chip:hover \.draft-button-tooltip/);
  assert.match(appSource, /renderDraftChatLog/);
  assert.match(appSource, /Processing your instruction/);
  assert.match(appSource, /status: "done"/);
  assert.match(appSource, /replaceLatestProcessingMessage/);
  assert.match(appSource, /renderDraftMetadata/);
  assert.match(appSource, /Trust/);
  assert.match(appSource, /Needs review/);
  assert.match(styleSource, /\.draft-meta-chip/);
  // Modal prompts must reuse the guarded influence flow, not a new AI path.
  assert.match(
    appSource,
    /data-country-chat-form\], \[data-country-genai-form/
  );
  assert.match(appSource, /scopeInstructionToCandidate/);
  assert.match(appSource, /Keep every other candidate unchanged/);
  assert.match(appSource, /generate=false/);
  assert.match(appSource, /force=true/);
  assert.match(appSource, /createCountryPackStarterMap\(countryPack\)/);
  assert.match(appSource, /isDraftItemApproved/);
  assert.match(appSource, /Runtime data may add unconfirmed candidates/);
  assert.doesNotMatch(appSource, />Generate draft</);
  assert.doesNotMatch(appSource, /Draft only/);
  assert.doesNotMatch(appSource, /data-country-action="generate-draft"/);
  assert.doesNotMatch(appSource, /Open preview map/);
  assert.doesNotMatch(appSource, /Open explorer map/);
  assert.doesNotMatch(appSource, /routeForCountryExplorer/);
  assert.doesNotMatch(appSource, /createStarterMapExplorerPack/);
});

test("draft tree exposes drag handles for sorting top-level starter records", () => {
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");

  assert.match(appSource, /data-draft-drag-handle/);
  assert.match(appSource, /data-draft-sort-index/);
  assert.match(appSource, /data-country-action="delete-draft-item"/);
  assert.match(appSource, /deleteCurrentDraftItem/);
  assert.match(appSource, /Delete \$\{itemLabel\} from this starter map/);
  assert.match(appSource, /reorderCurrentDraftItems/);
  assert.match(appSource, /reorderArray/);
  assert.match(appSource, /persistCountryDraftReorder/);
  assert.match(appSource, /\/api\/country-draft\/reorder/);
  assert.match(appSource, /list: payload\.list/);
  assert.match(appSource, /\[list\]: nextItems/);
  assert.match(styleSource, /\.draft-sort-handle/);
  assert.match(styleSource, /\.draft-delete-button/);
  assert.match(styleSource, /\.draft-item\.is-drop-before/);
  assert.match(styleSource, /\.draft-item\.is-drop-after/);
  assert.match(serverSource, /\/api\/country-draft\/reorder/);
  assert.match(serverSource, /handleCountryDraftReorderRequest/);
  assert.match(serverSource, /Records still need source review/);
});

test("server exposes country-scoped generated cache flushing", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");

  assert.match(serverSource, /pathname === "\/api\/runtime-cache\/flush"/);
  assert.match(serverSource, /handleRuntimeCacheFlushRequest/);
  assert.match(serverSource, /flushCountryGeneratedVisualCache/);
  assert.match(serverSource, /const visualFolders = \["image-jobs", "flipbook", "environment"\]/);
  assert.doesNotMatch(serverSource, /const visualFolders = \["image-jobs", "flipbook", "environment", "place-images"\]/);
  assert.match(serverSource, /preservedFolders: \["starter-map", "country-pack-draft", "understanding", "place-images"\]/);
  assert.match(serverSource, /Source-controlled country pack data was not changed/);
  assert.match(serverSource, /isPathInside/);
  assert.match(serverSource, /rm\(countryCacheRoot, \{ recursive: true, force: true \}\)/);
});

test("config thumbnails stream cached place images directly and cannot stay pending forever", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  const placeImageHandler = serverSource.slice(
    serverSource.indexOf("async function handlePlaceImageRequest"),
    serverSource.indexOf("function respondPlaceImageNotFound")
  );
  assert.match(placeImageHandler, /const cachedImagePath = getImagePathFromUrl\(record\.imageUrl\)/);
  assert.match(placeImageHandler, /"Content-Type": mimeTypeForImagePath\(cachedImagePath\)/);
  assert.match(placeImageHandler, /response\.end\(image\)/);
  assert.match(placeImageHandler, /"Cache-Control": "no-store"/);
  assert.match(appSource, /retryDraftPlacePhoto/);
  assert.match(appSource, /retryCount >= 2/);
  assert.match(appSource, /DRAFT_PLACE_PHOTO_TIMEOUT_MS = 90 \* 1000/);
  assert.match(appSource, /setDraftPhotoState\(button, "searching", "Still searching", 0\.82\)/);
  assert.match(appSource, /placeImageRefreshes/);
  assert.match(appSource, /params\.set\("refresh", String\(refresh\)\)/);
  assert.match(appSource, /data-draft-photo-delete/);
  assert.match(appSource, /requestPlaceImageHistoryDelete/);
  assert.match(serverSource, /\/api\/place-image\/history\/delete/);
  assert.match(serverSource, /deletePlaceImageHistoryEntry/);
  assert.match(styleSource, /\.draft-photo-fallback/);
});

test("place image selection rejects Creative Commons badges and invalidates older selections", () => {
  const selectionSource = readFileSync(new URL("../src/domain/placeImageSelection.js", import.meta.url), "utf8");

  assert.match(selectionSource, /PLACE_IMAGE_SELECTION_VERSION = "v5"/);
  assert.match(selectionSource, /creative\[-_\.\]\?commons/);
  assert.match(selectionSource, /POSTER_PENALTY_PATTERN\.test\(imageUrl\)/);
});

test("place image resolver rejects badge-sized files and has a reference-photo fallback", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");

  assert.match(serverSource, /resolvePlaceWikipediaImage\(country, place, \{ context \}\)/);
  assert.match(serverSource, /hasUsablePlaceImageDimensions\(imageBuffer, contentType\)/);
  assert.match(serverSource, /width < 240 \|\| height < 160/);
  assert.match(serverSource, /wikipedia article reference-photo fallback/);
});

test("server filters thin Exa grounding snippets and restricts search to official-leaning domains", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");

  assert.match(serverSource, /searchExaGroundingSnippets/);
  assert.match(serverSource, /EXA_MIN_SNIPPET_TEXT_LENGTH\s*=\s*200/);
  assert.match(serverSource, /snippet\.text\.length >= EXA_MIN_SNIPPET_TEXT_LENGTH/);
  assert.match(serverSource, /includeDomains: EXA_GROUNDING_DOMAINS/);
  assert.match(serverSource, /"visitsingapore\.com"/);
  assert.match(serverSource, /"tourism\.gov\.my"/);
});

test("server creates image-specific environment plans for generated artwork", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const promptSource = readFileSync(new URL("../src/lib/prompts/buildEnvironmentPlanPrompt.js", import.meta.url), "utf8");

  assert.match(serverSource, /ensureEnvironmentPlanForPage/);
  assert.match(serverSource, /createEnvironmentPlanWithOpenAI/);
  assert.match(serverSource, /getDefaultArtworkPageForNode/);
  assert.match(serverSource, /url\.searchParams\.get\("nodeId"\)/);
  assert.match(serverSource, /searchParams\.get\("prefetch"\) === "priority"/);
  assert.match(serverSource, /searchParams\.get\("priority"\) === "interactive"/);
  assert.match(serverSource, /jobKind = isInteractivePriority[\s\S]*"interactive"[\s\S]*isPrefetch[\s\S]*"prefetch"/);
  assert.match(serverSource, /chooseHigherPriorityJobKind/);
  assert.match(serverSource, /imageJobPriority/);
  assert.match(serverSource, /if \(body\.targetNodeId \|\| body\.detourPhrase\)/);
  assert.match(serverSource, /appConfig\.ai\.environmentModel/);
  assert.match(serverSource, /buildEnvironmentPlanPrompt/);
  assert.match(promptSource, /environment-plan-v1/);
  assert.match(promptSource, /marine_life may only go on clear open water/);
  assert.match(promptSource, /Never place them over land, islands, buildings, bridges, boats, labels/);
  assert.match(serverSource, /Environment overlays are decorative code-rendered ambience only and are not fact sources/);
});

test("server persists country starter maps in country-scoped runtime storage", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");

  assert.match(serverSource, /createCountryStarterMapCachePaths/);
  assert.match(serverSource, /createCountryPackStarterMap/);
  assert.match(serverSource, /createCountryPackDraftFromStarterMap/);
  assert.match(serverSource, /curated_pack_snapshot/);
  assert.match(serverSource, /source: "country_pack"/);
  assert.match(serverSource, /readStoredCountryDraft/);
  assert.match(serverSource, /writeStoredCountryDraft/);
  assert.match(serverSource, /Always reconstruct the curated tree from the repository/);
  assert.match(serverSource, /appendUnconfirmedRegionCandidates\(packSnapshot, region\.name, storedPackSnapshot\)/);
  assert.match(appSource, /label: `Build \$\{country\.name\} map`/);
  assert.match(appSource, /No \$\{escapeHtml\(country\.name\)\} map data loaded/);
  assert.match(serverSource, /starter-map/);
  assert.match(serverSource, /url\.searchParams\.get\("force"\) === "true"/);
  assert.match(serverSource, /regenerated: forceGenerate/);
  assert.match(serverSource, /url\.searchParams\.get\("generate"\) !== "false"/);
  assert.match(serverSource, /isSourceReviewedCountryPack/);
  assert.match(serverSource, /countryPack\.confidence !== "unconfirmed"/);
  assert.match(serverSource, /only supports append-only GenAI candidates within a selected region/);
  assert.match(serverSource, /appendUnconfirmedRegionCandidates/);
  assert.match(serverSource, /handleCountryDraftConfirmRequest/);
  assert.match(serverSource, /confirmed_for_curation/);
  assert.match(serverSource, /resolveRoamAtlasConfig/);
  assert.match(serverSource, /resolveRoamAtlasExperienceConfig/);
  assert.match(serverSource, /\/api\/experience-config/);
  assert.match(serverSource, /handleCountryPacksRequest/);
  assert.match(serverSource, /get\("scope"\)/);
  assert.match(serverSource, /attachCodexArtworkToPage/);
  assert.match(serverSource, /getCanonicalArtworkPageForGeneration/);
  assert.match(serverSource, /DEFAULT_IMAGE_PROVIDER/);
  assert.match(serverSource, /appConfig\.ai\.vlmModel/);
});

test("dev server serves the app shell for direct country and node routes", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(serverSource, /isAppRoutePath/);
  assert.match(serverSource, /pathname === "\/" \|\| isAppRoutePath\(pathname\) \? "\/index\.html"/);
  assert.match(serverSource, /!pathname\.startsWith\("\/api\/"\) && !path\.extname\(pathname\)/);
  assert.match(serverSource, /\/__roamatlas\/dev-reload/);
  assert.match(serverSource, /event\.data === "reload"/);
  assert.match(serverSource, /shouldIgnoreLiveReloadPath/);
  assert.match(serverSource, /startLiveReloadWatcher/);
  assert.match(serverSource, /Cache-Control": "no-cache"/);
  assert.match(htmlSource, /href="\/src\/styles\.css(?:\?[^"]*)?"/);
  assert.match(htmlSource, /src="\/src\/ui\/app\.js(?:\?[^"]*)?"/);
  assert.doesNotMatch(htmlSource, /href="\.\/src\/styles\.css"/);
  assert.doesNotMatch(htmlSource, /src="\.\/src\/ui\/app\.js"/);
});

test("default artwork pages are generated through the runtime image pipeline", () => {
  const homepage = getDefaultArtworkPageForScene("singapore-overview", scrollScenes);
  const eastCoastPage = getDefaultArtworkPageForNode(
    "east-coast-park",
    "nature-wildlife-scroll",
    scrollScenes
  );
  const malaysiaHomepage = getDefaultArtworkPageForScene(
    "malaysia-overview",
    countryPacks.malaysia.scenes,
    countryPacks.malaysia.nodes,
    "malaysia",
    "Malaysia"
  );
  const pages = listDefaultArtworkPages(scrollScenes);

  assert.equal(homepage.id, "artwork-singapore-overview");
  assert.equal(homepage.status, "generation_required");
  assert.equal(homepage.nodeId, "singapore");
  assert.match(homepage.plan.imagePrompt, /visual table of contents/);
  assert.equal(eastCoastPage.id, "node-east-coast-park");
  assert.equal(eastCoastPage.sceneId, "nature-wildlife-scroll");
  assert.equal(eastCoastPage.nodeId, "east-coast-park");
  assert.match(eastCoastPage.plan.imagePrompt, /East Coast Park/);
  assert.equal(malaysiaHomepage.id, "artwork-malaysia-overview");
  assert.equal(malaysiaHomepage.countrySlug, "malaysia");
  assert.match(malaysiaHomepage.plan.imagePrompt, /Malaysia/);
  assert.doesNotMatch(malaysiaHomepage.plan.imagePrompt, /\bSingapore\b/);
  assert.ok(pages.some((page) => page.sceneId === "singapore-overview"));
  assert.ok(pages.some((page) => page.sceneId === "singapore-zoo-scroll"));
});

test("flipbook generation reuses canonical artwork page ids for scene roots", () => {
  const flipbookPage = {
    id: "node-singapore-zoo",
    sceneId: "singapore-zoo-scroll",
    nodeId: "singapore-zoo",
    status: "generation_required"
  };
  const canonical = getCanonicalArtworkPageForGeneration(flipbookPage, scrollScenes, atlasNodes);

  assert.equal(canonical.id, "artwork-singapore-zoo-scroll");
  assert.equal(canonical.nodeId, "singapore-zoo");
  assert.match(canonical.plan.imagePrompt, /Singapore Zoo/);
});

test("Malaysia flipbook clicks generate Malaysia image prompts", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      countrySlug: "malaysia",
      sceneId: "malaysia-overview",
      nodeId: "malaysia",
      imageUrl: "/runtime-cache/malaysia/flipbook/artwork-malaysia-overview.gpt-image-2.png"
    },
    normalizedClick: { x: 0.1, y: 0.3 },
    scenes: countryPacks.malaysia.scenes,
    nodes: countryPacks.malaysia.nodes,
    sceneArtwork,
    countryName: "Malaysia"
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.page.countrySlug, "malaysia");
  assert.equal(result.page.countryName, "Malaysia");
  assert.match(result.page.plan.imagePrompt, /Malaysia/);
  assert.doesNotMatch(result.page.plan.imagePrompt, /\bSingapore\b/);
});

test("flipbook click returns generation-required page when runtime artwork is not cached yet", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "/runtime-cache/singapore/flipbook/artwork-singapore-overview.gpt-image-2.png"
    },
    normalizedClick: { x: 0.58, y: 0.4 },
    resolvedPhrase: "southern island beaches and resort coastline",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.page.parentId, "root");
  assert.equal(result.page.id, "node-sentosa-south-scroll");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
  assert.ok(result.page.plan.imagePrompt);
});

test("overview wildlife hotspot is not stolen by synthetic child regions", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "/runtime-cache/singapore/flipbook/artwork-singapore-overview.gpt-image-2.png"
    },
    normalizedClick: { x: 0.15, y: 0.62 },
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "nature-wildlife-scroll");
  assert.equal(result.page.nodeId, "nature-wildlife-scroll");
  assert.notEqual(result.page.nodeId, "sentosa-south-scroll");
});

test("flipbook click can use a VLM phrase before planning the next page", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "/runtime-cache/singapore/flipbook/artwork-singapore-overview.gpt-image-2.png"
    },
    normalizedClick: { x: 0.1, y: 0.1 },
    resolvedPhrase: "waterfront skyline garden district with glass domes",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "marina-bay-scroll");
  assert.equal(result.page.nodeId, "marina-bay-scroll");
  assert.equal(result.page.plan.factMode, "verified");
  assert.ok(result.page.plan.imagePrompt);
});

test("flipbook VLM phrases that do not match curated candidates become unverified detours", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root",
      sceneId: "singapore-overview",
      nodeId: "singapore",
      imageUrl: "/runtime-cache/singapore/flipbook/artwork-singapore-overview.gpt-image-2.png"
    },
    normalizedClick: { x: 0.1, y: 0.1 },
    resolvedPhrase: "floating moon castle",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.click.status, "unmapped");
  assert.equal(result.page.nodeId, null);
  assert.equal(result.page.plan.factMode, "unverified_detour");
});

test("flipbook VLM matching uses current node children after turning the page", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root-150-450",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-scroll",
      imageUrl: "/runtime-cache/singapore/flipbook/node-marina-bay-scroll.gpt-image-2.png"
    },
    normalizedClick: { x: 0.34, y: 0.48 },
    resolvedPhrase: "glass conservatories and garden domes",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "vlm");
  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "gardens-by-the-bay");
  assert.equal(result.page.id, "node-gardens-by-the-bay");
  assert.equal(result.page.nodeId, "gardens-by-the-bay");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
  assert.equal(result.page.plan.pageType, "district_or_attraction");
});

test("flipbook can keep drilling from Gardens into Supertree Grove", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root-150-450-340-480",
      sceneId: "marina-bay-scroll",
      nodeId: "gardens-by-the-bay",
      imageUrl: "/runtime-cache/singapore/flipbook/node-gardens-by-the-bay.gpt-image-2.png"
    },
    normalizedClick: { x: 0.52, y: 0.42 },
    resolvedPhrase: "supertree grove canopy structures",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "matched");
  assert.equal(result.click.nodeId, "supertree-grove");
  assert.equal(result.page.id, "node-supertree-grove");
  assert.equal(result.page.nodeId, "supertree-grove");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
});

test("flipbook overlay target can drill directly into a curated child node", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "node-gardens-by-the-bay",
      sceneId: "marina-bay-scroll",
      nodeId: "gardens-by-the-bay",
      imageUrl: "/runtime-cache/singapore/flipbook/node-gardens-by-the-bay.gpt-image-2.png"
    },
    normalizedClick: { x: 0.5, y: 0.34 },
    targetNodeId: "cloud-forest",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "overlay");
  assert.equal(result.click.status, "matched");
  assert.equal(result.page.id, "node-cloud-forest");
  assert.equal(result.page.nodeId, "cloud-forest");
  assert.equal(result.page.status, "generation_required");
});

test("flipbook leaf pages can still create an unverified drill-down job", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "node-supertree-structure-plate",
      sceneId: "marina-bay-scroll",
      nodeId: "supertree-structure-plate",
      imageUrl: "/runtime-cache/singapore/flipbook/node-supertree-grove.gpt-image-2.png"
    },
    normalizedClick: { x: 0.5, y: 0.5 },
    detourPhrase: "Supertree canopy detail study",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "overlay");
  assert.equal(result.click.status, "unmapped");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.plan.factMode, "unverified_detour");
  assert.match(result.page.plan.imagePrompt, /Supertree canopy detail study/);
});

test("flipbook page ids are stable per node so generated images can be reused", () => {
  const first = resolveFlipbookClick({
    currentPage: {
      id: "node-marina-bay-scroll",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-scroll",
      imageUrl: "/runtime-cache/singapore/flipbook/node-marina-bay-scroll.gpt-image-2.png"
    },
    normalizedClick: { x: 0.34, y: 0.48 },
    resolvedPhrase: "glass conservatories and garden domes",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });
  const second = resolveFlipbookClick({
    currentPage: {
      id: "node-marina-bay-scroll",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-scroll",
      imageUrl: "/runtime-cache/singapore/flipbook/node-marina-bay-scroll.gpt-image-2.png"
    },
    normalizedClick: { x: 0.62, y: 0.31 },
    resolvedPhrase: "glass domes and conservatory garden",
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(first.page.id, "node-gardens-by-the-bay");
  assert.equal(second.page.id, "node-gardens-by-the-bay");
  assert.equal(first.page.imageUrl, second.page.imageUrl);
  assert.equal(first.page.imageUrl, null);
});

test("local dev click fallback uses current page precomputed child regions", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "root-150-450-340-480",
      sceneId: "marina-bay-scroll",
      nodeId: "gardens-by-the-bay",
      imageUrl: "/runtime-cache/singapore/flipbook/node-gardens-by-the-bay.gpt-image-2.png"
    },
    normalizedClick: { x: 0.2, y: 0.42 },
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.resolver, "local");
  assert.equal(result.click.reason, "Matched through current page precomputed click region.");
  assert.equal(result.click.nodeId, "supertree-grove");
  assert.equal(result.page.status, "generation_required");
  assert.equal(result.page.imageUrl, null);
});

test("deep page clicks do not reuse parent scene hotspots", () => {
  const result = resolveFlipbookClick({
    currentPage: {
      id: "node-marina-bay-sands",
      sceneId: "marina-bay-scroll",
      nodeId: "marina-bay-sands",
      imageUrl: "/runtime-cache/singapore/flipbook/node-marina-bay-sands.gpt-image-2.png"
    },
    normalizedClick: { x: 0.2, y: 0.42 },
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });

  assert.equal(result.click.status, "unmapped");
  assert.equal(result.page.nodeId, null);
  assert.equal(result.page.plan.factMode, "unverified_detour");
});

test("runtime page clicks without reliable VLM should stay on the current page", () => {
  const currentPage = {
    id: "artwork-singapore-overview",
    sceneId: "singapore-overview",
    nodeId: "singapore",
    imageUrl: "/runtime-cache/singapore/flipbook/artwork-singapore-overview.gpt-image-2.png",
    status: "ready"
  };

  assert.ok(currentPage.imageUrl.startsWith(RUNTIME_CACHE_URL_PREFIX));
});

test("server keeps deterministic fallback for non-runtime flipbook click handling", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /resolveSemanticRegionHit/);
  assert.match(serverSource, /resolveClickPhraseWithOpenAI/);
  assert.match(serverSource, /shouldUseLocalFallback/);
  assert.match(serverSource, /!isRuntimePage/);
  assert.doesNotMatch(serverSource, /canUseStaticHomepageFallback/);
  assert.doesNotMatch(serverSource, /isHomepagePage/);
  assert.doesNotMatch(serverSource, /resolvedPhrase:/);
});

test("server does not let semantic cache override explicit detour targets", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /const semanticHit = !body\.targetNodeId && !body\.detourPhrase/);
});

test("server VLM resolver tolerates missing generated artwork", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /if \(!artwork\?\.imageUrl\)/);
  assert.doesNotMatch(serverSource, /if \(!artwork\.imageUrl\)/);
});

test("server VLM resolver marks the clicked point in the image", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /annotateClickPointOnPng/);
  assert.match(serverSource, /red crosshair with a white halo/);
  assert.match(serverSource, /imageMarked: Boolean\(markedImage\)/);
  assert.match(serverSource, /data:\$\{vlmMimeType\};base64/);
});

test("server semantic cache prefers the nearest cached click over confidence alone", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  assert.match(serverSource, /selectSemanticRegionForPoint/);
  assert.match(serverSource, /semanticRegionClickDistance/);
  assert.doesNotMatch(serverSource, /sort\(\(a, b\) => \(b\.confidenceScore \?\? 0\) - \(a\.confidenceScore \?\? 0\)\)/);
  assert.match(serverSource, /matchedNodeId\s*\?\s*mergeBoxes\(existing\.bbox, nextRegion\.bbox\)\s*:\s*nextRegion\.bbox/);
});

test("runtime image job polling is not cached by the browser", () => {
  const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
  assert.match(serverSource, /isMutableRuntimeJsonPath/);
  assert.match(serverSource, /\(\?:image-jobs\|codex-jobs\|understanding\|environment\|starter-map\|country-pack-draft\)/);
  assert.match(serverSource, /"Cache-Control": isMutableRuntimeJson/);
  assert.match(serverSource, /"no-store"/);
  assert.match(appSource, /fetchArtworkResource\(toApiUrl\(jobUrl\), \{ cache: "no-store" \}\)/);
});
