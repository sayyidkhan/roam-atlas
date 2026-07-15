import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, watch } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

import { getSceneArtwork } from "../src/data/sceneArtwork.js";
import {
  getCanonicalArtworkPageForGeneration,
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "../src/data/defaultArtworkPages.js";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  getCountryPack,
  isSourceControlledCountryPack
} from "../src/data/countryPacks/index.js";
import { getCountryBySlug } from "../src/data/countries.js";
import {
  getCountryImageOverrideUrl,
  getCountryImageTopics
} from "../src/data/countryImageTopics.js";
import { sceneArtwork } from "../src/data/sceneArtwork.js";
import {
  PLACE_IMAGE_SELECTION_VERSION,
  buildPlaceImageSearchQueries,
  inferPlaceImageProfile,
  isUsablePlaceImageUrl,
  rankPlaceImageCandidates
} from "../src/domain/placeImageSelection.js";
import { resolveRoamAtlasConfig } from "../src/config/roamAtlasConfig.js";
import { resolveRoamAtlasExperienceConfig } from "../src/config/experienceConfig.js";
import {
  buildCountryDraftInfluencePrompt,
  buildCountryDraftPrompt,
  createCountryPackDraftFromStarterMap,
  createCountryPackStarterMap,
  createCountryDraftFallback,
  normalizeCountryDraftInstruction,
  normalizeCountryDraftPayload,
  refreshCuratedPackSnapshotThemes
} from "../src/domain/countryDraft.js";
import {
  approveDraftItem,
  unapproveDraftItem
} from "../src/domain/countryDraftReview.js";
import { resolveFlipbookClick } from "../src/domain/flipbookPage.js";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROVIDER,
  generateTileImageWithOpenAI,
  normalizeImageModel
} from "../src/domain/imageProvider.js";
import {
  imageJobPriority,
  isStaleProcessingImageJob,
  selectImageJobsForProcessing,
  shouldQueueDefaultArtwork
} from "../src/domain/imageJobQueue.js";
import {
  DEFAULT_RUNTIME_COUNTRY_SLUG,
  RUNTIME_CACHE_URL_PREFIX,
  createCountryStarterMapCachePaths,
  createImageVariantKey,
  createPlaceImageCachePaths,
  createRuntimeCachePaths,
  resolveRuntimeCacheRoot
} from "../src/domain/runtimeCache.js";
import { matchClickPhraseToNode } from "../src/domain/nodeMatcher.js";
import {
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_SCHEMA_VERSION,
  buildEnvironmentPlanPrompt
} from "../src/lib/prompts/buildEnvironmentPlanPrompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadLocalEnv(path.join(root, ".env"));
const appConfig = resolveRoamAtlasConfig(process.env);
const appExperienceConfig = resolveRoamAtlasExperienceConfig(process.env);
const port = appConfig.server.port;
const runtimeCacheRoot = resolveRuntimeCacheRoot();
const defaultCountryPack = getCountryPack(DEFAULT_COUNTRY_SLUG);
const processingJobs = new Map();
const processingJobRuns = new Map();
const processingJobAbortControllers = new Map();
const cancelledImageJobs = new Set();
const flushingCountryCacheRoots = new Set();
const activeCountryImageJobCreations = new Map();
const countryCacheFlushRuns = new Map();
// Terminal variants remain addressable by their job URLs, but do not need to
// be re-read and parsed on every three-second queue scan.
const terminalImageJobs = new Set();
const pendingEnvironmentPlans = new Map();
let imageJobScanPromise = null;
let imageJobRescanRequested = false;
let environmentPlanProcessorActive = false;
let activeEnvironmentTask = null;
const countryDraftCache = new Map();
const countryImageCache = new Map();
const placeImageCache = new Map();
const placeImageRequestsInFlight = new Map();
const placeImageClaimsByCountry = new Map();
const COUNTRY_CARD_IMAGE_PUBLIC_PREFIX = "/public/country-cards";
const COUNTRY_CARD_IMAGE_PUBLIC_DIR = path.join(root, "public", "country-cards");
const COUNTRY_MEDIA_PAGE_OVERRIDES = {
  BA: "Bosnia and Herzegovina",
  BO: "Bolivia",
  BN: "Brunei",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CI: "Ivory Coast",
  CV: "Cape Verde",
  FM: "Federated States of Micronesia",
  KN: "Saint Kitts and Nevis",
  KP: "North Korea",
  KR: "South Korea",
  LA: "Laos",
  LC: "Saint Lucia",
  MD: "Moldova",
  PS: "State of Palestine",
  RU: "Russia",
  ST: "Sao Tome and Principe",
  SY: "Syria",
  TZ: "Tanzania",
  VC: "Saint Vincent and the Grenadines",
  VE: "Venezuela",
  VN: "Vietnam"
};
const COUNTRY_MEDIA_EXCLUDE_PATTERN =
  /(^|[^a-z])(?:flag|coat|arms|emblem|seal|orthographic|projection|location|locator|map|population|density|diagram|chart|graph|gdp|growth|economic|economy|stamp|coin|portrait|president|minister|king|queen|parliament|battle|war|army|military|police|navy|aircraft|letter|logo|manuscript|document|pdf|djvu|text|plate|script|inscription|passport|visa|banknote|currency|montage|collage)([^a-z]|$)/i;
const COUNTRY_MEDIA_PLACE_PATTERN =
  /(?:village|town|city|cidade|capital|skyline|coast|harbou?r|beach|island|mountain|valley|river|lake|lagoon|reef|shoreline|forest|desert|waterfall|falls|park|garden|palace|pavilion|tower|gate|bridge|hall|temple|church|cathedral|mosque|castle|fort|fortress|street|old town|landscape|view|bay|port|plain|plateau|reserve|road|reservoir|market|monument|cave|arch|ruins|heritage|luanda)/i;
const COUNTRY_MEDIA_GENERIC_TOPIC_TERMS = new Set([
  "bay",
  "beach",
  "bridge",
  "capital",
  "castle",
  "cathedral",
  "city",
  "coast",
  "desert",
  "falls",
  "fort",
  "fortress",
  "garden",
  "harbor",
  "harbour",
  "island",
  "lake",
  "lagoon",
  "monastery",
  "monument",
  "mosque",
  "mountain",
  "museum",
  "national",
  "old",
  "palace",
  "park",
  "river",
  "skyline",
  "temple",
  "tower",
  "towers",
  "valley"
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const liveReloadClients = new Set();
const DEV_RELOAD_PATH = "/__roamatlas/dev-reload";
const DEV_LIVE_RELOAD_SCRIPT = `<script>
(() => {
  if (!("EventSource" in window)) return;
  const source = new EventSource("${DEV_RELOAD_PATH}");
  source.onmessage = (event) => {
    if (event.data === "reload") window.location.reload();
  };
})();
</script>`;

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function notifyLiveReloadClients() {
  for (const client of liveReloadClients) {
    client.write("data: reload\n\n");
  }
}

function shouldIgnoreLiveReloadPath(filename) {
  const normalized = String(filename).replace(/\\/g, "/");
  return normalized.startsWith("country-cards/") || normalized.includes("/country-cards/");
}

function startLiveReloadWatcher() {
  const notify = debounce(notifyLiveReloadClients, 120);
  const watchTargets = [
    path.join(root, "src"),
    path.join(root, "public"),
    path.join(root, "index.html")
  ];

  for (const target of watchTargets) {
    try {
      watch(target, { recursive: true }, (eventType, filename) => {
        if (!filename || filename.endsWith("~")) return;
        if (shouldIgnoreLiveReloadPath(filename)) return;
        notify();
      });
    } catch (error) {
      console.warn(`RoamAtlas live reload could not watch ${target}: ${String(error?.message ?? error)}`);
    }
  }
}

function handleLiveReloadRequest(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.write("data: connected\n\n");
  liveReloadClients.add(response);
  request.on("close", () => {
    liveReloadClients.delete(response);
  });
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "POST" && url.pathname === "/api/resolve-click") {
      await handleResolveClick(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/flipbook/click") {
      await handleFlipbookClick(request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/artwork") {
      await handleArtworkRequest(url, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/experience-config") {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      });
      response.end(JSON.stringify(appExperienceConfig));
      return;
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/api/country-image") {
      await handleCountryImageRequest(url, response);
      return;
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/api/place-image") {
      await handlePlaceImageRequest(url, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/place-image/reset") {
      await handlePlaceImageResetRequest(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/place-image/feedback") {
      await handlePlaceImageFeedbackRequest(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/place-image/suggestions") {
      await handlePlaceImageSuggestionsRequest(request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/place-image/history") {
      await handlePlaceImageHistoryRequest(url, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/place-image/history/select") {
      await handlePlaceImageHistorySelectionRequest(request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/country-packs") {
      await handleCountryPacksRequest(url, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/country-draft") {
      await handleCountryDraftRequest(url, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/country-draft/influence") {
      await handleCountryDraftInfluenceRequest(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/country-draft/confirm") {
      await handleCountryDraftConfirmRequest(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/country-draft/reorder") {
      await handleCountryDraftReorderRequest(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/country-draft/approve-item") {
      await handleCountryDraftApproveRequest(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/runtime-cache/flush") {
      await handleRuntimeCacheFlushRequest(request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === DEV_RELOAD_PATH) {
      handleLiveReloadRequest(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) console.error("RoamAtlas dev server request failed:", error);
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: String(error?.message ?? error) }));
  }
}).listen(port, () => {
  console.log(`RoamAtlas dev server listening on http://127.0.0.1:${port}`);
  console.log(`RoamAtlas runtime cache: ${runtimeCacheRoot}`);
  console.log("RoamAtlas live reload enabled for src/, public/, and index.html");
  startLiveReloadWatcher();
  startImageJobProcessor();
});

async function handleResolveClick(request, response) {
  const body = await readJson(request);
  const result = await resolveClickPhraseWithOpenAI({
    sceneId: body.sceneId,
    countrySlug: body.countrySlug ?? DEFAULT_COUNTRY_SLUG,
    imageUrl: body.imageUrl,
    normalizedClick: body.normalizedClick,
    point: body.point
  });

  if (result.status === "provider_missing") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
    return;
  }

  if (result.status === "vlm_error") {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
    return;
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(result));
}

async function handleFlipbookClick(request, response) {
  const body = await readJson(request);
  const pack = getCountryPackForPage(body.currentPage);
  const normalizedClick = body.imageClick?.normalizedImage ?? body.normalizedClick;
  const localResult = !body.targetNodeId && !body.detourPhrase
    ? resolveDeterministicClick({
        currentPage: body.currentPage,
        normalizedClick
      })
    : null;

  const semanticHit = !body.targetNodeId && !body.detourPhrase
    ? await resolveSemanticRegionHit({
        currentPage: body.currentPage,
        normalizedClick
      })
    : null;
  if (body.targetNodeId || body.detourPhrase) {
    const result = resolveFlipbookClick({
      currentPage: body.currentPage,
      normalizedClick,
      targetNodeId: body.targetNodeId,
      detourPhrase: body.detourPhrase,
      scenes: pack.scenes,
      nodes: pack.nodes,
      sceneArtwork,
      countryName: pack.title
    });
    if (result.page.status === "generation_required") {
      result.page = await attachCodexArtworkToPage(result.page, pack);
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
    return;
  }

  if (semanticHit) {
    const semanticClick = semanticHit.cacheClick ?? centerOfBox(semanticHit.bbox) ?? normalizedClick;
    const result = resolveFlipbookClick({
      currentPage: body.currentPage,
      normalizedClick: semanticClick,
      targetNodeId: semanticHit.matchedNodeId,
      detourPhrase: semanticHit.matchedNodeId ? null : semanticHit.phrase,
      scenes: pack.scenes,
      nodes: pack.nodes,
      sceneArtwork,
      countryName: pack.title
    });
    result.semanticCache = semanticHit;
    if (result.page.status === "generation_required") {
      result.page = await attachCodexArtworkToPage(result.page, pack);
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
    return;
  }

  const vlm = await resolveClickPhraseWithOpenAI({
    sceneId: body.currentPage?.sceneId,
    countrySlug: getRuntimeCountrySlugForPage(body.currentPage),
    imageUrl: body.currentPage?.imageUrl,
    normalizedClick: body.normalizedClick,
    imageClick: body.imageClick
  });
  const isRuntimePage = hasRuntimeGeneratedPage(body.currentPage);
  const hasReliableVlm =
    vlm.status === "resolved" &&
    (vlm.confidence === "high" || vlm.confidence === "medium") &&
    Boolean(vlm.phrase);
  const vlmMatch =
    !body.targetNodeId &&
    !body.detourPhrase &&
    hasReliableVlm
      ? matchVlmPhraseForCurrentPage({
          currentPage: body.currentPage,
          phrase: vlm.phrase
        })
      : null;
  const shouldUseVlmMatch =
    vlmMatch?.status === "matched" &&
    (!isRuntimePage || vlmMatch.confidence === "confirmed");
  const shouldUseVlmDetour =
    !body.targetNodeId &&
    !body.detourPhrase &&
    !shouldUseVlmMatch &&
    hasReliableVlm;
  const shouldUseLocalFallback =
    !body.targetNodeId &&
    !body.detourPhrase &&
    !isRuntimePage &&
    localResult?.click?.status === "matched" &&
    (!hasReliableVlm || vlmMatch?.nodeId !== localResult.click.nodeId);
  const result = body.targetNodeId || body.detourPhrase
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick,
        targetNodeId: body.targetNodeId,
        detourPhrase: body.detourPhrase,
        scenes: pack.scenes,
        nodes: pack.nodes,
        sceneArtwork,
        countryName: pack.title
      })
    : shouldUseVlmMatch
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick,
        targetNodeId: vlmMatch.nodeId,
        scenes: pack.scenes,
        nodes: pack.nodes,
        sceneArtwork,
        countryName: pack.title
      })
    : shouldUseVlmDetour
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick,
        detourPhrase: vlm.phrase,
        scenes: pack.scenes,
        nodes: pack.nodes,
        sceneArtwork,
        countryName: pack.title
      })
    : shouldUseLocalFallback
    ? localResult
    : createUnresolvedClickResult({
        currentPage: body.currentPage,
        normalizedClick,
        vlm
      });

  await appendSemanticRegionFromResult({
    currentPage: body.currentPage,
    normalizedClick,
    result,
    vlm
  });

  result.vlm = {
    status: vlm.status,
    phrase: vlm.phrase ?? null,
    matchedNodeId: vlmMatch?.nodeId ?? null,
    confidence: vlm.confidence ?? null,
    reason: vlm.reason ?? null,
    imageMarked: vlm.imageMarked ?? null,
    fallbackReason: shouldUseLocalFallback
      ? "Curated hotspot overrode missing or conflicting VLM match."
      : null
  };

  if (result.page.status === "generation_required") {
    result.page = await attachCodexArtworkToPage(result.page, pack);
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(result));
}

async function attachCodexArtworkToPage(page, pack) {
  const codexPage = getCanonicalArtworkPageForGeneration(
    page,
    pack.scenes,
    pack.nodes,
    pack.countrySlug,
    pack.title
  );
  const artworkPage = await createCodexImageJob(codexPage);
  return {
    ...page,
    status: artworkPage.status,
    imageUrl: artworkPage.imageUrl ?? page.imageUrl,
    partialImageUrl: artworkPage.partialImageUrl,
    assetVersion: artworkPage.assetVersion,
    environmentUrl: artworkPage.environmentUrl,
    generated: artworkPage.generated
  };
}

function resolveDeterministicClick({ currentPage, normalizedClick }) {
  const pack = getCountryPackForPage(currentPage);
  const scene = pack.scenes[currentPage?.sceneId];
  if (!scene || scene.rootNodeId !== currentPage?.nodeId || !normalizedClick) {
    return null;
  }

  return resolveFlipbookClick({
    currentPage,
    normalizedClick,
    scenes: pack.scenes,
    nodes: pack.nodes,
    sceneArtwork,
    countryName: pack.title
  });
}

async function resolveSemanticRegionHit({ currentPage, normalizedClick }) {
  if (!hasRuntimeGeneratedPage(currentPage) || !normalizedClick) return null;

  const understanding = await readPageUnderstanding(currentPage);
  const region = selectSemanticRegionForPoint(understanding?.regions ?? [], normalizedClick);

  return region ?? null;
}

async function appendSemanticRegionFromResult({ currentPage, normalizedClick, result, vlm }) {
  if (!hasRuntimeGeneratedPage(currentPage) || !normalizedClick) return;
  const phrase = result.click?.phrase ?? vlm.phrase;
  if (!phrase || result.click?.resolver === "vlm_guard") return;

  const understanding = (await readPageUnderstanding(currentPage)) ?? createBaseUnderstanding(currentPage);
  const pack = getCountryPackForPage(currentPage);
  const matchedNodeId = result.click?.nodeId ?? null;
  const id = matchedNodeId ? `node-${matchedNodeId}` : `phrase-${slugify(phrase)}`;
  const existing = understanding.regions.find(
    (region) => region.id === id || (matchedNodeId && region.matchedNodeId === matchedNodeId)
  );
  const nextRegion = {
    id,
    phrase,
    label: matchedNodeId ? pack.nodes[matchedNodeId]?.title ?? phrase : phrase,
    matchedNodeId,
    status: matchedNodeId ? "matched" : "unmapped_detour",
    bbox: boxAroundPoint(normalizedClick, matchedNodeId ? 0.22 : 0.12),
    cacheClick: normalizedClick,
    confidence: result.click?.confidence ?? "general",
    confidenceScore: matchedNodeId ? 80 : 45,
    source: vlm.status === "resolved" ? "click_vlm" : "local_confirmed_click",
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    existing.bbox = matchedNodeId
      ? mergeBoxes(existing.bbox, nextRegion.bbox)
      : nextRegion.bbox;
    existing.phrase = existing.phrase || nextRegion.phrase;
    existing.cacheClick = nextRegion.cacheClick ?? existing.cacheClick;
    existing.updatedAt = nextRegion.updatedAt;
    existing.confidenceScore = Math.max(existing.confidenceScore ?? 0, nextRegion.confidenceScore);
  } else {
    understanding.regions.push(nextRegion);
  }

  await writePageUnderstanding(currentPage, understanding);
}

function selectSemanticRegionForPoint(regions, point) {
  return regions
    .filter((item) => pointInBox(point, item.bbox))
    .sort((a, b) => compareSemanticRegionHit(a, b, point))[0] ?? null;
}

function compareSemanticRegionHit(a, b, point) {
  const distanceA = semanticRegionClickDistance(a, point);
  const distanceB = semanticRegionClickDistance(b, point);
  const distanceDifference = distanceA - distanceB;
  if (Math.abs(distanceDifference) > 0.0004) {
    return distanceDifference;
  }

  return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
}

function semanticRegionClickDistance(region, point) {
  const anchor = region.cacheClick ?? centerOfBox(region.bbox);
  if (!anchor || !point) return Number.POSITIVE_INFINITY;
  return (anchor.x - point.x) ** 2 + (anchor.y - point.y) ** 2;
}

async function ensurePageUnderstanding(page) {
  if (!hasRuntimeGeneratedPage(page)) return null;
  const existing = await readPageUnderstanding(page);
  if (existing) return existing;
  const understanding = createBaseUnderstanding(page);
  await writePageUnderstanding(page, understanding);
  return understanding;
}

async function readPageUnderstanding(page) {
  if (!page?.id) return null;
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: page.id,
    imageModel: getConfiguredImageModel(),
    countrySlug: getRuntimeCountrySlugForPage(page),
    outputFormat: appConfig.image.outputFormat,
    variantKey: resolveAssetVersionForPage(page)
  });
  try {
    return JSON.parse(await readFile(paths.understandingPath, "utf8"));
  } catch {
    return null;
  }
}

async function writePageUnderstanding(page, understanding) {
  if (!page?.id) return;
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: page.id,
    imageModel: getConfiguredImageModel(),
    countrySlug: getRuntimeCountrySlugForPage(page),
    outputFormat: appConfig.image.outputFormat,
    variantKey: resolveAssetVersionForPage(page)
  });
  await mkdir(path.dirname(paths.understandingPath), { recursive: true });
  await writeFile(
    paths.understandingPath,
    `${JSON.stringify(
      {
        ...understanding,
        pageId: page.id,
        countrySlug: getRuntimeCountrySlugForPage(page),
        sceneId: page.sceneId ?? understanding.sceneId,
        nodeId: page.nodeId ?? understanding.nodeId,
        imageUrl: page.imageUrl ?? understanding.imageUrl,
        assetVersion: resolveAssetVersionForPage(page) ?? understanding.assetVersion,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
}

function createBaseUnderstanding(page) {
  const timestamp = new Date().toISOString();
  return {
    version: "semantic-regions-v1",
    pageId: page.id,
    countrySlug: getRuntimeCountrySlugForPage(page),
    sceneId: page.sceneId,
    nodeId: page.nodeId,
    imageUrl: page.imageUrl,
    assetVersion: resolveAssetVersionForPage(page),
    createdAt: timestamp,
    updatedAt: timestamp,
    regions: []
  };
}

function pointInBox(point, box) {
  if (!point || !box) return false;
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function boxAroundPoint(point, size) {
  const half = size / 2;
  const x = clamp01(point.x - half);
  const y = clamp01(point.y - half);
  return {
    x,
    y,
    width: Math.min(size, 1 - x),
    height: Math.min(size, 1 - y)
  };
}

function mergeBoxes(a, b) {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: x1,
    y: y1,
    width: Math.min(1 - x1, x2 - x1),
    height: Math.min(1 - y1, y2 - y1)
  };
}

function centerOfBox(box) {
  if (!box) return null;
  return {
    x: clamp01(box.x + box.width / 2),
    y: clamp01(box.y + box.height / 2)
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function createUnresolvedClickResult({ currentPage, normalizedClick, vlm }) {
  return {
    click: {
      status: "unmapped",
      nodeId: null,
      phrase: vlm.phrase ?? "unresolved illustrated detail",
      confidence: "unconfirmed",
      reason: "Runtime image click was not resolved with enough VLM confidence; refusing fallback hotspot navigation.",
      resolver: "vlm_guard"
    },
    page: {
      ...currentPage,
      parentClick: normalizedClick,
      status: "ready",
      plan: {
        title: "Click unresolved",
        factMode: "unverified_detour",
        imagePrompt: null
      }
    }
  };
}

function matchVlmPhraseForCurrentPage({ currentPage, phrase }) {
  const pack = getCountryPackForPage(currentPage);
  const currentNode = pack.nodes[currentPage?.nodeId];
  const scene = pack.scenes[currentPage?.sceneId];
  const candidates = [];
  const seen = new Set();

  for (const childId of currentNode?.childIds ?? []) {
    const child = pack.nodes[childId];
    if (!child || seen.has(childId)) continue;
    seen.add(childId);
    candidates.push({
      nodeId: childId,
      label: child.title,
      confidence: child.facts?.some((fact) => fact.confidence === "confirmed") ? "confirmed" : "general",
      action: actionForNode(childId, pack)
    });
  }

  if (scene?.rootNodeId === currentNode?.id) {
    for (const hotspot of scene.hotspots ?? []) {
      if (!hotspot.nodeId || seen.has(hotspot.nodeId)) continue;
      seen.add(hotspot.nodeId);
      candidates.push(hotspot);
    }
  }

  return matchClickPhraseToNode({
    phrase,
    candidates,
    nodes: pack.nodes
  });
}

function hasRuntimeGeneratedPage(page) {
  return String(page?.imageUrl ?? "").startsWith(RUNTIME_CACHE_URL_PREFIX);
}

function getCountryPackForPage(page) {
  return getCountryPack(getRuntimeCountrySlugForPage(page)) ?? defaultCountryPack;
}

function getRuntimeCountrySlugForPage(page) {
  return (
    sanitizeRuntimeCountrySlug(page?.countrySlug) ??
    getRuntimeCountrySlugFromUrl(page?.imageUrl) ??
    DEFAULT_RUNTIME_COUNTRY_SLUG
  );
}

function getRuntimeCountrySlugForJob(job) {
  return (
    sanitizeRuntimeCountrySlug(job?.countrySlug) ??
    getRuntimeCountrySlugFromUrl(job?.imageUrl) ??
    DEFAULT_RUNTIME_COUNTRY_SLUG
  );
}

function getRuntimeCountrySlugFromUrl(imageUrl) {
  const value = String(imageUrl ?? "");
  if (!value.startsWith(`${RUNTIME_CACHE_URL_PREFIX}/`)) return null;
  const relativePath = value.slice(RUNTIME_CACHE_URL_PREFIX.length + 1);
  const [firstSegment] = relativePath.split("/");
  if (!firstSegment || isLegacyRuntimeDirectory(firstSegment)) return null;
  return sanitizeRuntimeCountrySlug(firstSegment);
}

function resolveAssetVersionForPage(page) {
  return (
    page?.assetVersion ??
    page?.generated?.assetVersion ??
    extractAssetVersionFromRuntimeUrl(page?.imageUrl) ??
    extractAssetVersionFromRuntimeUrl(page?.generated?.jobUrl) ??
    null
  );
}

function extractAssetVersionFromRuntimeUrl(url) {
  const match = String(url ?? "").match(/\.([a-f0-9]{16})(?:\.partial)?\.(?:json|png|jpe?g|webp)$/i);
  return match?.[1] ?? null;
}

function sanitizeRuntimeCountrySlug(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

function isLegacyRuntimeDirectory(segment) {
  return ["image-jobs", "codex-jobs", "flipbook", "understanding", "environment"].includes(segment);
}

function actionForNode(nodeId, pack) {
  const scene = Object.values(pack.scenes).find((item) => item.rootNodeId === nodeId);
  return scene
    ? { type: "enter_scene", sceneId: scene.id }
    : { type: "open_node", nodeId };
}

async function handleCountryPacksRequest(url, response) {
  const countrySlug = String(url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const scope = url.searchParams.get("scope") ?? (countrySlug ? "full" : "summary");

  if (countrySlug) {
    const pack = countryPacks[countrySlug];
    if (!pack) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: `Unknown country pack: ${countrySlug}` }));
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    response.end(JSON.stringify({ countrySlug, countryPack: pack }));
    return;
  }

  const payload =
    scope === "full"
      ? { defaultCountrySlug: DEFAULT_COUNTRY_SLUG, countryPacks }
      : {
          defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
          countryPacks: summarizeCountryPackRegistry(countryPacks)
        };

  response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
  response.end(JSON.stringify(payload));
}

function summarizeCountryPackRegistry(packs) {
  return Object.fromEntries(
    Object.entries(packs).map(([countrySlug, pack]) => [countrySlug, summarizeCountryPack(pack)])
  );
}

function summarizeCountryPack(pack) {
  return {
    countryCode: pack.countryCode,
    countrySlug: pack.countrySlug,
    title: pack.title,
    rootNodeId: pack.rootNodeId,
    overviewSceneId: pack.overviewSceneId,
    confidence: pack.confidence,
    registration: pack.registration
  };
}

async function handleArtworkRequest(url, response) {
  const sceneId = url.searchParams.get("sceneId");
  const nodeId = url.searchParams.get("nodeId");
  const countrySlug = url.searchParams.get("countrySlug") ?? DEFAULT_COUNTRY_SLUG;
  const pack = getCountryPack(countrySlug);
  if (!pack) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country pack: ${countrySlug}` }));
    return;
  }

  const page = nodeId
    ? getDefaultArtworkPageForNode(nodeId, sceneId, pack.scenes, pack.nodes, pack.countrySlug, pack.title)
    : getDefaultArtworkPageForScene(sceneId, pack.scenes, pack.nodes, pack.countrySlug, pack.title);
  if (!page) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: nodeId ? `Unknown artwork node: ${nodeId}` : `Unknown artwork scene: ${sceneId}` }));
    return;
  }

  const isPrefetch = url.searchParams.get("prefetch") === "true" || url.searchParams.get("prefetch") === "priority";
  const isInteractivePriority = url.searchParams.get("priority") === "interactive";
  const jobKind = isInteractivePriority
    ? "interactive"
    : isPrefetch
    ? url.searchParams.get("prefetch") === "priority"
      ? "prefetch"
      : "artwork"
    : nodeId
    ? "interactive"
    : "artwork";
  const artworkPage = await createCodexImageJob(page, { jobKind });
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ page: artworkPage }));
}

async function handleCountryImageRequest(url, response) {
  const countrySlug = String(url.searchParams.get("countrySlug") ?? "").trim().toLowerCase();
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    respondCountryImageNotFound(response, null);
    return;
  }

  const image = await resolveCountryMediaImage(country);
  if (!image?.imageUrl) {
    respondCountryImageNotFound(response, country);
    return;
  }

  response.writeHead(302, {
    Location: withCountryImageCacheVersion(image.imageUrl, url.searchParams.get("v")),
    "Cache-Control": "public, max-age=86400",
    "X-RoamAtlas-Image-Source": image.source,
    "X-RoamAtlas-Image-Page": toSafeHeaderValue(image.pageTitle)
  });
  response.end();
}

function withCountryImageCacheVersion(imageUrl, version) {
  const cleanVersion = String(version ?? "").trim();
  if (!cleanVersion || !imageUrl.startsWith(COUNTRY_CARD_IMAGE_PUBLIC_PREFIX)) {
    return imageUrl;
  }
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}v=${encodeURIComponent(cleanVersion)}`;
}

function respondCountryImageNotFound(response, country) {
  response.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-RoamAtlas-Image-Source": "not-found"
  });
  response.end(JSON.stringify({
    error: country
      ? `No country media image found for ${country.name}`
      : "Unknown country"
  }));
}

async function resolveCountryMediaImage(country) {
  if (countryImageCache.has(country.slug)) {
    return countryImageCache.get(country.slug);
  }

  const localImage = await resolveLocalCountryCardImage(country);
  if (localImage) {
    countryImageCache.set(country.slug, localImage);
    return localImage;
  }

  const pageTitle = getCountryMediaPageTitle(country);
  const overrideUrl = getCountryImageOverrideUrl(country);
  let result = overrideUrl && isAllowedCountryMediaUrl(overrideUrl)
    ? {
        imageUrl: overrideUrl,
        source: "country-image-override",
        pageTitle: getCountryImageTopics(country)[0] ?? pageTitle
      }
    : null;
  if (!result) {
    result = await resolveCountryWikipediaArticleImage(country, pageTitle);
  }
  if (!result) {
    result = await resolveCountryLandmarkSearchImage(country, pageTitle);
  }
  if (!result) {
    result = await resolveCountryCommonsCategoryImage(pageTitle);
  }

  if (result) {
    result = await persistCountryCardImage(country, result);
    if (result.imageUrl.startsWith(COUNTRY_CARD_IMAGE_PUBLIC_PREFIX)) {
      countryImageCache.set(country.slug, result);
    }
  }
  return result;
}

async function resolveLocalCountryCardImage(country) {
  const localPath = await findExistingCountryCardImagePath(country);
  if (!localPath) return null;
  return {
    imageUrl: localPath.url,
    source: "local-country-card",
    pageTitle: country.name
  };
}

function getCountryCardImageBasenames(country) {
  const basenames = new Set([country.slug, country.code.toLowerCase()]);
  if (country.code === "PS") {
    basenames.add("palestine");
  }
  return [...basenames];
}

async function findExistingCountryCardImagePath(country) {
  for (const basename of getCountryCardImageBasenames(country)) {
    for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
      const filePath = path.join(COUNTRY_CARD_IMAGE_PUBLIC_DIR, `${basename}${ext}`);
      try {
        const fileStat = await stat(filePath);
        if (fileStat.isFile()) {
          return {
            filePath,
            url: `${COUNTRY_CARD_IMAGE_PUBLIC_PREFIX}/${basename}${ext}`
          };
        }
      } catch {
        // Try the next supported image extension.
      }
    }
  }
  return null;
}

async function persistCountryCardImage(country, image) {
  if (!image?.imageUrl || image.imageUrl.startsWith(COUNTRY_CARD_IMAGE_PUBLIC_PREFIX)) {
    return image;
  }

  try {
    const imageResponse = await fetch(image.imageUrl, createCountryImageDownloadOptions());
    if (!imageResponse.ok) return image;
    const contentType = imageResponse.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return image;

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBuffer.length === 0) return image;

    const extension = getCountryCardImageExtension(contentType, image.imageUrl);
    await mkdir(COUNTRY_CARD_IMAGE_PUBLIC_DIR, { recursive: true });
    const filePath = path.join(COUNTRY_CARD_IMAGE_PUBLIC_DIR, `${country.slug}${extension}`);
    await writeFile(filePath, imageBuffer);

    return {
      ...image,
      imageUrl: `${COUNTRY_CARD_IMAGE_PUBLIC_PREFIX}/${country.slug}${extension}`,
      source: `${image.source}:local-cache`
    };
  } catch {
    return image;
  }
}

function toSafeHeaderValue(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, "")
    .slice(0, 240);
}

const PLACE_IMAGE_FACT_BOUNDARY =
  "Reference photo from an external search result. It is not evidence of current appearance, availability, or official status.";
const PLACE_IMAGE_HISTORY_LIMIT = 6;

async function handlePlaceImageRequest(url, response) {
  const countrySlug = String(url.searchParams.get("countrySlug") ?? "").trim().toLowerCase();
  const place = String(url.searchParams.get("place") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const context = String(url.searchParams.get("context") ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const feedback = normalizePlaceImageFeedback(url.searchParams.get("feedback"));
  const kind = String(url.searchParams.get("kind") ?? "").trim().toLowerCase();
  const tags = String(url.searchParams.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  const country = getCountryBySlug(countrySlug);
  if (!country || !place) {
    respondPlaceImageNotFound(response, "unknown-country-or-place");
    return;
  }

  const record = await resolvePlaceImage(country, place, { context, kind, tags, feedback });
  if (!record?.imageUrl) {
    respondPlaceImageNotFound(response, record?.reason ?? "no-image-found");
    return;
  }

  // Serve our cached copy directly. A redirect worked in normal browsers, but
  // embedded webviews can leave an <img> in a permanent pending state after
  // following it. The cache is already local and immutable, so returning the
  // bytes here is both simpler and more reliable for the config thumbnails.
  const cachedImagePath = getImagePathFromUrl(record.imageUrl);
  if (cachedImagePath) {
    try {
      const image = await readFile(cachedImagePath);
      response.writeHead(200, {
        "Content-Type": mimeTypeForImagePath(cachedImagePath),
        // The server-side copy is the cache. Do not let the browser retain a
        // stale thumbnail after the user resets generated visuals.
        "Cache-Control": "no-store",
        "X-RoamAtlas-Image-Source": toSafeHeaderValue(record.source),
        "X-RoamAtlas-Image-Page": toSafeHeaderValue(record.sourceUrl)
      });
      response.end(image);
      return;
    } catch {
      // The record can outlive a manually deleted image; fall back to the
      // redirect path below so the normal image error handling remains intact.
    }
  }

  response.writeHead(302, {
    Location: record.imageUrl,
    "Cache-Control": "no-store",
    "X-RoamAtlas-Image-Source": toSafeHeaderValue(record.source),
    "X-RoamAtlas-Image-Page": toSafeHeaderValue(record.sourceUrl)
  });
  response.end();
}

async function handlePlaceImageResetRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const place = String(body.place ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const result = place
    ? await resetStoredPlaceImage(country, place)
    : await resetStoredCountryPlaceImages(country);
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    countrySlug: country.slug,
    countryName: country.name,
    ...result
  }));
}

async function handlePlaceImageFeedbackRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const place = String(body.place ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const feedback = normalizePlaceImageFeedback(body.feedback);
  const country = getCountryBySlug(countrySlug);
  if (!country || !place || !feedback) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "A country, place, and photo feedback are required." }));
    return;
  }

  // Feedback only steers a new external reference-photo search. It never
  // changes the curated place data or becomes a travel claim.
  const result = await resetStoredPlaceImage(country, place, { preserveHistory: true });
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    countrySlug: country.slug,
    countryName: country.name,
    place,
    feedback,
    ...result,
    factBoundary: "Photo feedback is used only to refine the external reference-image search. Curated travel data was not changed."
  }));
}

async function handlePlaceImageSuggestionsRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const place = String(body.place ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const kind = String(body.kind ?? "region").replace(/[^a-z-]/gi, "").trim().toLowerCase().slice(0, 32) || "region";
  const currentFeedback = normalizePlaceImageFeedback(body.currentFeedback);
  const country = getCountryBySlug(countrySlug);
  const mappedLocation = getMappedPlaceImageSuggestionContext(country, place);
  if (!country || !place || !mappedLocation) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "A country and a mapped place are required." }));
    return;
  }

  const result = await suggestPlaceImagePrompts(country, {
    place: mappedLocation.title,
    context: mappedLocation.children,
    kind: mappedLocation.kind ?? kind,
    currentFeedback
  });
  response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify({
    countrySlug: country.slug,
    place,
    suggestions: result.suggestions,
    source: result.source,
    factBoundary: "Prompt suggestions only steer an external reference-image search. They are not travel facts."
  }));
}

async function handlePlaceImageHistoryRequest(url, response) {
  const countrySlug = String(url.searchParams.get("countrySlug") ?? "").trim().toLowerCase();
  const place = String(url.searchParams.get("place") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const country = getCountryBySlug(countrySlug);
  if (!country || !place) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "A country and place are required." }));
    return;
  }

  const history = await readPlaceImageHistory(country, place);
  response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify({
    countrySlug: country.slug,
    place,
    items: history.map(toPlaceImageHistoryItem),
    factBoundary: PLACE_IMAGE_FACT_BOUNDARY
  }));
}

async function handlePlaceImageHistorySelectionRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const place = String(body.place ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const entryId = String(body.entryId ?? "").trim();
  const country = getCountryBySlug(countrySlug);
  if (!country || !place || !entryId) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "A country, place, and saved photo are required." }));
    return;
  }

  const result = await selectPlaceImageHistoryEntry(country, place, entryId);
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ countrySlug: country.slug, place, ...result }));
}

function normalizePlaceImageFeedback(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function getMappedPlaceImageSuggestionContext(country, place) {
  const normalizedPlace = String(place ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const pack = country ? getCountryPack(country.slug) : null;
  const node = Object.values(pack?.nodes ?? {}).find(
    (candidate) => String(candidate?.title ?? "").replace(/\s+/g, " ").trim().toLowerCase() === normalizedPlace
  );
  if (!node) return null;
  return {
    title: node.title,
    kind: node.type ?? node.tags?.[0] ?? "region",
    children: (node.childIds ?? [])
      .map((childId) => pack.nodes[childId]?.title)
      .filter(Boolean)
      .slice(0, 6)
  };
}

async function suggestPlaceImagePrompts(country, { place, context = [], kind = "region", currentFeedback = "" }) {
  const fallback = buildPlaceImagePromptSuggestionFallbacks(country, { place, context, currentFeedback });
  if (!process.env.OPENAI_API_KEY) return { suggestions: fallback, source: "curated-fallback" };

  const prompt = [
    "You write short search prompts for selecting an unverified reference photo.",
    "Return JSON only with this exact shape: {\"suggestions\":[\"...\",\"...\",\"...\"]}.",
    "Use only the supplied mapped location title and mapped child names. Do not invent places, landmarks, facts, opening hours, routes, or claims.",
    "Each suggestion must be a concise search instruction for a real photograph and should identify one supplied mapped location or the supplied region.",
    "Avoid generic Singapore landmarks that are not in the supplied mapped context.",
    "",
    `Country: ${country.name}`,
    `Mapped location: ${place}`,
    `Location type: ${kind}`,
    `Mapped child context: ${context.length ? context.join(" | ") : "None supplied"}`,
    `Current user feedback: ${currentFeedback || "None"}`
  ].join("\n");

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: appConfig.ai.textModel,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        temperature: 0.1
      })
    });
    if (!openaiResponse.ok) return { suggestions: fallback, source: "curated-fallback" };
    const parsed = parseJsonObject(extractOpenAIText(await openaiResponse.json()));
    const suggestions = normalizePlaceImagePromptSuggestions(parsed?.suggestions, { place, context });
    return { suggestions: suggestions.length ? suggestions : fallback, source: suggestions.length ? "llm" : "curated-fallback" };
  } catch {
    return { suggestions: fallback, source: "curated-fallback" };
  }
}

function normalizePlaceImagePromptSuggestions(value, { place, context }) {
  const allowedTerms = [place, ...(Array.isArray(context) ? context : [])]
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item) => item.length >= 3);
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => normalizePlaceImageFeedback(item))
    .filter((item) => item.length >= 12)
    .filter((item) => allowedTerms.some((term) => item.toLowerCase().includes(term)))
    .slice(0, 3))];
}

function buildPlaceImagePromptSuggestionFallbacks(country, { place, context, currentFeedback }) {
  const mappedChildren = Array.isArray(context) ? context.filter(Boolean).slice(0, 3) : [];
  const base = `${place} ${country.name}`.trim();
  const suggestions = mappedChildren.length
    ? mappedChildren.map((child) => `Show ${child} in ${country.name}; use a representative real photograph.`)
    : [`Show ${base} as a representative real photograph.`];
  suggestions.push(
    currentFeedback
      ? `${currentFeedback} Keep the search within ${place}, ${country.name}.`
      : `Show a real photograph of ${base}; avoid generic Singapore landmarks outside this mapped area.`
  );
  return [...new Set(suggestions.map((suggestion) => normalizePlaceImageFeedback(suggestion)))].slice(0, 3);
}

function respondPlaceImageNotFound(response, reason) {
  response.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-RoamAtlas-Image-Source": "not-found"
  });
  response.end(JSON.stringify({ error: "No place image found", reason }));
}

async function resetStoredCountryPlaceImages(country) {
  const countryCacheRoot = path.normalize(path.join(runtimeCacheRoot, country.slug));
  const placeImagesRoot = path.normalize(path.join(countryCacheRoot, "place-images"));
  if (!isPathInside(runtimeCacheRoot, countryCacheRoot) || !isPathInside(countryCacheRoot, placeImagesRoot)) {
    throw new Error(`Unsafe place image cache path for ${country.slug}.`);
  }

  await settlePlaceImageRequestsForCountry(country.slug);
  await rm(placeImagesRoot, { recursive: true, force: true });
  clearPlaceImageRuntimeMemory(country.slug);
  return {
    reset: true,
    scope: "all-place-images",
    removedFolders: ["place-images"],
    factBoundary: "Reference-photo cache was cleared. Starter-map builder data and generated map illustrations were not changed."
  };
}

async function resetStoredPlaceImage(country, place, { preserveHistory = false } = {}) {
  const paths = createPlaceImageCachePaths({
    cacheRoot: runtimeCacheRoot,
    countrySlug: country.slug,
    place
  });
  if (!isPathInside(runtimeCacheRoot, paths.countryCacheRoot)) {
    throw new Error(`Unsafe place image cache path for ${country.slug}.`);
  }

  await settlePlaceImageRequestsForPlace(paths);
  let record = null;
  try {
    record = JSON.parse(await readFile(paths.metadataPath, "utf8"));
  } catch {
    record = null;
  }

  const archived = preserveHistory
    ? await archiveStoredPlaceImage(paths, record)
    : null;

  const imagePaths = [".jpg", ".jpeg", ".png", ".webp"]
    .map((extension) => paths.imagePathForExtension(extension))
    .filter((imagePath) => isPathInside(paths.countryCacheRoot, path.normalize(imagePath)));
  await Promise.all([
    rm(paths.metadataPath, { force: true }),
    ...imagePaths.map((imagePath) => rm(imagePath, { force: true })),
    ...(preserveHistory ? [] : [rm(paths.historyMetadataPath, { force: true }), rm(paths.historyRoot, { recursive: true, force: true })])
  ]);
  clearPlaceImageRuntimeMemory(country.slug, {
    placeSlug: paths.placeSlug,
    place,
    claimKey: record ? getPlaceImageRecordClaimKey(record) : ""
  });
  return {
    reset: true,
    scope: "single-place-image",
    place,
    removedFiles: [paths.metadataPath, ...imagePaths],
    archived,
    factBoundary: preserveHistory
      ? "The current reference photo was saved to its local history before a fresh search. Starter-map builder data and generated map illustrations were not changed."
      : "One reference-photo cache entry was cleared. Starter-map builder data and generated map illustrations were not changed."
  };
}

async function archiveStoredPlaceImage(paths, record) {
  if (!record?.imageUrl) return null;
  const currentImagePath = getImagePathFromUrl(record.imageUrl);
  if (!currentImagePath || !isPathInside(paths.countryCacheRoot, currentImagePath)) return null;

  let imageBytes;
  try {
    imageBytes = await readFile(currentImagePath);
  } catch {
    return null;
  }

  const extension = getPlaceImageExtension(record.imageUrl);
  const id = randomUUID();
  const historyImagePath = paths.historyImagePathForExtension(id, extension);
  const historyImageUrl = paths.historyImageUrlForExtension(id, extension);
  if (!isPathInside(paths.countryCacheRoot, historyImagePath)) return null;

  const entry = {
    ...record,
    id,
    imageUrl: historyImageUrl,
    archivedAt: new Date().toISOString()
  };
  const manifest = await readPlaceImageHistoryManifest(paths);
  const entries = [...manifest.entries, entry];
  const prunedEntries = entries.slice(0, Math.max(0, entries.length - PLACE_IMAGE_HISTORY_LIMIT));
  const retainedEntries = entries.slice(-PLACE_IMAGE_HISTORY_LIMIT);

  await mkdir(paths.historyRoot, { recursive: true });
  await writeFile(historyImagePath, imageBytes);
  await writePlaceImageHistoryManifest(paths, { ...manifest, entries: retainedEntries });
  await Promise.all(prunedEntries.map((item) => {
    const stalePath = getImagePathFromUrl(item.imageUrl);
    return stalePath && isPathInside(paths.countryCacheRoot, stalePath)
      ? rm(stalePath, { force: true })
      : Promise.resolve();
  }));
  return entry;
}

async function readPlaceImageHistory(country, place) {
  const paths = createPlaceImageCachePaths({ cacheRoot: runtimeCacheRoot, countrySlug: country.slug, place });
  const manifest = await readPlaceImageHistoryManifest(paths);
  const saved = [];
  for (const entry of manifest.entries) {
    const imagePath = getImagePathFromUrl(entry?.imageUrl ?? "");
    if (!imagePath || !isPathInside(paths.countryCacheRoot, imagePath)) continue;
    try {
      await stat(imagePath);
      saved.push({ ...entry, active: false });
    } catch {
      // Ignore a history entry whose image was manually removed.
    }
  }

  const active = await readStoredPlaceImageRecord(paths, { place });
  if (active?.imageUrl) saved.push({ ...active, id: "current", active: true });
  return saved;
}

function toPlaceImageHistoryItem(record) {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    active: Boolean(record.active),
    feedback: record.feedback ?? null,
    fetchedAt: record.fetchedAt ?? null,
    archivedAt: record.archivedAt ?? null
  };
}

async function selectPlaceImageHistoryEntry(country, place, entryId) {
  const paths = createPlaceImageCachePaths({ cacheRoot: runtimeCacheRoot, countrySlug: country.slug, place });
  await settlePlaceImageRequestsForPlace(paths);
  const manifest = await readPlaceImageHistoryManifest(paths);
  const target = manifest.entries.find((entry) => entry.id === entryId);
  if (!target) throw new Error("That saved reference photo is no longer available.");

  const targetImagePath = getImagePathFromUrl(target.imageUrl);
  if (!targetImagePath || !isPathInside(paths.countryCacheRoot, targetImagePath)) {
    throw new Error("That saved reference photo has an invalid cache path.");
  }
  const targetImage = await readFile(targetImagePath);
  const targetExtension = getPlaceImageExtension(target.imageUrl);

  let activeRecord = null;
  try {
    activeRecord = JSON.parse(await readFile(paths.metadataPath, "utf8"));
  } catch {
    activeRecord = null;
  }
  if (activeRecord?.imageUrl) await archiveStoredPlaceImage(paths, activeRecord);

  const refreshedManifest = await readPlaceImageHistoryManifest(paths);
  const nextEntries = refreshedManifest.entries.filter((entry) => entry.id !== entryId);
  await Promise.all([
    writeFile(paths.imagePathForExtension(targetExtension), targetImage),
    rm(targetImagePath, { force: true }),
    writePlaceImageHistoryManifest(paths, { ...refreshedManifest, entries: nextEntries })
  ]);

  const { id, active, archivedAt, imageUrl: _historyUrl, ...restored } = target;
  const record = {
    ...restored,
    imageUrl: paths.imageUrlForExtension(targetExtension),
    selectedAt: new Date().toISOString()
  };
  await writeStoredPlaceImageRecord(paths, record);
  clearPlaceImageRuntimeMemory(country.slug, {
    placeSlug: paths.placeSlug,
    place,
    claimKey: activeRecord ? getPlaceImageRecordClaimKey(activeRecord) : ""
  });
  reservePlaceImageClaim(paths.countrySlug, place, getPlaceImageRecordClaimKey(record));
  return { selected: true, record: toPlaceImageHistoryItem({ ...record, id: "current", active: true }) };
}

async function readPlaceImageHistoryManifest(paths) {
  try {
    const manifest = JSON.parse(await readFile(paths.historyMetadataPath, "utf8"));
    return {
      place: manifest.place ?? paths.placeSlug,
      countrySlug: manifest.countrySlug ?? paths.countrySlug,
      entries: Array.isArray(manifest.entries) ? manifest.entries : []
    };
  } catch {
    return { place: paths.placeSlug, countrySlug: paths.countrySlug, entries: [] };
  }
}

async function writePlaceImageHistoryManifest(paths, manifest) {
  await mkdir(path.dirname(paths.historyMetadataPath), { recursive: true });
  await writeFile(paths.historyMetadataPath, JSON.stringify(manifest, null, 2));
}

function getPlaceImageExtension(imageUrl) {
  const extension = path.extname(String(imageUrl ?? "").split("?")[0]).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".jpg";
}

async function settlePlaceImageRequestsForCountry(countrySlug) {
  const prefix = `${countrySlug}:`;
  const requests = [...placeImageRequestsInFlight.entries()]
    .filter(([cacheKey]) => cacheKey.startsWith(prefix))
    .map(([, request]) => request);
  if (requests.length) await Promise.allSettled(requests);
}

async function settlePlaceImageRequestsForPlace(paths) {
  const cacheKey = `${paths.countrySlug}:${paths.placeSlug}:${PLACE_IMAGE_SELECTION_VERSION}`;
  const request = placeImageRequestsInFlight.get(cacheKey);
  if (request) await Promise.allSettled([request]);
}

async function resolvePlaceImage(country, place, { context = "", kind = "", tags = [], feedback = "" } = {}) {
  const paths = createPlaceImageCachePaths({
    cacheRoot: runtimeCacheRoot,
    countrySlug: country.slug,
    place
  });
  const cacheKey = `${paths.countrySlug}:${paths.placeSlug}:${PLACE_IMAGE_SELECTION_VERSION}`;
  if (placeImageCache.has(cacheKey)) {
    return placeImageCache.get(cacheKey);
  }
  if (placeImageRequestsInFlight.has(cacheKey)) {
    return placeImageRequestsInFlight.get(cacheKey);
  }

  const request = resolvePlaceImageUncached(country, place, { context, kind, tags, feedback }, paths)
    .then((record) => {
      placeImageCache.set(cacheKey, record);
      return record;
    })
    .finally(() => {
      placeImageRequestsInFlight.delete(cacheKey);
    });
  placeImageRequestsInFlight.set(cacheKey, request);
  return request;
}

async function resolvePlaceImageUncached(country, place, { context = "", kind = "", tags = [], feedback = "" }, paths) {
  const storedRecord = await readStoredPlaceImageRecord(paths, { place });
  if (storedRecord) return storedRecord;

  if (!process.env.EXA_API_KEY) {
    // Do not persist provider-missing results; a key may be added later.
    return { imageUrl: null, reason: "exa-key-missing" };
  }

  const profile = inferPlaceImageProfile({
    place,
    countryName: country.name,
    countrySlug: country.slug,
    kind,
    tags,
    context
  });
  const normalizedFeedback = normalizePlaceImageFeedback(feedback);
  if (normalizedFeedback) {
    profile.queries.unshift(
      `${place} ${context} ${country.name} ${normalizedFeedback} reference photograph`
        .replace(/\s+/g, " ")
        .trim()
    );
  }
  const candidates = await searchExaPlaceImageCandidates(country, place, { context, kind, tags }, profile);
  for (const candidate of candidates) {
    const claimKey = getPlaceImageCandidateClaimKey(candidate);
    if (await isPlaceImageClaimedByAnotherPlace(paths, place, claimKey)) {
      continue;
    }
    reservePlaceImageClaim(paths.countrySlug, place, claimKey);
    const record = await persistPlaceImage(paths, {
      country,
      place,
      candidate,
      profile,
      feedback: normalizedFeedback
    });
    if (record) return record;
    releasePlaceImageClaim(paths.countrySlug, place, claimKey);
  }

  // A broad search result can legitimately be empty for a named district even
  // when its well-known curated children have usable article photos. Use that
  // as a reference-image fallback only; it never changes travel facts.
  const wikipediaCandidate = await resolvePlaceWikipediaImage(country, place, { context });
  if (wikipediaCandidate) {
    const claimKey = getPlaceImageCandidateClaimKey(wikipediaCandidate);
    if (!await isPlaceImageClaimedByAnotherPlace(paths, place, claimKey)) {
      reservePlaceImageClaim(paths.countrySlug, place, claimKey);
      const record = await persistPlaceImage(paths, {
        country,
        place,
        candidate: wikipediaCandidate,
        profile,
        feedback: normalizedFeedback
      });
      if (record) return record;
      releasePlaceImageClaim(paths.countrySlug, place, claimKey);
    }
  }

  const notFoundRecord = {
    place,
    countrySlug: country.slug,
    imageUrl: null,
    sourceUrl: null,
    source: "exa_place_search",
    reason: "no-image-found",
    selectionVersion: PLACE_IMAGE_SELECTION_VERSION,
    fetchedAt: new Date().toISOString(),
    factBoundary: PLACE_IMAGE_FACT_BOUNDARY
  };
  await writeStoredPlaceImageRecord(paths, notFoundRecord);
  return notFoundRecord;
}

async function readStoredPlaceImageRecord(paths, { place = null } = {}) {
  try {
    const record = JSON.parse(await readFile(paths.metadataPath, "utf8"));
    if (record.selectionVersion !== PLACE_IMAGE_SELECTION_VERSION) {
      return null;
    }
    if (!record.imageUrl) return record;
    const imagePath = path.normalize(
      path.join(runtimeCacheRoot, decodeURIComponent(record.imageUrl.slice(RUNTIME_CACHE_URL_PREFIX.length + 1)))
    );
    await stat(imagePath);
    const claimKey = getPlaceImageRecordClaimKey(record);
    if (await isPlaceImageClaimedByAnotherPlace(paths, place ?? record.place, claimKey)) {
      return null;
    }
    reservePlaceImageClaim(paths.countrySlug, place ?? record.place, claimKey);
    return record;
  } catch {
    return null;
  }
}

async function isPlaceImageClaimedByAnotherPlace(paths, place, claimKey) {
  if (!claimKey) return false;
  const normalizedPlace = normalizePlaceImageClaimPlace(place);
  const memoryClaim = placeImageClaimsByCountry.get(paths.countrySlug)?.get(claimKey);
  if (memoryClaim && memoryClaim !== normalizedPlace) return true;

  const records = await listStoredPlaceImageRecords(paths.countryCacheRoot);
  return records.some((record) => {
    if (record.selectionVersion !== PLACE_IMAGE_SELECTION_VERSION) return false;
    if (normalizePlaceImageClaimPlace(record.place) === normalizedPlace) return false;
    return getPlaceImageRecordClaimKey(record) === claimKey;
  });
}

async function listStoredPlaceImageRecords(countryCacheRoot) {
  try {
    const dir = path.join(countryCacheRoot, "place-images");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
    const records = [];
    for (const file of files) {
      try {
        records.push(JSON.parse(await readFile(path.join(dir, file), "utf8")));
      } catch {
        // Ignore corrupt or half-written place-image metadata.
      }
    }
    return records;
  } catch {
    return [];
  }
}

function reservePlaceImageClaim(countrySlug, place, claimKey) {
  if (!claimKey) return;
  let claims = placeImageClaimsByCountry.get(countrySlug);
  if (!claims) {
    claims = new Map();
    placeImageClaimsByCountry.set(countrySlug, claims);
  }
  claims.set(claimKey, normalizePlaceImageClaimPlace(place));
}

function releasePlaceImageClaim(countrySlug, place, claimKey) {
  if (!claimKey) return;
  const claims = placeImageClaimsByCountry.get(countrySlug);
  if (claims?.get(claimKey) === normalizePlaceImageClaimPlace(place)) {
    claims.delete(claimKey);
  }
}

function getPlaceImageCandidateClaimKey(candidate) {
  return normalizePlaceImageClaimUrl(candidate?.imageUrl);
}

function getPlaceImageRecordClaimKey(record) {
  return normalizePlaceImageClaimUrl(record?.remoteImageUrl ?? record?.imageUrl);
}

function normalizePlaceImageClaimUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "http://runtime.local");
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function normalizePlaceImageClaimPlace(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function writeStoredPlaceImageRecord(paths, record) {
  try {
    await mkdir(path.dirname(paths.metadataPath), { recursive: true });
    await writeFile(paths.metadataPath, JSON.stringify(record, null, 2));
  } catch (error) {
    console.warn(`Place image metadata write failed for ${record.place}: ${String(error?.message ?? error)}`);
  }
}

async function searchExaPlaceImageCandidates(country, place, { context = "", kind = "", tags = [] }, profile) {
  const queries = buildPlaceImageSearchQueries(profile);
  const candidates = [];
  const seen = new Set();

  for (const query of queries) {
    const batch = await searchExaPlaceImageQuery(query);
    for (const candidate of batch) {
      if (seen.has(candidate.imageUrl)) continue;
      seen.add(candidate.imageUrl);
      candidates.push({ ...candidate, query });
    }
    if (candidates.length >= 10) break;
  }

  return rankPlaceImageCandidates(candidates, profile).slice(0, 8);
}

async function searchExaPlaceImageQuery(query) {
  let exaResponse;
  try {
    exaResponse = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": process.env.EXA_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        contents: { extras: { imageLinks: 2 } }
      })
    });
  } catch (error) {
    console.warn(`Exa place image search failed for ${query}: ${String(error?.message ?? error)}`);
    return [];
  }

  if (!exaResponse.ok) {
    console.warn(`Exa place image search failed for ${query}: ${exaResponse.status} ${await exaResponse.text()}`);
    return [];
  }

  let payload;
  try {
    payload = await exaResponse.json();
  } catch {
    return [];
  }

  const candidates = [];
  for (const result of Array.isArray(payload?.results) ? payload.results : []) {
    const sourceUrl = String(result?.url ?? "").trim();
    const imageUrls = [result?.image, ...(Array.isArray(result?.extras?.imageLinks) ? result.extras.imageLinks : [])];
    for (const imageUrl of imageUrls) {
      if (isUsablePlaceImageUrl(imageUrl)) {
        candidates.push({ imageUrl: String(imageUrl).trim(), sourceUrl });
      }
    }
  }
  return candidates;
}

async function persistPlaceImage(paths, { country, place, candidate, profile, feedback = "" }) {
  try {
    const imageResponse = await fetch(candidate.imageUrl, createCountryImageDownloadOptions());
    if (!imageResponse.ok) return null;
    const contentType = imageResponse.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") || contentType.includes("svg")) return null;

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBuffer.length < 4096) return null;
    if (!hasUsablePlaceImageDimensions(imageBuffer, contentType)) return null;

    const extension = getCountryCardImageExtension(contentType, candidate.imageUrl);
    const imagePath = paths.imagePathForExtension(extension);
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, imageBuffer);

    const record = {
      place,
      countrySlug: country.slug,
      imageUrl: paths.imageUrlForExtension(extension),
      remoteImageUrl: candidate.imageUrl,
      sourceUrl: candidate.sourceUrl,
      query: candidate.query,
      feedback: normalizePlaceImageFeedback(feedback) || null,
      selectionVersion: PLACE_IMAGE_SELECTION_VERSION,
      selectionStrategy: profile?.strategy ?? null,
      selectionScore: candidate.score ?? null,
      source: "exa_place_search:local-cache",
      fetchedAt: new Date().toISOString(),
      factBoundary: PLACE_IMAGE_FACT_BOUNDARY
    };
    await writeStoredPlaceImageRecord(paths, record);
    return record;
  } catch {
    return null;
  }
}

function hasUsablePlaceImageDimensions(imageBuffer, contentType) {
  const dimensions = readPlaceImageDimensions(imageBuffer, contentType);
  if (!dimensions) return true;
  const { width, height } = dimensions;
  if (width < 240 || height < 160) return false;
  const ratio = width / height;
  return ratio >= 0.28 && ratio <= 3.5;
}

function readPlaceImageDimensions(imageBuffer, contentType) {
  if (contentType.includes("image/png") && imageBuffer.length >= 24 && imageBuffer.toString("ascii", 1, 4) === "PNG") {
    return { width: imageBuffer.readUInt32BE(16), height: imageBuffer.readUInt32BE(20) };
  }
  if (!contentType.includes("image/jpeg") && !contentType.includes("image/jpg")) return null;
  let offset = 2;
  while (offset + 9 < imageBuffer.length) {
    if (imageBuffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = imageBuffer[offset + 1];
    const length = imageBuffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: imageBuffer.readUInt16BE(offset + 5), width: imageBuffer.readUInt16BE(offset + 7) };
    }
    offset += length + 2;
  }
  return null;
}

async function resolvePlaceWikipediaImage(country, place, { context = "" } = {}) {
  const titles = getPlaceWikipediaArticleCandidates(country, place, context);
  if (!titles.length) return null;
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query",
    titles: titles.join("|"),
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "960",
    format: "json",
    origin: "*"
  }).toString();
  try {
    const response = await fetch(endpoint, createCountryImageFetchOptions());
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) return null;
    const pages = Object.values((await response.json())?.query?.pages ?? {});
    const candidates = pages
      .map((page) => ({
        imageUrl: String(page?.thumbnail?.source ?? "").trim(),
        pageTitle: String(page?.title ?? "").trim()
      }))
      .filter((candidate) => candidate.imageUrl && isUsablePlaceImageUrl(candidate.imageUrl))
      .sort((left, right) => titles.indexOf(left.pageTitle) - titles.indexOf(right.pageTitle));
    const selected = candidates[0];
    if (!selected) return null;
    return {
      imageUrl: selected.imageUrl,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(selected.pageTitle.replace(/\s+/g, "_"))}`,
      query: "wikipedia article reference-photo fallback"
    };
  } catch {
    return null;
  }
}

function getPlaceWikipediaArticleCandidates(country, place, context) {
  return [...new Set([
    place,
    `${place}, ${country.name}`,
    ...String(context).split(/\s{2,}|\n|(?<=\bBay)\s+(?=Sands|Gardens)/).map((item) => item.trim())
  ])]
    .filter(Boolean)
    .slice(0, 8);
}

function getCountryCardImageExtension(contentType, imageUrl) {
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) return ".jpg";
  try {
    const pathname = new URL(imageUrl).pathname.toLowerCase();
    const extension = path.extname(pathname);
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) return extension;
  } catch {
    // Fall through to jpeg as the most common Wikimedia thumbnail format.
  }
  return ".jpg";
}

async function resolveCountryWikipediaArticleImage(country, pageTitle) {
  const candidateTitles = getCountryWikipediaArticleCandidates(country, pageTitle);
  if (!candidateTitles.length) return null;

  const pageImageUrl = new URL("https://en.wikipedia.org/w/api.php");
  pageImageUrl.search = new URLSearchParams({
    action: "query",
    titles: candidateTitles.join("|"),
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "960",
    format: "json",
    origin: "*"
  }).toString();

  try {
    const pageImageResponse = await fetch(pageImageUrl, createCountryImageFetchOptions());
    if (!pageImageResponse.ok) return null;
    const contentType = pageImageResponse.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    const payload = await pageImageResponse.json();
    const image = selectCountryArticleImage(
      Object.values(payload?.query?.pages ?? {}),
      candidateTitles,
      pageTitle
    );
    if (image) {
      return {
        ...image,
        source: "wikipedia-article-pageimage",
        pageTitle: image.pageTitle
      };
    }
  } catch {
    // Try the Commons search path if Wikipedia throttles or has no article thumbnail.
  }

  return null;
}

async function resolveCountryLandmarkSearchImage(country, pageTitle) {
  for (const topic of getCountryImageTopics(country)) {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: topic,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "960",
      format: "json",
      origin: "*"
    }).toString();

    try {
      const searchResponse = await fetch(searchUrl, createCountryImageFetchOptions());
      if (!searchResponse.ok) continue;
      const contentType = searchResponse.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) continue;
      const payload = await searchResponse.json();
      const image = selectCountrySearchImage(Object.values(payload?.query?.pages ?? {}), topic, pageTitle);
      if (image) {
        return {
          ...image,
          source: "wikimedia-commons-search",
          pageTitle: topic
        };
      }
    } catch {
      // Try the next landmark topic before falling back to broad country media.
    }
  }

  return null;
}

async function resolveCountryCommonsCategoryImage(pageTitle) {
  for (const categoryTitle of getCountryMediaCategoryTitles(pageTitle)) {
    const categoryUrl = new URL("https://commons.wikimedia.org/w/api.php");
    categoryUrl.search = new URLSearchParams({
      action: "query",
      generator: "categorymembers",
      gcmtitle: `Category:${categoryTitle}`,
      gcmtype: "file",
      gcmlimit: "16",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "960",
      format: "json",
      origin: "*"
    }).toString();

    try {
      const categoryResponse = await fetch(categoryUrl, createCountryImageFetchOptions());
      if (!categoryResponse.ok) continue;
      const payload = await categoryResponse.json();
      const image = selectCountryCommonsImage(Object.values(payload?.query?.pages ?? {}), pageTitle);
      if (image) {
        return {
          ...image,
          source: "wikimedia-commons-category",
          pageTitle: categoryTitle
        };
      }
    } catch {
      // Try the next category before falling back to page media.
    }
  }

  return null;
}

function getCountryWikipediaArticleCandidates(country, pageTitle) {
  const candidates = [];
  for (const topic of getCountryImageTopics(country)) {
    const normalizedTopic = normalizeCountryArticleTitle(topic);
    if (!normalizedTopic) continue;

    candidates.push(normalizedTopic);
    for (const variant of getCountryNameVariants(country, pageTitle)) {
      const stripped = normalizedTopic.replace(new RegExp(`^${escapeRegExp(variant)}\\s+`, "i"), "").trim();
      if (stripped && stripped !== normalizedTopic) {
        candidates.push(stripped);
      }
    }

    const words = normalizedTopic.split(/\s+/).filter(Boolean);
    for (let dropCount = 1; dropCount <= Math.min(5, words.length - 1); dropCount += 1) {
      const suffix = words.slice(dropCount).join(" ");
      if (suffix.length >= 4) {
        candidates.push(suffix);
      }
    }
  }

  return [...new Set(candidates)]
    .filter((title) => title && !isCountryArticleTitleTooGeneric(title, country, pageTitle))
    .slice(0, 14);
}

function getCountryNameVariants(country, pageTitle) {
  return [
    pageTitle,
    country.name,
    country.name.replace(/\s*&\s*/g, " and "),
    country.name.replace(/^St\.\s+/i, "Saint "),
    country.code
  ]
    .map(normalizeCountryArticleTitle)
    .filter(Boolean);
}

function normalizeCountryArticleTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[’]/g, "'")
    .trim();
}

function isCountryArticleTitleTooGeneric(title, country, pageTitle) {
  const normalizedTitle = title.toLowerCase();
  return (
    normalizedTitle === country.name.toLowerCase() ||
    normalizedTitle === pageTitle.toLowerCase() ||
    normalizedTitle === country.code.toLowerCase() ||
    ["city", "capital city", "skyline", "beach", "lagoon", "island"].includes(normalizedTitle)
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectCountryArticleImage(pages, candidateTitles, pageTitle) {
  const candidateRanks = new Map(
    candidateTitles.map((title, index) => [title.toLowerCase(), index])
  );
  const candidates = pages
    .map((page) => {
      const pageTitleValue = String(page?.title ?? "");
      const imageUrl = page?.thumbnail?.source ?? null;
      const rank = candidateRanks.get(pageTitleValue.toLowerCase()) ?? candidateTitles.length;
      return {
        pageTitle: pageTitleValue,
        imageUrl,
        score: scoreCountryArticleImage(pageTitleValue, imageUrl, pageTitle, rank)
      };
    })
    .filter((candidate) =>
      candidate.imageUrl &&
      candidate.score > 0 &&
      isAllowedCountryMediaUrl(candidate.imageUrl) &&
      !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(candidate.pageTitle) &&
      !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(decodeURIComponent(candidate.imageUrl))
    )
    .sort((a, b) => b.score - a.score || a.pageTitle.localeCompare(b.pageTitle));

  return candidates[0]
    ? {
        imageUrl: candidates[0].imageUrl,
        pageTitle: candidates[0].pageTitle
      }
    : null;
}

function scoreCountryArticleImage(pageTitleValue, imageUrl, pageTitle, rank) {
  if (!pageTitleValue || !imageUrl) return 0;
  let score = Math.max(1, 16 - rank);
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(pageTitleValue)) score += 4;
  if (pageTitleValue.toLowerCase().includes(pageTitle.toLowerCase())) score += 2;
  if (/\.(?:jpe?g|webp)(?:$|[/?#])/i.test(imageUrl)) score += 2;
  if (/\.(?:svg|png)(?:$|[/?#])/i.test(imageUrl)) score -= 2;
  if (COUNTRY_MEDIA_EXCLUDE_PATTERN.test(pageTitleValue)) score = 0;
  return score;
}

function selectCountrySearchImage(pages, topic, pageTitle) {
  const topicTerms = normalizeMediaSearchTerms(topic);
  const candidates = pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = imageInfo?.thumburl ?? imageInfo?.url ?? null;
      const title = String(page?.title ?? "");
      const relevance = getCountryMediaRelevance(title, topicTerms, pageTitle);
      return {
        title,
        imageUrl,
        mime: String(imageInfo?.mime ?? ""),
        score: scoreCountrySearchCandidate(title, topicTerms, pageTitle, relevance),
        relevance
      };
    })
    .filter((candidate) =>
      candidate.imageUrl &&
      candidate.relevance.isRelevant &&
      candidate.mime.startsWith("image/") &&
      isAllowedCountryMediaUrl(candidate.imageUrl) &&
      !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(candidate.title) &&
      !/\.(?:svg|pdf|djvu)$/i.test(candidate.title)
    )
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return candidates[0]?.score > 0
    ? {
        imageUrl: candidates[0].imageUrl
      }
    : null;
}

function getCountryMediaRelevance(title, topicTerms, pageTitle) {
  const normalizedTitle = String(title ?? "").toLowerCase();
  const matchedTerms = topicTerms.filter((term) => normalizedTitle.includes(term));
  const distinctiveMatchedTerms = matchedTerms.filter(
    (term) => !COUNTRY_MEDIA_GENERIC_TOPIC_TERMS.has(term)
  );
  const includesCountryPageTitle = normalizedTitle.includes(pageTitle.toLowerCase());
  return {
    matchedTerms,
    distinctiveMatchedTerms,
    includesCountryPageTitle,
    isRelevant:
      distinctiveMatchedTerms.length > 0 ||
      matchedTerms.length >= 2 ||
      includesCountryPageTitle
  };
}

function normalizeMediaSearchTerms(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
      .filter((term) => term.length > 2 && !["the", "and", "city"].includes(term));
}

function scoreCountrySearchCandidate(title, topicTerms, pageTitle, relevance) {
  const normalizedTitle = String(title ?? "").toLowerCase();
  let score = 0;
  for (const term of topicTerms) {
    if (normalizedTitle.includes(term)) score += 3;
  }
  score += relevance.distinctiveMatchedTerms.length * 4;
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(normalizedTitle)) score += 3;
  if (normalizedTitle.includes(pageTitle.toLowerCase())) score += 2;
  if (/\.(?:jpe?g|webp)$/i.test(normalizedTitle)) score += 2;
  if (/^file:\d/.test(normalizedTitle)) score -= 2;
  return score;
}

function getCountryMediaCategoryTitles(pageTitle) {
  return [
    `Landscapes of ${pageTitle}`,
    `Tourism in ${pageTitle}`,
    `Cities in ${pageTitle}`,
    `Nature of ${pageTitle}`
  ];
}

function selectCountryCommonsImage(pages, pageTitle) {
  const candidates = pages
    .map((page) => {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = imageInfo?.thumburl ?? imageInfo?.url ?? null;
      return {
        title: String(page?.title ?? ""),
        imageUrl,
        mime: String(imageInfo?.mime ?? ""),
        score: scoreCountryMediaTitle(page?.title, pageTitle)
      };
    })
    .filter((candidate) =>
      candidate.imageUrl &&
      candidate.mime.startsWith("image/") &&
      isAllowedCountryMediaUrl(candidate.imageUrl) &&
      !COUNTRY_MEDIA_EXCLUDE_PATTERN.test(candidate.title)
    )
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return candidates[0]
    ? {
        imageUrl: candidates[0].imageUrl
      }
    : null;
}

function createCountryImageFetchOptions() {
  const fetchOptions = {
    headers: {
      "User-Agent": "RoamAtlas/0.1 local-dev country-card-media"
    }
  };
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    fetchOptions.signal = AbortSignal.timeout(4500);
  }
  return fetchOptions;
}

function createCountryImageDownloadOptions() {
  const fetchOptions = {
    headers: {
      "User-Agent": "RoamAtlas/0.1 local-dev country-card-media"
    }
  };
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    fetchOptions.signal = AbortSignal.timeout(30000);
  }
  return fetchOptions;
}

function getCountryMediaPageTitle(country) {
  return (
    COUNTRY_MEDIA_PAGE_OVERRIDES[country.code] ??
    country.name
      .replace(/\s*&\s*/g, " and ")
      .replace(/^St\.\s+/i, "Saint ")
      .replace(/\s+-\s+/g, " ")
  );
}

function scoreCountryMediaTitle(title, pageTitle) {
  const value = String(title ?? "");
  let score = 0;
  if (value.toLowerCase().includes(pageTitle.toLowerCase())) score += 3;
  if (COUNTRY_MEDIA_PLACE_PATTERN.test(value)) score += 4;
  if (/^File:\d/.test(value)) score -= 2;
  if (/-\s*(?:free|memories)\s*-/i.test(value)) score -= 2;
  return score;
}

function isAllowedCountryMediaUrl(value) {
  try {
    const mediaUrl = new URL(value);
    return (
      mediaUrl.protocol === "https:" &&
      /(^|\.)wikimedia\.org$/i.test(mediaUrl.hostname)
    );
  } catch {
    return false;
  }
}

async function handleCountryDraftRequest(url, response) {
  const countrySlug = String(url.searchParams.get("countrySlug") ?? "").trim().toLowerCase();
  const forceGenerate = url.searchParams.get("force") === "true";
  const shouldGenerate = forceGenerate || url.searchParams.get("generate") !== "false";
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const countryPack = getCountryPack(country.slug);
  if (isSourceControlledCountryPack(countryPack)) {
    const packSnapshot = createCountryPackStarterMap(countryPack);

    if (!forceGenerate) {
      const storedPackSnapshot = await readStoredCountryDraft(country);
      if (storedPackSnapshot?.mode === "curated_pack_snapshot") {
        const draft = withFreshPackThemes(storedPackSnapshot, country);
        countryDraftCache.set(country.slug, draft);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ draft, cached: true, persisted: true, source: "country_pack" }));
        return;
      }
    }

    countryDraftCache.set(country.slug, packSnapshot);
    await writeStoredCountryDraft(country, packSnapshot);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      draft: packSnapshot,
      cached: false,
      persisted: true,
      regenerated: forceGenerate,
      source: "country_pack"
    }));
    return;
  }

  if (!forceGenerate) {
    const cachedDraft = countryDraftCache.get(country.slug);
    if (cachedDraft) {
      const draft = withFreshPackThemes(cachedDraft, country);
      countryDraftCache.set(country.slug, draft);
      response.end(JSON.stringify({ draft, cached: true }));
      return;
    }

    const storedDraft = await readStoredCountryDraft(country);
    if (storedDraft) {
      const draft = withFreshPackThemes(storedDraft, country);
      countryDraftCache.set(country.slug, draft);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ draft, cached: true, persisted: true }));
      return;
    }
  }

  if (!shouldGenerate) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ draft: null, cached: false, persisted: false }));
    return;
  }

  const draft = await generateCountryDraft(country);
  if (draft.generationStatus === "ready") {
    countryDraftCache.set(country.slug, draft);
    await writeStoredCountryDraft(country, draft);
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ draft, cached: false, regenerated: forceGenerate }));
}

async function handleCountryDraftInfluenceRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const countryPack = getCountryPack(country.slug);
  if (isSourceReviewedCountryPack(countryPack)) {
    response.writeHead(409, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      error: `${country.name} is a source-reviewed country pack. Update the country pack source files instead of AI-steering a starter map.`
    }));
    return;
  }

  const instruction = normalizeCountryDraftInstruction(body.instruction);
  if (!instruction) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Starter map instruction is required." }));
    return;
  }

  const storedDraft = await readStoredCountryDraft(country);
  const currentDraft =
    normalizeCurrentCountryDraft(body.currentDraft, country) ??
    countryDraftCache.get(country.slug) ??
    storedDraft ??
    null;
  const draft = await generateCountryDraft(country, { instruction, currentDraft });
  if (draft.generationStatus === "ready") {
    countryDraftCache.set(country.slug, draft);
    await writeStoredCountryDraft(country, draft);
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    draft,
    message: {
      role: "assistant",
      text: draft.changeNote || "Starter map updated. All candidates remain unconfirmed."
    }
  }));
}

function isSourceReviewedCountryPack(countryPack) {
  return isSourceControlledCountryPack(countryPack) && countryPack.confidence !== "unconfirmed";
}

async function handleCountryDraftApproveRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const target = String(body.target ?? "").trim();
  const approved = body.approved !== false;
  const sourceUrl = String(body.sourceUrl ?? "").trim() || null;
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const storedDraft = await readStoredCountryDraft(country);
  const currentDraft =
    normalizeCurrentCountryDraft(body.currentDraft, country) ??
    countryDraftCache.get(country.slug) ??
    storedDraft ??
    null;
  if (!currentDraft) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Build a starter map before approving items." }));
    return;
  }

  const result = approved
    ? approveDraftItem(currentDraft, target, { sourceUrl })
    : unapproveDraftItem(currentDraft, target);
  if (!result.changed) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: result.error ?? "Approval update failed." }));
    return;
  }

  countryDraftCache.set(country.slug, result.draft);
  await writeStoredCountryDraft(country, result.draft);

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    draft: result.draft,
    target,
    approved,
    confidence: result.confidence,
    message: {
      role: "assistant",
      text: approved
        ? result.confidence === "confirmed"
          ? `${target.split(":")[1] ?? "Item"} marked as curated in the starter map. Update the country pack source file to make it permanent.`
          : `${target.split(":")[1] ?? "Item"} approved for map preview. Add a source URL to mark it as curated.`
        : `${target.split(":")[1] ?? "Item"} returned to needs-review status.`
    }
  }));
}

async function handleCountryDraftReorderRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const draft = normalizeCurrentCountryDraft(body.currentDraft, country);
  if (!draft) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Build a starter map before sorting records." }));
    return;
  }

  countryDraftCache.set(country.slug, draft);
  await writeStoredCountryDraft(country, draft);

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    draft,
    message: {
      role: "assistant",
      text: "Starter map order saved. Records still need source review before promotion."
    }
  }));
}

async function handleCountryDraftConfirmRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  if (isSourceControlledCountryPack(country.slug)) {
    response.writeHead(409, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      error: `${country.name} is already registered as a country pack. Confirm-for-curation only creates draft artifacts for countries that are not registered yet. For ${country.name}, move reviewed changes into the source-controlled country pack instead.`
    }));
    return;
  }

  const storedDraft = await readStoredCountryDraft(country);
  const currentDraft =
    normalizeCurrentCountryDraft(body.currentDraft, country) ??
    countryDraftCache.get(country.slug) ??
    storedDraft ??
    null;
  if (!currentDraft) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Build a starter map before confirming it for curation." }));
    return;
  }

  const confirmation = createStarterMapConfirmation(country, currentDraft);
  const countryPackDraft = createCountryPackDraftFromStarterMap(currentDraft);
  const paths = await writeStoredCountryPromotion({
    country,
    confirmation,
    countryPackDraft
  });

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    confirmation,
    countryPackDraft,
    paths: {
      confirmationUrl: paths.starterMapConfirmationUrl,
      countryPackDraftUrl: paths.countryPackDraftUrl
    }
  }));
}

async function handleRuntimeCacheFlushRequest(request, response) {
  const body = await readJson(request);
  const countrySlug = String(body.countrySlug ?? "").trim().toLowerCase();
  const scope = body.scope === "visuals" ? "visuals" : "all";
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const result = scope === "visuals"
    ? await flushCountryGeneratedVisualCache(country.slug)
    : await flushCountryGeneratedRuntimeCache(country.slug);
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    countrySlug: country.slug,
    countryName: country.name,
    scope,
    ...result
  }));
}

async function flushCountryGeneratedVisualCache(countrySlug) {
  const existingRun = countryCacheFlushRuns.get(countrySlug);
  if (existingRun) return existingRun;
  const countryCacheRoot = path.normalize(path.join(runtimeCacheRoot, countrySlug));
  if (!isPathInside(runtimeCacheRoot, countryCacheRoot)) {
    throw new Error(`Unsafe runtime cache path for ${countrySlug}.`);
  }

  const visualFolders = ["image-jobs", "flipbook", "environment"];
  const run = (async () => {
    await Promise.allSettled([...(activeCountryImageJobCreations.get(countrySlug) ?? [])]);
    flushingCountryCacheRoots.add(countryCacheRoot);
    try {
      const imageRuns = cancelProcessingJobsForCountry(countryCacheRoot);
      const environmentRuns = cancelEnvironmentPlansForCountry(countryCacheRoot);
      await Promise.allSettled([...imageRuns, ...environmentRuns]);
      await Promise.all(visualFolders.map(async (folder) => {
        const folderPath = path.normalize(path.join(countryCacheRoot, folder));
        if (!isPathInside(countryCacheRoot, folderPath)) {
          throw new Error(`Unsafe visual cache path for ${countrySlug}.`);
        }
        await rm(folderPath, { recursive: true, force: true });
      }));
      clearCountryVisualRuntimeMemory(countrySlug, countryCacheRoot);

      return {
        flushed: true,
        scope: "visuals",
        removedFolders: visualFolders,
        preservedFolders: ["starter-map", "country-pack-draft", "understanding", "place-images"],
        factBoundary: "Generated visual cache was cleared. Starter-map, reference photos, and source-controlled country pack data were not changed."
      };
    } finally {
      flushingCountryCacheRoots.delete(countryCacheRoot);
    }
  })();
  countryCacheFlushRuns.set(countrySlug, run);
  try {
    return await run;
  } finally {
    if (countryCacheFlushRuns.get(countrySlug) === run) {
      countryCacheFlushRuns.delete(countrySlug);
    }
  }
}

async function flushCountryGeneratedRuntimeCache(countrySlug) {
  const existingRun = countryCacheFlushRuns.get(countrySlug);
  if (existingRun) return existingRun;
  const countryCacheRoot = path.normalize(path.join(runtimeCacheRoot, countrySlug));
  if (!isPathInside(runtimeCacheRoot, countryCacheRoot)) {
    throw new Error(`Unsafe runtime cache path for ${countrySlug}.`);
  }

  const run = (async () => {
    await Promise.allSettled([...(activeCountryImageJobCreations.get(countrySlug) ?? [])]);
    flushingCountryCacheRoots.add(countryCacheRoot);
    try {
      const imageRuns = cancelProcessingJobsForCountry(countryCacheRoot);
      const environmentRuns = cancelEnvironmentPlansForCountry(countryCacheRoot);
      await Promise.allSettled([...imageRuns, ...environmentRuns]);
      await rm(countryCacheRoot, { recursive: true, force: true });
      clearCountryVisualRuntimeMemory(countrySlug, countryCacheRoot);

      return {
        flushed: true,
        removedRuntimeRoot: countryCacheRoot,
        removedFolders: ["image-jobs", "flipbook", "understanding", "environment", "starter-map", "country-pack-draft", "place-images"],
        factBoundary: "Country runtime cache was cleared. Source-controlled country pack data was not changed."
      };
    } finally {
      flushingCountryCacheRoots.delete(countryCacheRoot);
    }
  })();
  countryCacheFlushRuns.set(countrySlug, run);
  try {
    return await run;
  } finally {
    if (countryCacheFlushRuns.get(countrySlug) === run) {
      countryCacheFlushRuns.delete(countrySlug);
    }
  }
}

function clearCountryVisualRuntimeMemory(countrySlug, countryCacheRoot) {
  const cachePrefix = `${countrySlug}:`;
  for (const jobPath of [...terminalImageJobs]) {
    if (isPathInside(countryCacheRoot, path.normalize(jobPath))) {
      terminalImageJobs.delete(jobPath);
    }
  }
}

function clearPlaceImageRuntimeMemory(countrySlug, place = null) {
  const cachePrefix = `${countrySlug}:`;
  if (!place?.placeSlug) {
    for (const cacheKey of placeImageCache.keys()) {
      if (cacheKey.startsWith(cachePrefix)) placeImageCache.delete(cacheKey);
    }
    for (const cacheKey of placeImageRequestsInFlight.keys()) {
      if (cacheKey.startsWith(cachePrefix)) placeImageRequestsInFlight.delete(cacheKey);
    }
    placeImageClaimsByCountry.delete(countrySlug);
    return;
  }

  const cacheKey = `${countrySlug}:${place.placeSlug}:${PLACE_IMAGE_SELECTION_VERSION}`;
  placeImageCache.delete(cacheKey);
  placeImageRequestsInFlight.delete(cacheKey);
  if (place.claimKey) releasePlaceImageClaim(countrySlug, place.place ?? "", place.claimKey);
  const normalizedPlace = normalizePlaceImageClaimPlace(place.place);
  const claims = placeImageClaimsByCountry.get(countrySlug);
  if (claims && normalizedPlace) {
    for (const [claimKey, claimedPlace] of claims.entries()) {
      if (claimedPlace === normalizedPlace) claims.delete(claimKey);
    }
  }
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function cancelProcessingJobsForCountry(countryCacheRoot) {
  const activeRuns = [];
  for (const jobPath of processingJobs.keys()) {
    if (isPathInside(countryCacheRoot, path.normalize(jobPath))) {
      cancelledImageJobs.add(jobPath);
      processingJobAbortControllers.get(jobPath)?.abort(
        new Error("Image generation cancelled because its country runtime cache was flushed.")
      );
      const run = processingJobRuns.get(jobPath);
      if (run) activeRuns.push(run);
    }
  }
  for (const jobPath of terminalImageJobs) {
    if (isPathInside(countryCacheRoot, path.normalize(jobPath))) {
      terminalImageJobs.delete(jobPath);
    }
  }
  return activeRuns;
}

function cancelEnvironmentPlansForCountry(countryCacheRoot) {
  const activeRuns = [];
  for (const [environmentPath] of pendingEnvironmentPlans) {
    if (isPathInside(countryCacheRoot, path.normalize(environmentPath))) {
      pendingEnvironmentPlans.delete(environmentPath);
    }
  }
  if (
    activeEnvironmentTask &&
    isPathInside(countryCacheRoot, path.normalize(activeEnvironmentTask.environmentPath))
  ) {
    activeEnvironmentTask.controller.abort(
      new Error("Environment analysis cancelled because its country runtime cache was flushed.")
    );
    activeRuns.push(activeEnvironmentTask.done);
  }
  return activeRuns;
}

function isJobPathBeingFlushed(jobPath) {
  return [...flushingCountryCacheRoots].some((cacheRoot) =>
    isPathInside(cacheRoot, path.normalize(jobPath))
  );
}

async function readStoredCountryDraft(country) {
  const paths = createCountryStarterMapCachePaths({
    cacheRoot: runtimeCacheRoot,
    countrySlug: country.slug
  });

  try {
    const stored = JSON.parse(await readFile(paths.starterMapPath, "utf8"));
    const draft = stored.draft ?? stored;
    if (draft?.mode === "curated_pack_snapshot" && draft.countrySlug === country.slug) {
      return withFreshPackThemes(draft, country);
    }

    return normalizeCountryDraftPayload(draft, country, {
      generatedAt: stored.draft?.generatedAt ?? stored.generatedAt,
      model: stored.draft?.model ?? stored.model,
      generationStatus: stored.draft?.generationStatus ?? stored.generationStatus ?? "ready"
    });
  } catch {
    return null;
  }
}

async function writeStoredCountryDraft(country, draft) {
  const paths = createCountryStarterMapCachePaths({
    cacheRoot: runtimeCacheRoot,
    countrySlug: country.slug
  });
  const draftToStore = withFreshPackThemes(draft, country);
  await mkdir(path.dirname(paths.starterMapPath), { recursive: true });
  await writeFile(
    paths.starterMapPath,
    `${JSON.stringify(
      {
        countrySlug: country.slug,
        countryCode: country.code,
        countryName: country.name,
        draft: draftToStore,
        storageKind: "runtime-starter-map",
        factBoundary: draftToStore.mode === "curated_pack_snapshot"
          ? "Stored starter map is a runtime snapshot of the curated country pack."
          : "Stored starter maps are ai_generated and unconfirmed until promoted with sources.",
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
  return paths;
}

async function writeStoredCountryPromotion({ country, confirmation, countryPackDraft }) {
  const paths = createCountryStarterMapCachePaths({
    cacheRoot: runtimeCacheRoot,
    countrySlug: country.slug
  });
  await mkdir(path.dirname(paths.starterMapConfirmationPath), { recursive: true });
  await mkdir(path.dirname(paths.countryPackDraftPath), { recursive: true });
  await writeFile(paths.starterMapConfirmationPath, `${JSON.stringify(confirmation, null, 2)}\n`);
  await writeFile(paths.countryPackDraftPath, `${JSON.stringify(countryPackDraft, null, 2)}\n`);
  return paths;
}

function createStarterMapConfirmation(country, draft) {
  const confirmedAt = new Date().toISOString();
  return {
    countryCode: country.code,
    countrySlug: country.slug,
    countryName: country.name,
    status: "confirmed_for_curation",
    sourceStarterMap: {
      mode: draft.mode,
      sourceType: draft.sourceType,
      confidence: draft.confidence,
      generatedAt: draft.generatedAt
    },
    candidateCounts: {
      regions: draft.regions?.length ?? 0,
      themes: draft.themes?.length ?? 0
    },
    nextStep: "Generate a source-reviewed country pack from the draft artifact.",
    factBoundary: "Confirmation approves curation direction only; it does not verify travel facts.",
    confirmedAt
  };
}

const EXA_GROUNDING_DOMAINS = [
  "visitsingapore.com",
  "stb.gov.sg",
  "mandai.com",
  "malaysia.travel",
  "tourism.gov.my",
  "wikipedia.org",
  "gov.sg",
  "gov.my"
];

const EXA_MIN_SNIPPET_TEXT_LENGTH = 200;

async function searchExaGroundingSnippets(country) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const query = `Official tourism attractions, districts, and regions in ${country.name}`;
  let exaResponse;
  try {
    exaResponse = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        numResults: 8,
        includeDomains: EXA_GROUNDING_DOMAINS,
        contents: { text: { maxCharacters: 2000 } }
      })
    });
  } catch (error) {
    console.warn(`Exa grounding search failed for ${country.name}: ${String(error?.message ?? error)}`);
    return [];
  }

  if (!exaResponse.ok) {
    console.warn(`Exa grounding search failed for ${country.name}: ${exaResponse.status} ${await exaResponse.text()}`);
    return [];
  }

  let payload;
  try {
    payload = await exaResponse.json();
  } catch {
    return [];
  }

  return (Array.isArray(payload?.results) ? payload.results : [])
    .map((result) => ({
      title: String(result?.title ?? "").trim(),
      url: String(result?.url ?? "").trim(),
      text: String(result?.text ?? "").trim()
    }))
    .filter((snippet) => snippet.url && snippet.text.length >= EXA_MIN_SNIPPET_TEXT_LENGTH);
}

async function generateCountryDraft(country, { instruction = null, currentDraft = null } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return createCountryDraftFallbackFromCurrent(
      country,
      "OPENAI_API_KEY is not configured.",
      currentDraft,
      { generationStatus: "provider_missing" }
    );
  }

  const model = appConfig.ai.textModel;
  const groundingSnippets = await searchExaGroundingSnippets(country);
  const prompt = instruction
    ? buildCountryDraftInfluencePrompt({ country, instruction, currentDraft, groundingSnippets })
    : buildCountryDraftPrompt(country, { groundingSnippets });
  let openaiResponse;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ],
        temperature: 0.2
      })
    });
  } catch (error) {
    return createCountryDraftFallbackFromCurrent(
      country,
      `OpenAI starter map update failed: ${String(error?.message ?? error)}`,
      currentDraft,
      { generationStatus: "provider_error", model }
    );
  }

  if (!openaiResponse.ok) {
    return createCountryDraftFallbackFromCurrent(
      country,
      `OpenAI starter map update failed: ${openaiResponse.status} ${await openaiResponse.text()}`,
      currentDraft,
      { generationStatus: "provider_error", model }
    );
  }

  const payload = await openaiResponse.json();
  const text = extractOpenAIText(payload);
  const parsed = parseJsonObject(text);
  if (!parsed) {
    return createCountryDraftFallbackFromCurrent(
      country,
      "OpenAI returned a non-JSON starter map.",
      currentDraft,
      { generationStatus: "parse_error", model }
    );
  }

  return normalizeCountryDraftPayload(parsed, country, {
    generationStatus: "ready",
    model,
    groundingSnippets
  });
}

function createCountryDraftFallbackFromCurrent(country, reason, currentDraft, options = {}) {
  if (currentDraft) {
    return normalizeCountryDraftPayload(currentDraft, country, {
      ...options,
      unavailableReason: reason
    });
  }

  return createCountryDraftFallback(country, reason, options);
}

function normalizeCurrentCountryDraft(currentDraft, country) {
  if (!currentDraft || currentDraft.countrySlug !== country.slug) return null;
  const normalized = normalizeCountryDraftPayload(currentDraft, country, {
    generatedAt: currentDraft.generatedAt,
    model: currentDraft.model,
    generationStatus: currentDraft.generationStatus ?? "ready"
  });
  return withFreshPackThemes(normalized, country);
}

function withFreshPackThemes(draft, country) {
  if (!draft || !isSourceControlledCountryPack(country.slug)) return draft;
  return refreshCuratedPackSnapshotThemes(draft, getCountryPack(country.slug));
}

function extractOpenAIText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  const content = payload?.output?.flatMap((item) => item.content ?? []) ?? [];
  const textItem = content.find((item) => typeof item.text === "string");
  return textItem?.text ?? "";
}

function parseJsonObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function createCodexImageJob(page, options = {}) {
  const countrySlug = getRuntimeCountrySlugForPage(page);
  const release = await beginCountryImageJobCreation(countrySlug);
  try {
    const result = await createCodexImageJobUnlocked(page, options);
    if (countryCacheFlushRuns.has(countrySlug)) {
      const error = new Error(`Runtime cache flush in progress for ${countrySlug}; retry artwork after it completes.`);
      error.statusCode = 409;
      throw error;
    }
    return result;
  } finally {
    release();
  }
}

async function beginCountryImageJobCreation(countrySlug) {
  while (countryCacheFlushRuns.has(countrySlug)) {
    await countryCacheFlushRuns.get(countrySlug);
  }
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const active = activeCountryImageJobCreations.get(countrySlug) ?? new Set();
  active.add(done);
  activeCountryImageJobCreations.set(countrySlug, active);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active.delete(done);
    if (active.size === 0) activeCountryImageJobCreations.delete(countrySlug);
    resolveDone();
  };
}

async function createCodexImageJobUnlocked(page, { jobKind = "interactive" } = {}) {
  const imageModel = getConfiguredImageModel();
  const countrySlug = getRuntimeCountrySlugForPage(page);
  const prompt = page.plan?.imagePrompt;
  const assetVersion = createAssetVersionForPage(page, { imageModel, prompt });
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: page.id,
    imageModel,
    countrySlug,
    outputFormat: appConfig.image.outputFormat,
    variantKey: assetVersion
  });
  const outputDir = path.dirname(paths.jobPath);
  const jobPath = paths.jobPath;
  const jobUrl = paths.jobUrl;

  await mkdir(outputDir, { recursive: true });
  const existingJob = await readCodexImageJob(jobPath);
  const cachedImageAvailable = await isFileAvailable(paths.imagePath);
  const existingMatchesRequest =
    existingJob?.prompt === prompt &&
    existingJob?.assetVersion === assetVersion &&
    normalizeImageModel(existingJob?.requestedImageModel ?? existingJob?.imageModel ?? imageModel) ===
      normalizeImageModel(imageModel);

  if (
    existingMatchesRequest &&
    existingJob?.status === "ready" &&
    existingJob.imageUrl &&
    cachedImageAvailable
  ) {
    const readyPage = {
      ...page,
      countrySlug,
      assetVersion,
      imageUrl: existingJob.imageUrl,
      status: "ready"
    };
    const environmentPlan = await findMatchingEnvironmentPlan(readyPage, paths);
    if (!environmentPlan && shouldQueueEnvironmentPlanForJobKind(jobKind)) {
      queueEnvironmentPlan({ page: readyPage, paths, jobPath });
    }
    await ensurePageUnderstanding(readyPage);
    return {
      ...page,
      countrySlug,
      assetVersion,
      imageUrl: existingJob.imageUrl,
      status: "ready",
      environmentUrl: paths.environmentUrl,
      generated: {
        source: existingJob.source ?? "image-cache",
        jobUrl,
        assetVersion,
        environmentUrl: paths.environmentUrl,
        environmentStatus:
          environmentPlan?.status ??
          (shouldQueueEnvironmentPlanForJobKind(jobKind) ? "pending" : "deferred"),
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  const existingMetadata = await readRuntimeImageMetadata(paths.metadataPath);
  const existingMetadataMatchesRequest =
    existingMetadata?.prompt === prompt &&
    existingMetadata?.assetVersion === assetVersion &&
    normalizeImageModel(
      existingMetadata?.requestedImageModel ?? existingMetadata?.imageModel ?? imageModel
    ) === normalizeImageModel(imageModel) &&
    existingMetadata.imageUrl &&
    cachedImageAvailable;
  if (existingMetadataMatchesRequest) {
    const readyPage = {
      ...page,
      countrySlug,
      assetVersion,
      imageUrl: existingMetadata.imageUrl,
      status: "ready"
    };
    const environmentPlan = await findMatchingEnvironmentPlan(readyPage, paths);
    const readyJob = {
      pageId: page.id,
      countrySlug,
      assetVersion,
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      parentId: page.parentId,
      parentClick: page.parentClick,
      status: "ready",
      jobKind,
      imageUrl: existingMetadata.imageUrl,
      source: `${existingMetadata.imageProvider ?? getConfiguredImageProvider()}-image-api`,
      imageProvider: existingMetadata.imageProvider ?? getConfiguredImageProvider(),
      imageModel: existingMetadata.imageModel ?? imageModel,
      requestedImageModel: existingMetadata.requestedImageModel ?? imageModel,
      metadataUrl: paths.metadataUrl,
      environmentUrl: paths.environmentUrl,
      environmentStatus:
        environmentPlan?.status ??
        (shouldQueueEnvironmentPlanForJobKind(jobKind) ? "pending" : "deferred"),
      prompt,
      title: page.plan?.title,
      pageType: page.plan?.pageType,
      cacheKind: "runtime",
      factBoundary: "Generated image is visual only and is not a fact source.",
      reusedFromMetadata: true,
      completedAt: existingMetadata.generatedAt ?? new Date().toISOString()
    };
    await writeCodexImageJob(jobPath, readyJob);
    if (!environmentPlan && shouldQueueEnvironmentPlanForJobKind(jobKind)) {
      queueEnvironmentPlan({ page: readyPage, paths, jobPath });
    }
    await ensurePageUnderstanding(readyPage);
    return {
      ...page,
      countrySlug,
      assetVersion,
      imageUrl: existingMetadata.imageUrl,
      status: "ready",
      environmentUrl: paths.environmentUrl,
      generated: {
        source: readyJob.source,
        jobUrl,
        assetVersion,
        environmentUrl: paths.environmentUrl,
        environmentStatus:
          environmentPlan?.status ??
          (shouldQueueEnvironmentPlanForJobKind(jobKind) ? "pending" : "deferred"),
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  if (
    existingMatchesRequest &&
    (existingJob?.status === "pending_codex_image_generation" ||
      existingJob?.status === "processing_openai_image" ||
      existingJob?.status === "partial_ready")
  ) {
    const promotedJobKind = chooseHigherPriorityJobKind(existingJob.jobKind, jobKind);
    if (canAutoProcessImages() && existingJob.autoProcess !== true) {
      await writeCodexImageJob(jobPath, {
        ...existingJob,
        jobKind: promotedJobKind,
        autoProcess: true,
        updatedAt: new Date().toISOString()
      });
    } else if (promotedJobKind !== existingJob.jobKind) {
      await writeCodexImageJob(jobPath, {
        ...existingJob,
        jobKind: promotedJobKind,
        updatedAt: new Date().toISOString()
      });
    }
    if (processingJobs.has(jobPath)) {
      processingJobs.set(jobPath, promotedJobKind);
    }
    if (promotedJobKind === "interactive") {
      requestImageJobProcessing();
    }
    return {
      ...page,
      countrySlug,
      assetVersion,
      status: existingJob.status,
      partialImageUrl: existingJob.partialImageUrl,
      generated: {
        source: "image-generation-required",
        jobUrl,
        assetVersion,
        partialImageUrl: existingJob.partialImageUrl,
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  await writeCodexImageJob(jobPath, {
    pageId: page.id,
    countrySlug,
    assetVersion,
    sceneId: page.sceneId,
    nodeId: page.nodeId,
    parentId: page.parentId,
    parentClick: page.parentClick,
    status: "pending_codex_image_generation",
    jobKind,
    autoProcess: canAutoProcessImages(),
    imageModel,
    prompt,
    title: page.plan?.title,
    pageType: page.plan?.pageType,
    cacheKind: "runtime",
    factBoundary: "Generated image is visual only and is not a fact source.",
    createdAt: new Date().toISOString()
  });

  if (jobKind === "interactive") {
    requestImageJobProcessing();
  }

  return {
    ...page,
    countrySlug,
    assetVersion,
    status: "pending_codex_image_generation",
    generated: {
      source: "image-generation-required",
      jobUrl,
      assetVersion,
      factBoundary: "Generated fallback art is visual only and is not a fact source."
    }
  };
}

function chooseHigherPriorityJobKind(existingJobKind, requestedJobKind) {
  if (!existingJobKind) return requestedJobKind;
  return imageJobPriority({ jobKind: requestedJobKind }) < imageJobPriority({ jobKind: existingJobKind })
    ? requestedJobKind
    : existingJobKind;
}

function shouldQueueEnvironmentPlanForJobKind(jobKind) {
  // A prefetched image becomes useful before its optional ambience does. Wait
  // until the page is actually requested so stale speculation cannot delay the
  // environment plan for the user's current page.
  return jobKind !== "prefetch";
}

function createAssetVersionForPage(page, { imageModel, prompt }) {
  const pack = getCountryPackForPage(page);
  const scene = pack?.scenes?.[page?.sceneId];
  return createImageVariantKey({
    prompt,
    imageModel,
    fallbackImageModel: appConfig.image.fallbackModel,
    size: appConfig.image.size,
    quality: appConfig.image.quality,
    outputFormat: appConfig.image.outputFormat,
    outputCompression: appConfig.image.outputCompression,
    promptVersion:
      page?.plan?.promptVersion ?? page?.promptVersion ?? scene?.promptVersion ?? pack?.versions?.prompt,
    styleVersion:
      page?.plan?.styleVersion ?? page?.styleVersion ?? scene?.styleVersion ?? pack?.versions?.style,
    dataVersion:
      page?.plan?.dataVersion ?? page?.dataVersion ?? scene?.dataVersion ?? pack?.versions?.data
  });
}

async function writeCodexImageJob(jobPath, job) {
  throwIfImageJobCancelled(jobPath);
  await mkdir(path.dirname(jobPath), { recursive: true });
  const tempPath = `${jobPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      tempPath,
      `${JSON.stringify({ ...job, updatedAt: new Date().toISOString() }, null, 2)}\n`
    );
    throwIfImageJobCancelled(jobPath);
    await rename(tempPath, jobPath);
  } finally {
    await rm(tempPath, { force: true });
  }
  if (["ready", "failed"].includes(job?.status)) {
    terminalImageJobs.add(jobPath);
  } else {
    terminalImageJobs.delete(jobPath);
  }
}

async function readCodexImageJob(jobPath) {
  try {
    return JSON.parse(await readFile(jobPath, "utf8"));
  } catch {
    return null;
  }
}

async function readRuntimeImageMetadata(metadataPath) {
  try {
    return JSON.parse(await readFile(metadataPath, "utf8"));
  } catch {
    return null;
  }
}

async function isFileAvailable(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function ensureEnvironmentPlanForPage(page, paths, { signal = null } = {}) {
  if (!page?.imageUrl) return null;
  throwIfAborted(signal);

  const existing = await findMatchingEnvironmentPlan(page, paths);
  if (existing) return existing;

  let plan;
  try {
    plan = await createEnvironmentPlanWithOpenAI(page, { signal });
  } catch (error) {
    throwIfAborted(signal);
    plan = createEnvironmentFallbackPlan(page, String(error?.message ?? error));
  }

  throwIfAborted(signal);
  await mkdir(path.dirname(paths.environmentPath), { recursive: true });
  throwIfAborted(signal);
  await writeFile(paths.environmentPath, `${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}

async function findMatchingEnvironmentPlan(page, paths) {
  const existing = await readRuntimeEnvironmentPlan(paths.environmentPath);
  return existing?.version === ENVIRONMENT_PLAN_SCHEMA_VERSION &&
    existing.promptVersion === ENVIRONMENT_PLAN_PROMPT_VERSION &&
    existing.imageUrl === page.imageUrl
    ? existing
    : null;
}

function queueEnvironmentPlan({ page, paths, jobPath }) {
  if (
    !page?.imageUrl ||
    pendingEnvironmentPlans.has(paths.environmentPath) ||
    isJobPathBeingFlushed(paths.environmentPath)
  ) return;
  pendingEnvironmentPlans.set(paths.environmentPath, { page, paths, jobPath });
  scheduleEnvironmentPlanProcessing();
}

function scheduleEnvironmentPlanProcessing(delayMs = 250) {
  if (environmentPlanProcessorActive) return;
  setTimeout(() => {
    processNextEnvironmentPlan().catch((error) => {
      console.error("Environment plan processing failed:", error);
    });
  }, delayMs);
}

async function processNextEnvironmentPlan() {
  if (environmentPlanProcessorActive || pendingEnvironmentPlans.size === 0) return;
  if (Array.from(processingJobs.values()).includes("interactive")) {
    scheduleEnvironmentPlanProcessing(1000);
    return;
  }

  const [environmentPath, task] = pendingEnvironmentPlans.entries().next().value;
  pendingEnvironmentPlans.delete(environmentPath);
  environmentPlanProcessorActive = true;
  const controller = new AbortController();
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  activeEnvironmentTask = { environmentPath, controller, done };
  const startedAt = new Date().toISOString();

  try {
    await updateReadyJobForImage(task.jobPath, task.page.imageUrl, {
      environmentUrl: task.paths.environmentUrl,
      environmentStatus: "processing",
      environmentProcessingStartedAt: startedAt
    });
    const environmentPlan = await ensureEnvironmentPlanForPage(task.page, task.paths, {
      signal: controller.signal
    });
    await updateReadyJobForImage(task.jobPath, task.page.imageUrl, {
      environmentUrl: task.paths.environmentUrl,
      environmentStatus: environmentPlan?.status ?? "fallback",
      environmentCompletedAt: new Date().toISOString()
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    await updateReadyJobForImage(task.jobPath, task.page.imageUrl, {
      environmentUrl: task.paths.environmentUrl,
      environmentStatus: "failed",
      environmentError: String(error?.message ?? error),
      environmentFailedAt: new Date().toISOString()
    });
  } finally {
    if (activeEnvironmentTask?.done === done) activeEnvironmentTask = null;
    resolveDone();
    environmentPlanProcessorActive = false;
    if (pendingEnvironmentPlans.size > 0) scheduleEnvironmentPlanProcessing();
  }
}

async function updateReadyJobForImage(jobPath, imageUrl, patch) {
  const currentJob = await readCodexImageJob(jobPath);
  if (currentJob?.status !== "ready" || currentJob.imageUrl !== imageUrl) return false;
  await writeCodexImageJob(jobPath, { ...currentJob, ...patch });
  return true;
}

async function readRuntimeEnvironmentPlan(environmentPath) {
  try {
    return JSON.parse(await readFile(environmentPath, "utf8"));
  } catch {
    return null;
  }
}

async function createEnvironmentPlanWithOpenAI(page, { signal = null } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return createEnvironmentFallbackPlan(page, "OPENAI_API_KEY is not configured.");
  }

  const imagePath = getImagePathFromUrl(page.imageUrl);
  if (!imagePath) {
    return createEnvironmentFallbackPlan(page, "Current page image path is outside the RoamAtlas workspace and runtime cache.");
  }

  const imageBytes = await readFile(imagePath);
  const mimeType = mimeTypeForImagePath(imagePath);
  const prompt = buildEnvironmentPlanPrompt(getEnvironmentPromptContext(page));
  const model = appConfig.ai.environmentModel;
  let lastError = null;

  if (model) {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: createServerRequestSignal(signal, 90_000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${imageBytes.toString("base64")}`,
                detail: "high"
              }
            ]
          }
        ]
      })
    });

    if (!openaiResponse.ok) {
      lastError = `${model}: ${await openaiResponse.text()}`;
      return createEnvironmentFallbackPlan(page, lastError);
    }

    const payload = await openaiResponse.json();
    const parsed = parseJsonObject(extractOpenAIText(payload));
    const plan = normalizeEnvironmentPlan(parsed, page, {
      source: "openai-vlm",
      model
    });
    if (plan.layers.length > 0) {
      return plan;
    }
    lastError = `${model}: environment planner returned no usable safe layers.`;
  }

  return createEnvironmentFallbackPlan(page, lastError ?? "No environment planner model is configured.");
}

function createServerRequestSignal(externalSignal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([externalSignal, timeoutSignal]);
  }
  const controller = new AbortController();
  const forwardAbort = (source) => {
    if (!controller.signal.aborted) controller.abort(source.reason);
  };
  for (const source of [externalSignal, timeoutSignal]) {
    if (source.aborted) {
      forwardAbort(source);
      break;
    }
    source.addEventListener("abort", () => forwardAbort(source), { once: true });
  }
  return controller.signal;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("Operation aborted.");
  }
}

function getEnvironmentPromptContext(page) {
  const pack = getCountryPackForPage(page);
  const title = page.plan?.title ?? page.title ?? page.nodeId ?? page.sceneId ?? "current atlas page";
  const pageType = page.plan?.pageType ?? page.pageType ?? "atlas_page";
  return {
    countryName: pack.title,
    title,
    pageType
  };
}

function normalizeEnvironmentPlan(rawPlan, page, { source, model }) {
  const layers = Array.isArray(rawPlan?.layers)
    ? rawPlan.layers
        .map((layer, index) => normalizeEnvironmentLayer(layer, index))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return createEnvironmentPlanEnvelope(page, {
    source,
    model,
    status: layers.length ? "ready" : "fallback",
    layers,
    warnings: normalizeEnvironmentWarnings(rawPlan?.warnings)
  });
}

function normalizeEnvironmentLayer(layer, index) {
  const kind = normalizeEnvironmentLayerKind(layer?.kind);
  const safePlacement = normalizeSafeEnvironmentPlacement(layer?.safePlacement);
  const bounds = normalizeEnvironmentBounds(layer?.bounds);
  if (!kind || !safePlacement || !bounds) return null;
  if (["water", "marine_life"].includes(kind) && safePlacement !== "open_water") return null;
  if (kind === "foliage" && safePlacement !== "foliage") return null;
  if (kind === "cloud" && !["sky", "open_air"].includes(safePlacement)) return null;
  if (kind === "birds" && !["sky", "open_air", "open_water"].includes(safePlacement)) return null;

  return {
    id: slugify(layer?.id || `${kind}-${index + 1}`),
    kind,
    bounds,
    coordinateSpace: "normalized",
    intensity: layer?.intensity === "medium" ? "medium" : "subtle",
    safePlacement,
    avoid: normalizeAvoidList(layer?.avoid),
    reason: String(layer?.reason ?? "").slice(0, 180)
  };
}

function normalizeEnvironmentLayerKind(kind) {
  const value = String(kind ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  return ["cloud", "water", "foliage", "light", "marine_life", "birds"].includes(value)
    ? value
    : null;
}

function normalizeSafeEnvironmentPlacement(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  return ["sky", "open_air", "open_water", "foliage", "open_light"].includes(normalized)
    ? normalized
    : null;
}

function normalizeEnvironmentBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const x = clamp01(Number(bounds.x));
  const y = clamp01(Number(bounds.y));
  const width = Math.min(clamp(Number(bounds.width), 0.04, 1), 1 - x);
  const height = Math.min(clamp(Number(bounds.height), 0.04, 1), 1 - y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || width < 0.04 || height < 0.04) return null;
  return { x, y, width, height };
}

function normalizeAvoidList(value) {
  const fallback = ["land", "islands", "buildings", "labels", "callouts", "leader lines"];
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeEnvironmentWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").slice(0, 180)).filter(Boolean).slice(0, 4);
}

function createEnvironmentFallbackPlan(page, warning) {
  return createEnvironmentPlanEnvelope(page, {
    source: "fallback",
    model: null,
    status: "fallback",
    layers: [
      {
        id: "safe-light-wash",
        kind: "light",
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        coordinateSpace: "normalized",
        intensity: "subtle",
        safePlacement: "open_light",
        avoid: ["labels", "callouts", "leader lines"],
        reason: "Conservative fallback avoids placing water or wildlife without image understanding."
      }
    ],
    warnings: warning ? [warning] : []
  });
}

function createEnvironmentPlanEnvelope(page, { source, model, status, layers, warnings }) {
  const timestamp = new Date().toISOString();
  return {
    version: ENVIRONMENT_PLAN_SCHEMA_VERSION,
    source,
    model,
    status,
    pageId: page.id,
    countrySlug: getRuntimeCountrySlugForPage(page),
    sceneId: page.sceneId,
    nodeId: page.nodeId,
    imageUrl: page.imageUrl,
    promptVersion: ENVIRONMENT_PLAN_PROMPT_VERSION,
    generatedAt: timestamp,
    factBoundary: "Environment overlays are decorative code-rendered ambience only and are not fact sources.",
    layers,
    warnings
  };
}

function startImageJobProcessor() {
  if (!hasConfiguredImageProvider()) {
    console.log("RoamAtlas image job processor idle: no image provider key is configured.");
    return;
  }
  if (appExperienceConfig.providerConcurrency === 0) {
    console.log("RoamAtlas image job processor disabled: provider concurrency is 0.");
    return;
  }

  console.log(`RoamAtlas image job processor enabled with ${getConfiguredImageProvider()}.`);
  const initialQueue = shouldQueueDefaultArtwork()
    ? queueDefaultArtworkJobs()
    : Promise.resolve();
  if (!shouldQueueDefaultArtwork()) {
    console.log("RoamAtlas default artwork pre-generation skipped. Set ROAMATLAS_LOAD_COUNTRY_PACK_EARLY=true to enable it.");
  }
  initialQueue.then(requestImageJobProcessing).catch((error) => {
    console.error("Initial image job processing failed:", error);
  });
  setInterval(() => {
    requestImageJobProcessing();
  }, 3000);
}

function requestImageJobProcessing() {
  if (!canAutoProcessImages()) return null;
  if (imageJobScanPromise) {
    imageJobRescanRequested = true;
    return imageJobScanPromise;
  }

  imageJobScanPromise = Promise.resolve()
    .then(processPendingCodexJobs)
    .catch((error) => {
      console.error("Image job processing failed:", error);
    })
    .finally(() => {
      imageJobScanPromise = null;
      if (imageJobRescanRequested) {
        imageJobRescanRequested = false;
        requestImageJobProcessing();
      }
    });
  return imageJobScanPromise;
}

async function queueDefaultArtworkJobs() {
  for (const pack of Object.values(countryPacks)) {
    for (const page of listDefaultArtworkPages(pack.scenes, pack.nodes, pack.countrySlug, pack.title)) {
      await createCodexImageJob(page, { jobKind: "prewarm" });
    }
  }
}

async function processPendingCodexJobs() {
  const jobFiles = await listRuntimeImageJobFiles();
  const jobs = [];

  for (const { fileName, jobPath } of jobFiles) {
    if (terminalImageJobs.has(jobPath)) continue;
    let job = await readCodexImageJob(jobPath);
    if (["ready", "failed"].includes(job?.status)) {
      terminalImageJobs.add(jobPath);
      continue;
    }
    if (isStaleProcessingImageJob(job) && !processingJobs.has(jobPath)) {
      job = {
        ...job,
        status: "pending_codex_image_generation",
        recoveredAt: new Date().toISOString(),
        recoveryCount: (job.recoveryCount ?? 0) + 1,
        lastRecoveryReason: "processing lease expired after a server interruption"
      };
      await writeCodexImageJob(jobPath, job);
    }
    jobs.push({ fileName, jobPath, job });
  }

  const eligibleJobs = jobs.filter(({ jobPath, job }) => shouldProcessCodexJob(job, jobPath));
  const selectedJobs = selectImageJobsForProcessing({
    jobs: eligibleJobs,
    runningJobKinds: processingJobs.values(),
    providerConcurrency: appExperienceConfig.providerConcurrency,
    interactiveReservedSlots: appExperienceConfig.interactiveReservedSlots
  });

  for (const { jobPath, job } of selectedJobs) {
    const run = processCodexImageJob(jobPath, job);
    processingJobRuns.set(jobPath, run);
    run
      .catch((error) => {
        console.error("Image job processing failed:", error);
      })
      .finally(() => {
        if (processingJobRuns.get(jobPath) === run) processingJobRuns.delete(jobPath);
      });
  }
}

async function listRuntimeImageJobFiles() {
  await mkdir(runtimeCacheRoot, { recursive: true });
  const jobFiles = [];

  await collectImageJobFiles({
    jobDir: path.join(runtimeCacheRoot, "image-jobs"),
    fileNamePrefix: "legacy"
  }).then((items) => jobFiles.push(...items));

  const entries = await readdir(runtimeCacheRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "image-jobs") continue;
    const countrySlug = entry.name;
    const countryJobDir = path.join(runtimeCacheRoot, countrySlug, "image-jobs");
    const items = await collectImageJobFiles({
      jobDir: countryJobDir,
      fileNamePrefix: countrySlug
    });
    jobFiles.push(...items);
  }

  return jobFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function collectImageJobFiles({ jobDir, fileNamePrefix }) {
  let entries;
  try {
    entries = await readdir(jobDir);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => ({
      fileName: `${fileNamePrefix}/${entry}`,
      jobPath: path.join(jobDir, entry)
    }));
}

function shouldProcessCodexJob(job, jobPath) {
  const retryAt = Date.parse(job?.retryNotBefore ?? "");
  return (
    job &&
    job.status === "pending_codex_image_generation" &&
    job.autoProcess === true &&
    Boolean(job.assetVersion) &&
    Boolean(job.prompt) &&
    (!Number.isFinite(retryAt) || retryAt <= Date.now()) &&
    !processingJobs.has(jobPath) &&
    !isJobPathBeingFlushed(jobPath)
  );
}

async function processCodexImageJob(jobPath, job) {
  processingJobs.set(jobPath, job.jobKind ?? "prewarm");
  const abortController = new AbortController();
  processingJobAbortControllers.set(jobPath, abortController);
  const imageModel = getConfiguredImageModel();
  const countrySlug = getRuntimeCountrySlugForJob(job);
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: job.pageId,
    imageModel,
    countrySlug,
    outputFormat: appConfig.image.outputFormat,
    variantKey: job.assetVersion
  });
  const processingStartedAt = new Date().toISOString();
  const processingJob = {
    ...job,
    countrySlug,
    status: "processing_openai_image",
    imageModel,
    requestedImageModel: imageModel,
    attemptCount: (job.attemptCount ?? 0) + 1,
    firstProcessingStartedAt: job.firstProcessingStartedAt ?? job.processingStartedAt ?? processingStartedAt,
    processingStartedAt,
    providerStartedAt: processingStartedAt,
    retryNotBefore: null,
    error: null
  };
  let firstPartialAt = job.firstPartialAt ?? null;
  let latestPartialAt = job.latestPartialAt ?? null;

  try {
    throwIfImageJobCancelled(jobPath);
    await mkdir(path.dirname(paths.imagePath), { recursive: true });
    throwIfImageJobCancelled(jobPath);
    await writeCodexImageJob(jobPath, processingJob);

    const generated = await generateConfiguredImage({
      model: imageModel,
      prompt: job.prompt,
      signal: abortController.signal,
      onPartialImage: async (partial) => {
        if (cancelledImageJobs.has(jobPath)) return;
        const receivedAt = new Date().toISOString();
        firstPartialAt ??= receivedAt;
        latestPartialAt = receivedAt;
        await writeFile(paths.partialImagePath, Buffer.from(partial.b64Json, "base64"));
        const partialImageWrittenAt = new Date().toISOString();
        const currentJob = await readCodexImageJob(jobPath);
        if (
          currentJob?.assetVersion !== job.assetVersion ||
          cancelledImageJobs.has(jobPath) ||
          !processingJobs.has(jobPath) ||
          !["processing_openai_image", "partial_ready"].includes(currentJob.status)
        ) {
          return;
        }
        await writeCodexImageJob(jobPath, {
          ...currentJob,
          status: "partial_ready",
          partialImageUrl: paths.partialImageUrl,
          firstPartialAt: currentJob.firstPartialAt ?? firstPartialAt,
          latestPartialAt,
          partialImageWrittenAt,
          partialImageIndex: partial.partialImageIndex ?? 0
        });
      }
    });
    const providerCompletedAt = new Date().toISOString();

    throwIfImageJobCancelled(jobPath);
    await writeFile(paths.imagePath, Buffer.from(generated.b64Json, "base64"));
    const imageWrittenAt = new Date().toISOString();
    const metadataPreparedAt = new Date().toISOString();
    throwIfImageJobCancelled(jobPath);
    await writeFile(
      paths.metadataPath,
      JSON.stringify(
        {
          pageId: job.pageId,
          countrySlug,
          assetVersion: job.assetVersion,
          sceneId: job.sceneId,
          nodeId: job.nodeId,
          parentId: job.parentId,
          parentClick: job.parentClick,
          imageModel: generated.model,
          requestedImageModel: imageModel,
          imageProvider: generated.provider ?? getConfiguredImageProvider(),
          size: generated.size,
          quality: generated.quality ?? appConfig.image.quality,
          outputFormat: generated.outputFormat ?? appConfig.image.outputFormat,
          outputCompression: generated.outputCompression ?? appConfig.image.outputCompression,
          imageUrl: paths.imageUrl,
          environmentUrl: paths.environmentUrl,
          prompt: job.prompt,
          revisedPrompt: generated.revisedPrompt,
          usage: generated.usage ?? null,
          cacheKind: "runtime",
          generatedAt: providerCompletedAt,
          processingStartedAt,
          providerCompletedAt,
          firstPartialAt,
          imageWrittenAt,
          metadataPreparedAt,
          factBoundary: "Generated image is visual only and is not a fact source."
        },
        null,
        2
      )
    );
    const metadataWrittenAt = new Date().toISOString();
    throwIfImageJobCancelled(jobPath);
    const readyAt = new Date().toISOString();
    const currentJob = await readCodexImageJob(jobPath);
    const completedJobKind = currentJob?.jobKind ?? processingJob.jobKind;
    const shouldQueueEnvironment = shouldQueueEnvironmentPlanForJobKind(completedJobKind);
    const readyPage = {
      id: job.pageId,
      countrySlug,
      assetVersion: job.assetVersion,
      sceneId: job.sceneId,
      nodeId: job.nodeId,
      imageUrl: paths.imageUrl,
      status: "ready",
      plan: {
        title: job.title,
        pageType: job.pageType
      }
    };

    await writeCodexImageJob(jobPath, {
      ...(currentJob?.assetVersion === job.assetVersion ? currentJob : processingJob),
      countrySlug,
      status: "ready",
      assetVersion: job.assetVersion,
      imageUrl: paths.imageUrl,
      partialImageUrl: firstPartialAt ? paths.partialImageUrl : undefined,
      source: `${generated.provider ?? getConfiguredImageProvider()}-image-api`,
      imageProvider: generated.provider ?? getConfiguredImageProvider(),
      imageModel: generated.model,
      requestedImageModel: imageModel,
      metadataUrl: paths.metadataUrl,
      environmentUrl: paths.environmentUrl,
      environmentStatus: shouldQueueEnvironment ? "pending" : "deferred",
      cacheKind: "runtime",
      processingStartedAt,
      providerCompletedAt,
      firstPartialAt,
      latestPartialAt,
      imageWrittenAt,
      metadataWrittenAt,
      readyAt,
      completedAt: readyAt
    });
    throwIfImageJobCancelled(jobPath);
    if (shouldQueueEnvironment) {
      queueEnvironmentPlan({ page: readyPage, paths, jobPath });
    }
    await ensurePageUnderstanding(readyPage);
  } catch (error) {
    if (cancelledImageJobs.has(jobPath)) return;
    const failedAt = new Date().toISOString();
    const currentJob = await readCodexImageJob(jobPath);
    const retryable = isTransientImageGenerationError(error) && processingJob.attemptCount < 3;
    const retryDelayMs = Math.min(
      5 * 60 * 1000,
      Math.max(
        1000 * 2 ** (processingJob.attemptCount - 1),
        Number(error?.retryAfterMs) || 0
      )
    );
    await writeCodexImageJob(jobPath, {
      ...(currentJob?.assetVersion === job.assetVersion ? currentJob : processingJob),
      countrySlug,
      status: retryable ? "pending_codex_image_generation" : "failed",
      error: String(error?.message ?? error),
      transientError: retryable,
      retryNotBefore: retryable ? new Date(Date.now() + retryDelayMs).toISOString() : null,
      retryScheduledAt: retryable ? failedAt : null,
      failedAt: retryable ? null : failedAt,
      lastAttemptFailedAt: failedAt,
      processingStartedAt,
      firstPartialAt,
      latestPartialAt
    });
  } finally {
    processingJobs.delete(jobPath);
    processingJobAbortControllers.delete(jobPath);
    cancelledImageJobs.delete(jobPath);
    requestImageJobProcessing();
  }
}

function throwIfImageJobCancelled(jobPath) {
  if (cancelledImageJobs.has(jobPath)) {
    throw new Error("Image generation cancelled because its runtime cache was flushed.");
  }
}

function isTransientImageGenerationError(error) {
  return /(?:\b408\b|\b409\b|\b429\b|\b5\d\d\b|fetch failed|network|econnreset|etimedout|timeout|aborted|terminated|premature close|socket hang up)/i.test(
    String(error?.message ?? error)
  );
}

function getConfiguredImageModel() {
  return normalizeImageModel(appConfig.image.model ?? DEFAULT_IMAGE_MODEL);
}

function getConfiguredImageProvider() {
  return DEFAULT_IMAGE_PROVIDER;
}

function hasConfiguredImageProvider() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function canAutoProcessImages() {
  return hasConfiguredImageProvider() && appExperienceConfig.providerConcurrency > 0;
}

async function generateConfiguredImage({ model, prompt, onPartialImage, signal = null }) {
  return generateTileImageWithOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model,
    prompt,
    fallbackModel: appConfig.image.fallbackModel,
    size: appConfig.image.size,
    quality: appConfig.image.quality,
    outputFormat: appConfig.image.outputFormat,
    outputCompression: appConfig.image.outputCompression,
    partialImages: appConfig.image.partialImages,
    onPartialImage,
    signal
  });
}

async function resolveClickPhraseWithOpenAI({
  sceneId,
  countrySlug = DEFAULT_COUNTRY_SLUG,
  imageUrl,
  normalizedClick,
  imageClick,
  point
}) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: "provider_missing",
      phrase: null,
      reason: "OPENAI_API_KEY is not configured, so true VLM resolving is unavailable."
    };
  }

  const pack = getCountryPack(countrySlug) ?? defaultCountryPack;
  const fallbackSceneId = pack?.overviewSceneId;
  const artwork = imageUrl
    ? { imageUrl }
    : getSceneArtwork(sceneId) ?? (fallbackSceneId ? getSceneArtwork(fallbackSceneId) : null);
  if (!artwork?.imageUrl) {
    return {
      status: "image_missing",
      phrase: null,
      reason: `No generated artwork is registered for ${sceneId}.`
    };
  }

  const imagePath = getImagePathFromUrl(artwork.imageUrl);
  if (!imagePath) {
    return {
      status: "image_missing",
      phrase: null,
      reason: "Current page image path is outside the RoamAtlas workspace and runtime cache."
    };
  }
  const imageBytes = await readFile(imagePath);
  const clickPoint = imageClick?.normalizedImage ?? normalizedClick ?? null;
  const markedImage = clickPoint
    ? annotateClickPointOnPng(imageBytes, clickPoint.x, clickPoint.y)
    : null;
  const vlmImageBytes = markedImage?.bytes ?? imageBytes;
  const vlmMimeType = markedImage?.mimeType ?? mimeTypeForImagePath(imagePath);
  const coordinateText = imageClick?.normalizedImage
    ? [
        `Click coordinates in original image pixels: x=${imageClick.pixel?.x}, y=${imageClick.pixel?.y}.`,
        `Click coordinates normalized to the original image: x=${imageClick.normalizedImage.x}, y=${imageClick.normalizedImage.y}.`,
        `The browser displayed this image with object-fit: ${imageClick.objectFit ?? "contain"}; use the original-image pixel coordinate, not the viewport coordinate.`
      ].join("\n")
    : normalizedClick
    ? `Click coordinates normalized to the visible viewport: x=${normalizedClick.x}, y=${normalizedClick.y}.`
    : `Click coordinates in displayed image space: x=${point?.x}, y=${point?.y}.`;
  const candidateText = getSceneCandidateText(sceneId, pack);
  const markerInstruction = markedImage
    ? "A red crosshair with a white halo marks the user's click. Ignore the marker itself."
    : "No marker was drawn on this image. Use the supplied original-image coordinates to locate the user's click.";
  const targetInstruction = markedImage
    ? `Describe only the exact visual subject under or closest to the crosshair in this illustrated ${pack.title} atlas image.`
    : `Describe only the exact visual subject at or closest to the supplied coordinates in this illustrated ${pack.title} atlas image.`;
  const prompt = [
    "You are RoamAtlas' click resolver.",
    markerInstruction,
    targetInstruction,
    "If the clicked region contains or is closest to one of the known RoamAtlas candidate labels, return that exact candidate label.",
    "Be specific. If the user clicked an infinity pool, roof garden, animal, dome, bridge, beach, canopy, food stall, or building part, name that visual subject.",
    candidateText,
    "Do not make factual travel claims. Do not invent official names, opening hours, prices, routes, or live availability.",
    "Return JSON only with this shape:",
    '{"phrase":"short visual phrase","confidence":"low|medium|high","reason":"short reason"}',
    coordinateText,
    `Current country slug: ${pack.countrySlug}.`,
    `Current scene id: ${sceneId}.`
  ].join("\n");

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: appConfig.ai.vlmModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:${vlmMimeType};base64,${vlmImageBytes.toString("base64")}`,
              detail: "high"
            }
          ]
        }
      ]
    })
  });

  if (!openaiResponse.ok) {
    return {
      status: "vlm_error",
      phrase: null,
      reason: await openaiResponse.text()
    };
  }

  const payload = await openaiResponse.json();
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text ?? "{}";

  try {
    return {
      status: "resolved",
      imageMarked: Boolean(markedImage),
      ...JSON.parse(text)
    };
  } catch {
    return {
      status: "resolved",
      phrase: text,
      confidence: "low",
      imageMarked: Boolean(markedImage),
      reason: "Model returned non-JSON text."
    };
  }
}

function getSceneCandidateText(sceneId, pack) {
  const scene = pack.scenes[sceneId];
  const rootNode = pack.nodes[scene?.rootNodeId];
  const candidateLabels = (rootNode?.childIds ?? [])
    .map((nodeId) => pack.nodes[nodeId]?.title)
    .filter(Boolean);
  if (candidateLabels.length === 0) return "Known RoamAtlas candidate labels: none.";
  return `Known RoamAtlas candidate labels for this page: ${candidateLabels.join(", ")}.`;
}

function annotateClickPointOnPng(imageBytes, normalizedX, normalizedY) {
  try {
    const png = decodeSimplePng(imageBytes);
    if (!png) return null;

    const x = Math.round(clamp01(normalizedX) * (png.width - 1));
    const y = Math.round(clamp01(normalizedY) * (png.height - 1));
    const radius = Math.max(24, Math.round(Math.min(png.width, png.height) * 0.035));
    const haloWidth = Math.max(7, Math.round(radius * 0.16));
    const redWidth = Math.max(3, Math.round(radius * 0.08));

    drawCrosshair(png, x, y, radius + haloWidth, haloWidth, [255, 255, 255, 255]);
    drawCircle(png, x, y, Math.round(radius * 0.55), haloWidth, [255, 255, 255, 255]);
    drawCrosshair(png, x, y, radius, redWidth, [226, 32, 32, 255]);
    drawCircle(png, x, y, Math.round(radius * 0.55), redWidth, [226, 32, 32, 255]);
    drawFilledCircle(png, x, y, Math.max(3, redWidth), [226, 32, 32, 255]);

    return {
      bytes: encodeSimplePng(png),
      mimeType: "image/png"
    };
  } catch {
    return null;
  }
}

function decodeSimplePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(buffer) || buffer.length < signature.length || !buffer.subarray(0, 8).equals(signature)) {
    return null;
  }

  let offset = 8;
  let header = null;
  const idatChunks = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (
    !header ||
    header.bitDepth !== 8 ||
    ![2, 6].includes(header.colorType) ||
    header.compression !== 0 ||
    header.filter !== 0 ||
    header.interlace !== 0 ||
    idatChunks.length === 0
  ) {
    return null;
  }

  const channels = header.colorType === 6 ? 4 : 3;
  const stride = header.width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(header.width * header.height * channels);
  let srcOffset = 0;
  let prevRow = Buffer.alloc(stride);

  for (let row = 0; row < header.height; row += 1) {
    const filter = inflated[srcOffset];
    srcOffset += 1;
    const rawRow = inflated.subarray(srcOffset, srcOffset + stride);
    srcOffset += stride;
    const decodedRow = unfilterPngRow(rawRow, prevRow, filter, channels);
    decodedRow.copy(pixels, row * stride);
    prevRow = decodedRow;
  }

  return {
    width: header.width,
    height: header.height,
    colorType: header.colorType,
    channels,
    pixels
  };
}

function unfilterPngRow(row, previousRow, filter, bytesPerPixel) {
  const output = Buffer.alloc(row.length);
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bytesPerPixel ? output[i - bytesPerPixel] : 0;
    const up = previousRow[i] ?? 0;
    const upperLeft = i >= bytesPerPixel ? previousRow[i - bytesPerPixel] ?? 0 : 0;
    let value;
    if (filter === 0) {
      value = row[i];
    } else if (filter === 1) {
      value = row[i] + left;
    } else if (filter === 2) {
      value = row[i] + up;
    } else if (filter === 3) {
      value = row[i] + Math.floor((left + up) / 2);
    } else if (filter === 4) {
      value = row[i] + paethPredictor(left, up, upperLeft);
    } else {
      throw new Error(`Unsupported PNG filter ${filter}`);
    }
    output[i] = value & 0xff;
  }
  return output;
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function drawCrosshair(png, centerX, centerY, radius, thickness, color) {
  drawRect(png, centerX - radius, centerY - Math.floor(thickness / 2), radius * 2 + 1, thickness, color);
  drawRect(png, centerX - Math.floor(thickness / 2), centerY - radius, thickness, radius * 2 + 1, color);
}

function drawCircle(png, centerX, centerY, radius, thickness, color) {
  const outer = radius + Math.ceil(thickness / 2);
  const inner = Math.max(0, radius - Math.floor(thickness / 2));
  const outerSq = outer * outer;
  const innerSq = inner * inner;
  for (let y = centerY - outer; y <= centerY + outer; y += 1) {
    for (let x = centerX - outer; x <= centerX + outer; x += 1) {
      const distanceSq = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (distanceSq >= innerSq && distanceSq <= outerSq) {
        setPngPixel(png, x, y, color);
      }
    }
  }
}

function drawFilledCircle(png, centerX, centerY, radius, color) {
  const radiusSq = radius * radius;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSq) {
        setPngPixel(png, x, y, color);
      }
    }
  }
}

function drawRect(png, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPngPixel(png, xx, yy, color);
    }
  }
}

function setPngPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = (y * png.width + x) * png.channels;
  png.pixels[offset] = color[0];
  png.pixels[offset + 1] = color[1];
  png.pixels[offset + 2] = color[2];
  if (png.channels === 4) png.pixels[offset + 3] = color[3];
}

function encodeSimplePng(png) {
  const stride = png.width * png.channels;
  const scanlines = Buffer.alloc((stride + 1) * png.height);
  for (let row = 0; row < png.height; row += 1) {
    const targetOffset = row * (stride + 1);
    scanlines[targetOffset] = 0;
    png.pixels.copy(scanlines, targetOffset + 1, row * stride, (row + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(png.width, 0);
  ihdr.writeUInt32BE(png.height, 4);
  ihdr[8] = 8;
  ihdr[9] = png.colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", deflateSync(scanlines)),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function mimeTypeForImagePath(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

async function serveStatic(pathname, response) {
  if (pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (pathname.startsWith(`${RUNTIME_CACHE_URL_PREFIX}/`)) {
    await serveRuntimeCache(pathname, response);
    return;
  }

  const safePath = pathname === "/" || isAppRoutePath(pathname) ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, safePath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const file = await readFile(filePath);
  const ext = path.extname(filePath);
  const isDevAsset = [".html", ".js", ".css"].includes(ext);
  const headers = {
    "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
    ...(isDevAsset ? { "Cache-Control": "no-cache" } : {})
  };

  if (safePath === "/index.html") {
    const html = file.toString("utf8");
    const body = html.includes(DEV_LIVE_RELOAD_SCRIPT)
      ? html
      : html.replace("</body>", `${DEV_LIVE_RELOAD_SCRIPT}\n  </body>`);
    response.writeHead(200, headers);
    response.end(body);
    return;
  }

  response.writeHead(200, headers);
  response.end(file);
}

function isAppRoutePath(pathname) {
  return !pathname.startsWith("/api/") && !path.extname(pathname);
}

async function serveRuntimeCache(pathname, response) {
  const relativePath = decodeURIComponent(pathname.slice(RUNTIME_CACHE_URL_PREFIX.length + 1));
  const compatibleRelativePath = normalizeRuntimeCacheRelativePath(relativePath);
  const filePath = path.normalize(path.join(runtimeCacheRoot, compatibleRelativePath));
  if (!filePath.startsWith(runtimeCacheRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const file = await readFile(filePath);
  const ext = path.extname(filePath);
  const isMutableRuntimeJson = isMutableRuntimeJsonPath(compatibleRelativePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
    "Cache-Control": isMutableRuntimeJson
      ? "no-store"
      : "private, max-age=31536000, immutable"
  });
  response.end(file);
}

function normalizeRuntimeCacheRelativePath(relativePath) {
  if (relativePath.startsWith("codex-jobs/")) {
    return relativePath.replace(/^codex-jobs\//, "image-jobs/");
  }

  return relativePath.replace(/^([^/]+)\/codex-jobs\//, "$1/image-jobs/");
}

function isMutableRuntimeJsonPath(relativePath) {
  return (
    /^(?:[^/]+\/)?(?:image-jobs|codex-jobs|understanding|environment|starter-map|country-pack-draft)\//.test(relativePath) ||
    /^(?:[^/]+\/)?place-images\/[^/]+\.json$/.test(relativePath)
  );
}

function getImagePathFromUrl(imageUrl) {
  if (imageUrl.startsWith(`${RUNTIME_CACHE_URL_PREFIX}/`)) {
    const relativePath = decodeURIComponent(imageUrl.slice(RUNTIME_CACHE_URL_PREFIX.length + 1));
    const imagePath = path.normalize(path.join(runtimeCacheRoot, relativePath));
    return imagePath.startsWith(runtimeCacheRoot) ? imagePath : null;
  }

  const imagePath = path.normalize(path.join(root, imageUrl.replace(/^\.\//, "")));
  return imagePath.startsWith(root) ? imagePath : null;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function loadLocalEnv(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
