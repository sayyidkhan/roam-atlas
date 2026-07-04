import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

import { getSceneArtwork } from "../src/data/sceneArtwork.js";
import {
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "../src/data/defaultArtworkPages.js";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  getCountryPack
} from "../src/data/countryPacks/index.js";
import { getCountryBySlug } from "../src/data/countries.js";
import { sceneArtwork } from "../src/data/sceneArtwork.js";
import { resolveWandersgConfig } from "../src/config/wandersgConfig.js";
import {
  buildCountryDraftInfluencePrompt,
  buildCountryDraftPrompt,
  createCountryPackDraftFromStarterMap,
  createCountryPackStarterMap,
  createCountryDraftFallback,
  normalizeCountryDraftInstruction,
  normalizeCountryDraftPayload
} from "../src/domain/countryDraft.js";
import { resolveFlipbookClick } from "../src/domain/flipbookPage.js";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROVIDER,
  generateTileImageWithOpenAI,
  normalizeImageModel
} from "../src/domain/imageProvider.js";
import {
  shouldQueueDefaultArtwork,
  sortImageJobsForProcessing
} from "../src/domain/imageJobQueue.js";
import {
  DEFAULT_RUNTIME_COUNTRY_SLUG,
  RUNTIME_CACHE_URL_PREFIX,
  createCountryStarterMapCachePaths,
  createRuntimeCachePaths,
  resolveRuntimeCacheRoot
} from "../src/domain/runtimeCache.js";
import { matchClickPhraseToNode } from "../src/domain/nodeMatcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadLocalEnv(path.join(root, ".env"));
const appConfig = resolveWandersgConfig(process.env);
const port = appConfig.server.port;
const runtimeCacheRoot = resolveRuntimeCacheRoot();
const defaultCountryPack = getCountryPack(DEFAULT_COUNTRY_SLUG);
const processingJobs = new Set();
const countryDraftCache = new Map();
const ENVIRONMENT_PLAN_SCHEMA_VERSION = "environment-plan-v1";
const ENVIRONMENT_PLAN_PROMPT_VERSION = "environment-plan-v2";

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
    if (request.method === "POST" && url.pathname === "/api/runtime-cache/flush") {
      await handleRuntimeCacheFlushRequest(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error("WanderSG dev server request failed:", error);
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: String(error?.message ?? error) }));
  }
}).listen(port, () => {
  console.log(`WanderSG dev server listening on http://127.0.0.1:${port}`);
  console.log(`WanderSG runtime cache: ${runtimeCacheRoot}`);
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
      result.page = await createCodexImageJob(result.page);
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
    result.page = await createCodexImageJob(result.page);
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(result));
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
    countrySlug: getRuntimeCountrySlugForPage(page)
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
    countrySlug: getRuntimeCountrySlugForPage(page)
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

  const artworkPage = await createCodexImageJob(page, { jobKind: nodeId ? "interactive" : "artwork" });
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ page: artworkPage }));
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
  if (countryPack) {
    if (!forceGenerate) {
      const storedPackSnapshot = await readStoredCountryDraft(country);
      if (storedPackSnapshot?.mode === "curated_pack_snapshot") {
        countryDraftCache.set(country.slug, storedPackSnapshot);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ draft: storedPackSnapshot, cached: true, persisted: true }));
        return;
      }
    }

    const packSnapshot = createCountryPackStarterMap(countryPack);
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
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ draft: cachedDraft, cached: true }));
      return;
    }

    const storedDraft = await readStoredCountryDraft(country);
    if (storedDraft) {
      countryDraftCache.set(country.slug, storedDraft);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ draft: storedDraft, cached: true, persisted: true }));
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
  return Boolean(countryPack) && countryPack.confidence !== "unconfirmed";
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

  if (getCountryPack(country.slug)) {
    response.writeHead(409, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      error: `${country.name} is already backed by a curated country pack.`
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
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown country: ${countrySlug}` }));
    return;
  }

  const result = await flushCountryGeneratedRuntimeCache(country.slug);
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    countrySlug: country.slug,
    countryName: country.name,
    ...result
  }));
}

async function flushCountryGeneratedRuntimeCache(countrySlug) {
  const countryCacheRoot = path.normalize(path.join(runtimeCacheRoot, countrySlug));
  if (!isPathInside(runtimeCacheRoot, countryCacheRoot)) {
    throw new Error(`Unsafe runtime cache path for ${countrySlug}.`);
  }

  const generatedFolders = ["image-jobs", "flipbook", "understanding", "environment"];
  clearProcessingJobsForCountry(countryCacheRoot);
  await Promise.all(
    generatedFolders.map((folder) =>
      rm(path.join(countryCacheRoot, folder), { recursive: true, force: true })
    )
  );

  return {
    flushed: true,
    removedFolders: generatedFolders,
    preservedFolders: ["starter-map", "country-pack-draft"],
    factBoundary: "Only generated visual/runtime cache was flushed. Country-pack data and starter-map review artifacts were preserved."
  };
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function clearProcessingJobsForCountry(countryCacheRoot) {
  for (const jobPath of [...processingJobs]) {
    if (isPathInside(countryCacheRoot, path.normalize(jobPath))) {
      processingJobs.delete(jobPath);
    }
  }
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
      return draft;
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
  await mkdir(path.dirname(paths.starterMapPath), { recursive: true });
  await writeFile(
    paths.starterMapPath,
    `${JSON.stringify(
      {
        countrySlug: country.slug,
        countryCode: country.code,
        countryName: country.name,
        draft,
        storageKind: "runtime-starter-map",
        factBoundary: draft.mode === "curated_pack_snapshot"
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
  const prompt = instruction
    ? buildCountryDraftInfluencePrompt({ country, instruction, currentDraft })
    : buildCountryDraftPrompt(country);
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
    model
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
  return normalizeCountryDraftPayload(currentDraft, country, {
    generatedAt: currentDraft.generatedAt,
    model: currentDraft.model,
    generationStatus: currentDraft.generationStatus ?? "ready"
  });
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

async function createCodexImageJob(page, { jobKind = "interactive" } = {}) {
  const imageModel = getConfiguredImageModel();
  const countrySlug = getRuntimeCountrySlugForPage(page);
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: page.id,
    imageModel,
    countrySlug
  });
  const outputDir = path.dirname(paths.jobPath);
  const jobPath = paths.jobPath;
  const jobUrl = paths.jobUrl;

  await mkdir(outputDir, { recursive: true });
  const existingJob = await readCodexImageJob(jobPath);
  const prompt = page.plan?.imagePrompt;
  const existingMatchesRequest =
    existingJob?.prompt === prompt &&
    normalizeImageModel(existingJob?.imageModel ?? imageModel) === normalizeImageModel(imageModel);

  if (existingMatchesRequest && existingJob?.status === "ready" && existingJob.imageUrl) {
    const environmentPlan = await ensureEnvironmentPlanForPage({
      ...page,
      countrySlug,
      imageUrl: existingJob.imageUrl,
      status: "ready"
    }, paths);
    await ensurePageUnderstanding({
      ...page,
      imageUrl: existingJob.imageUrl,
      status: "ready"
    });
    return {
      ...page,
      countrySlug,
      imageUrl: existingJob.imageUrl,
      status: "ready",
      environmentUrl: paths.environmentUrl,
      generated: {
        source: existingJob.source ?? "image-cache",
        jobUrl,
        environmentUrl: paths.environmentUrl,
        environmentStatus: environmentPlan?.status ?? "ready",
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  const existingMetadata = await readRuntimeImageMetadata(paths.metadataPath);
  const existingMetadataMatchesRequest =
    existingMetadata?.prompt === prompt &&
    normalizeImageModel(existingMetadata?.imageModel ?? imageModel) === normalizeImageModel(imageModel) &&
    existingMetadata.imageUrl;
  if (existingMetadataMatchesRequest) {
    const environmentPlan = await ensureEnvironmentPlanForPage({
      ...page,
      countrySlug,
      imageUrl: existingMetadata.imageUrl,
      status: "ready"
    }, paths);
    const readyJob = {
      pageId: page.id,
      countrySlug,
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
      metadataUrl: paths.metadataUrl,
      environmentUrl: paths.environmentUrl,
      environmentStatus: environmentPlan?.status ?? "ready",
      prompt,
      title: page.plan?.title,
      pageType: page.plan?.pageType,
      cacheKind: "runtime",
      factBoundary: "Generated image is visual only and is not a fact source.",
      reusedFromMetadata: true,
      completedAt: existingMetadata.generatedAt ?? new Date().toISOString()
    };
    await writeCodexImageJob(jobPath, readyJob);
    await ensurePageUnderstanding({
      ...page,
      imageUrl: existingMetadata.imageUrl,
      status: "ready"
    });
    return {
      ...page,
      countrySlug,
      imageUrl: existingMetadata.imageUrl,
      status: "ready",
      environmentUrl: paths.environmentUrl,
      generated: {
        source: readyJob.source,
        jobUrl,
        environmentUrl: paths.environmentUrl,
        environmentStatus: environmentPlan?.status ?? "ready",
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  if (
    existingMatchesRequest &&
    (existingJob?.status === "pending_codex_image_generation" ||
      existingJob?.status === "processing_openai_image")
  ) {
    if (hasConfiguredImageProvider() && existingJob.autoProcess !== true) {
      await writeCodexImageJob(jobPath, {
        ...existingJob,
        jobKind: existingJob.jobKind ?? jobKind,
        autoProcess: true,
        updatedAt: new Date().toISOString()
      });
    }
    return {
      ...page,
      countrySlug,
      status: "pending_codex_image_generation",
      generated: {
        source: "image-generation-required",
        jobUrl,
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  await writeCodexImageJob(jobPath, {
    pageId: page.id,
    countrySlug,
    sceneId: page.sceneId,
    nodeId: page.nodeId,
    parentId: page.parentId,
    parentClick: page.parentClick,
    status: "pending_codex_image_generation",
    jobKind,
    autoProcess: hasConfiguredImageProvider(),
    imageModel,
    prompt,
    title: page.plan?.title,
    pageType: page.plan?.pageType,
    cacheKind: "runtime",
    factBoundary: "Generated image is visual only and is not a fact source.",
    createdAt: new Date().toISOString()
  });

  return {
    ...page,
    countrySlug,
    status: "pending_codex_image_generation",
    generated: {
      source: "image-generation-required",
      jobUrl,
      factBoundary: "Generated fallback art is visual only and is not a fact source."
    }
  };
}

async function writeCodexImageJob(jobPath, job) {
  await mkdir(path.dirname(jobPath), { recursive: true });
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`);
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

async function ensureEnvironmentPlanForPage(page, paths) {
  if (!page?.imageUrl) return null;

  const existing = await readRuntimeEnvironmentPlan(paths.environmentPath);
  if (
    existing?.version === ENVIRONMENT_PLAN_SCHEMA_VERSION &&
    existing.promptVersion === ENVIRONMENT_PLAN_PROMPT_VERSION &&
    existing.imageUrl === page.imageUrl
  ) {
    return existing;
  }

  let plan;
  try {
    plan = await createEnvironmentPlanWithOpenAI(page);
  } catch (error) {
    plan = createEnvironmentFallbackPlan(page, String(error?.message ?? error));
  }

  await mkdir(path.dirname(paths.environmentPath), { recursive: true });
  await writeFile(paths.environmentPath, `${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}

async function readRuntimeEnvironmentPlan(environmentPath) {
  try {
    return JSON.parse(await readFile(environmentPath, "utf8"));
  } catch {
    return null;
  }
}

async function createEnvironmentPlanWithOpenAI(page) {
  if (!process.env.OPENAI_API_KEY) {
    return createEnvironmentFallbackPlan(page, "OPENAI_API_KEY is not configured.");
  }

  const imagePath = getImagePathFromUrl(page.imageUrl);
  if (!imagePath) {
    return createEnvironmentFallbackPlan(page, "Current page image path is outside the WanderSG workspace and runtime cache.");
  }

  const imageBytes = await readFile(imagePath);
  const mimeType = mimeTypeForImagePath(imagePath);
  const prompt = buildEnvironmentPlanPrompt(page);
  const models = [
    appConfig.ai.environmentModel,
    appConfig.ai.environmentFallbackModel
  ].filter((model, index, list) => model && list.indexOf(model) === index);
  let lastError = null;

  for (const model of models) {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
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
      continue;
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

function buildEnvironmentPlanPrompt(page) {
  const pack = getCountryPackForPage(page);
  const title = page.plan?.title ?? page.title ?? page.nodeId ?? page.sceneId ?? "current atlas page";
  const pageType = page.plan?.pageType ?? page.pageType ?? "atlas_page";
  return [
    "You are WanderSG's environment planner for a generated travel-atlas illustration.",
    "Inspect the actual image and choose small safe regions for code-rendered ambience overlays.",
    "The overlays are decorative only. They must not imply verified travel facts, wildlife sightings, routes, prices, opening hours, or official claims.",
    `Country: ${pack.title}.`,
    `Page title: ${title}.`,
    `Page type: ${pageType}.`,
    "Return JSON only with this exact shape:",
    `{"version":"${ENVIRONMENT_PLAN_SCHEMA_VERSION}","layers":[{"id":"short-id","kind":"cloud|water|foliage|light|marine_life|birds","bounds":{"x":0,"y":0,"width":0.2,"height":0.1},"intensity":"subtle|medium","safePlacement":"sky|open_air|open_water|foliage|open_light","avoid":["land","islands","buildings","labels","callouts","leader lines","people","animals"],"reason":"short visual reason"}],"warnings":["short warning"]}`,
    "Bounds are normalized to the original image: x, y, width, and height must be between 0 and 1.",
    "Use at most 6 layers.",
    "Prefer small, sparse regions with empty visual space.",
    "Clouds and birds may only go in clear sky or open air.",
    "Water shimmer and marine_life may only go on clear open water. Never place them over land, islands, buildings, bridges, boats, labels, numbered markers, callouts, or leader lines.",
    "Marine_life means a tiny decorative jumping silhouette, not a factual dolphin claim. If there is a large uncluttered open-water area, include one small marine_life layer; skip it only when it would overlap land, islands, labels, boats, buildings, bridges, people, or animals.",
    "Foliage may only go over dense tree canopy or vegetation, never over buildings or labels.",
    "If you cannot identify safe regions, return an empty layers array with a warning.",
    "Do not ask for generated code. Do not describe animation implementation."
  ].join("\n");
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
    console.log("WanderSG image job processor idle: no image provider key is configured.");
    return;
  }

  console.log(`WanderSG image job processor enabled with ${getConfiguredImageProvider()}.`);
  const initialQueue = shouldQueueDefaultArtwork()
    ? queueDefaultArtworkJobs()
    : Promise.resolve();
  if (!shouldQueueDefaultArtwork()) {
    console.log("WanderSG default artwork pre-generation skipped. Set WANDERSG_PREGENERATE_DEFAULT_ARTWORK=true to enable it.");
  }
  initialQueue.then(processPendingCodexJobs).catch((error) => {
    console.error("Initial image job processing failed:", error);
  });
  setInterval(() => {
    processPendingCodexJobs().catch((error) => {
      console.error("Image job processing failed:", error);
    });
  }, 3000);
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
    const job = await readCodexImageJob(jobPath);
    jobs.push({ fileName, jobPath, job });
  }

  for (const { jobPath, job } of sortImageJobsForProcessing(jobs)) {
    if (!shouldProcessCodexJob(job, jobPath)) continue;
    await processCodexImageJob(jobPath, job);
    break;
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
  return (
    job &&
    job.status === "pending_codex_image_generation" &&
    job.autoProcess === true &&
    Boolean(job.prompt) &&
    !processingJobs.has(jobPath)
  );
}

async function processCodexImageJob(jobPath, job) {
  processingJobs.add(jobPath);
  const imageModel = getConfiguredImageModel();
  const countrySlug = getRuntimeCountrySlugForJob(job);
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: job.pageId,
    imageModel,
    countrySlug
  });

  try {
    await mkdir(path.dirname(paths.imagePath), { recursive: true });
    await writeCodexImageJob(jobPath, {
      ...job,
      countrySlug,
      status: "processing_openai_image",
      imageModel,
      processingStartedAt: new Date().toISOString()
    });

    const generated = await generateConfiguredImage({
      model: imageModel,
      prompt: job.prompt
    });

    await writeFile(paths.imagePath, Buffer.from(generated.b64Json, "base64"));
    await writeFile(
      paths.metadataPath,
      JSON.stringify(
        {
          pageId: job.pageId,
          countrySlug,
          sceneId: job.sceneId,
          nodeId: job.nodeId,
          parentId: job.parentId,
          parentClick: job.parentClick,
          imageModel: generated.model,
          imageProvider: generated.provider ?? getConfiguredImageProvider(),
          size: generated.size,
          imageUrl: paths.imageUrl,
          environmentUrl: paths.environmentUrl,
          prompt: job.prompt,
          revisedPrompt: generated.revisedPrompt,
          cacheKind: "runtime",
          generatedAt: new Date().toISOString(),
          factBoundary: "Generated image is visual only and is not a fact source."
        },
        null,
        2
      )
    );

    const environmentPlan = await ensureEnvironmentPlanForPage({
      id: job.pageId,
      countrySlug,
      sceneId: job.sceneId,
      nodeId: job.nodeId,
      imageUrl: paths.imageUrl,
      status: "ready",
      plan: {
        title: job.title,
        pageType: job.pageType
      }
    }, paths);

    await writeCodexImageJob(jobPath, {
      ...job,
      countrySlug,
      status: "ready",
      imageUrl: paths.imageUrl,
      source: `${generated.provider ?? getConfiguredImageProvider()}-image-api`,
      imageProvider: generated.provider ?? getConfiguredImageProvider(),
      imageModel: generated.model,
      metadataUrl: paths.metadataUrl,
      environmentUrl: paths.environmentUrl,
      environmentStatus: environmentPlan?.status ?? "ready",
      cacheKind: "runtime",
      completedAt: new Date().toISOString()
    });
    await ensurePageUnderstanding({
      id: job.pageId,
      countrySlug,
      sceneId: job.sceneId,
      nodeId: job.nodeId,
      imageUrl: paths.imageUrl,
      status: "ready"
    });
  } catch (error) {
    await writeCodexImageJob(jobPath, {
      ...job,
      countrySlug,
      status: "failed",
      error: String(error?.message ?? error),
      failedAt: new Date().toISOString()
    });
  } finally {
    processingJobs.delete(jobPath);
  }
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

async function generateConfiguredImage({ model, prompt }) {
  return generateTileImageWithOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model,
    prompt,
    fallbackModel: appConfig.image.fallbackModel,
    size: appConfig.image.size
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

  const artwork = imageUrl
    ? { imageUrl }
    : getSceneArtwork(sceneId) ?? getSceneArtwork("singapore-overview");
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
      reason: "Current page image path is outside the WanderSG workspace and runtime cache."
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
  const pack = getCountryPack(countrySlug) ?? defaultCountryPack;
  const candidateText = getSceneCandidateText(sceneId, pack);
  const prompt = [
    "You are WanderSG's click resolver.",
    "A red crosshair with a white halo marks the user's click. Ignore the marker itself.",
    `Describe only the exact visual subject under or closest to the crosshair in this illustrated ${pack.title} atlas image.`,
    "If the clicked region contains or is closest to one of the known WanderSG candidate labels, return that exact candidate label.",
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
  if (candidateLabels.length === 0) return "Known WanderSG candidate labels: none.";
  return `Known WanderSG candidate labels for this page: ${candidateLabels.join(", ")}.`;
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
  response.writeHead(200, { "Content-Type": mimeTypes[ext] ?? "application/octet-stream" });
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
  return /^(?:[^/]+\/)?(?:image-jobs|codex-jobs|understanding|environment|starter-map|country-pack-draft)\//.test(relativePath);
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
