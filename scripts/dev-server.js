import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

import { getSceneArtwork } from "../src/data/sceneArtwork.js";
import {
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "../src/data/defaultArtworkPages.js";
import { atlasNodes, scrollScenes } from "../src/data/sceneGraph.js";
import { sceneArtwork } from "../src/data/sceneArtwork.js";
import { resolveFlipbookClick } from "../src/domain/flipbookPage.js";
import {
  DEFAULT_FAL_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT,
  generateTileImageWithFal,
  generateTileImageWithOpenAI,
  normalizeFalImageModel,
  normalizeImageModel
} from "../src/domain/imageProvider.js";
import {
  shouldQueueDefaultArtwork,
  sortImageJobsForProcessing
} from "../src/domain/imageJobQueue.js";
import {
  RUNTIME_CACHE_URL_PREFIX,
  createRuntimeCachePaths,
  resolveRuntimeCacheRoot
} from "../src/domain/runtimeCache.js";
import { matchClickPhraseToNode } from "../src/domain/nodeMatcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadLocalEnv(path.join(root, ".env"));
const port = Number(process.env.PORT ?? "4173");
const runtimeCacheRoot = resolveRuntimeCacheRoot();
const imageJobsDir = path.join(runtimeCacheRoot, "image-jobs");
const processingJobs = new Set();

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
      scenes: scrollScenes,
      nodes: atlasNodes,
      sceneArtwork
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
        scenes: scrollScenes,
        nodes: atlasNodes,
        sceneArtwork
      })
    : shouldUseVlmMatch
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick,
        targetNodeId: vlmMatch.nodeId,
        scenes: scrollScenes,
        nodes: atlasNodes,
        sceneArtwork
      })
    : shouldUseVlmDetour
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick,
        detourPhrase: vlm.phrase,
        scenes: scrollScenes,
        nodes: atlasNodes,
        sceneArtwork
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
  const scene = scrollScenes[currentPage?.sceneId];
  if (!scene || scene.rootNodeId !== currentPage?.nodeId || !normalizedClick) {
    return null;
  }

  return resolveFlipbookClick({
    currentPage,
    normalizedClick,
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
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
  const matchedNodeId = result.click?.nodeId ?? null;
  const id = matchedNodeId ? `node-${matchedNodeId}` : `phrase-${slugify(phrase)}`;
  const existing = understanding.regions.find(
    (region) => region.id === id || (matchedNodeId && region.matchedNodeId === matchedNodeId)
  );
  const nextRegion = {
    id,
    phrase,
    label: matchedNodeId ? atlasNodes[matchedNodeId]?.title ?? phrase : phrase,
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
    imageModel: getConfiguredImageModel()
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
    imageModel: getConfiguredImageModel()
  });
  await mkdir(path.dirname(paths.understandingPath), { recursive: true });
  await writeFile(
    paths.understandingPath,
    `${JSON.stringify(
      {
        ...understanding,
        pageId: page.id,
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
  const currentNode = atlasNodes[currentPage?.nodeId];
  const scene = scrollScenes[currentPage?.sceneId];
  const candidates = [];
  const seen = new Set();

  for (const childId of currentNode?.childIds ?? []) {
    const child = atlasNodes[childId];
    if (!child || seen.has(childId)) continue;
    seen.add(childId);
    candidates.push({
      nodeId: childId,
      label: child.title,
      confidence: child.facts?.some((fact) => fact.confidence === "confirmed") ? "confirmed" : "general",
      action: actionForNode(childId)
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
    nodes: atlasNodes
  });
}

function hasRuntimeGeneratedPage(page) {
  return String(page?.imageUrl ?? "").startsWith(RUNTIME_CACHE_URL_PREFIX);
}

function actionForNode(nodeId) {
  const scene = Object.values(scrollScenes).find((item) => item.rootNodeId === nodeId);
  return scene
    ? { type: "enter_scene", sceneId: scene.id }
    : { type: "open_node", nodeId };
}

async function handleArtworkRequest(url, response) {
  const sceneId = url.searchParams.get("sceneId");
  const page = getDefaultArtworkPageForScene(sceneId, scrollScenes);
  if (!page) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: `Unknown artwork scene: ${sceneId}` }));
    return;
  }

  const artworkPage = await createCodexImageJob(page, { jobKind: "artwork" });
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ page: artworkPage }));
}

async function createCodexImageJob(page, { jobKind = "interactive" } = {}) {
  const imageModel = getConfiguredImageModel();
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: page.id,
    imageModel
  });
  const outputDir = path.dirname(paths.jobPath);
  const jobPath = paths.jobPath;
  const jobUrl = paths.jobUrl;

  await mkdir(outputDir, { recursive: true });
  const existingJob = await readCodexImageJob(jobPath);
  const prompt = page.plan?.imagePrompt;
  const existingMatchesRequest =
    existingJob?.prompt === prompt &&
    normalizeFalImageModel(existingJob?.imageModel ?? imageModel) === normalizeFalImageModel(imageModel);

  if (existingMatchesRequest && existingJob?.status === "ready" && existingJob.imageUrl) {
    await ensurePageUnderstanding({
      ...page,
      imageUrl: existingJob.imageUrl,
      status: "ready"
    });
    return {
      ...page,
      imageUrl: existingJob.imageUrl,
      status: "ready",
      generated: {
        source: existingJob.source ?? "image-cache",
        jobUrl,
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  const existingMetadata = await readRuntimeImageMetadata(paths.metadataPath);
  const existingMetadataMatchesRequest =
    existingMetadata?.prompt === prompt &&
    normalizeFalImageModel(existingMetadata?.imageModel ?? imageModel) === normalizeFalImageModel(imageModel) &&
    existingMetadata.imageUrl;
  if (existingMetadataMatchesRequest) {
    const readyJob = {
      pageId: page.id,
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
      imageUrl: existingMetadata.imageUrl,
      status: "ready",
      generated: {
        source: readyJob.source,
        jobUrl,
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
      status: "pending_codex_image_generation",
      generated: {
        source: "image-generation-required",
        jobUrl,
        reused: true,
        factBoundary: "Generated image is visual only and is not a fact source."
      }
    };
  }

  await writeFile(
    jobPath,
    JSON.stringify(
      {
        pageId: page.id,
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
      },
      null,
      2
    )
  );

  return {
    ...page,
    status: "pending_codex_image_generation",
    generated: {
      source: "image-generation-required",
      jobUrl,
      factBoundary: "Generated fallback art is visual only and is not a fact source."
    }
  };
}

async function writeCodexImageJob(jobPath, job) {
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
  for (const page of listDefaultArtworkPages(scrollScenes)) {
    await createCodexImageJob(page, { jobKind: "prewarm" });
  }
}

async function processPendingCodexJobs() {
  await mkdir(imageJobsDir, { recursive: true });
  const entries = await readdir(imageJobsDir);
  const jobFiles = entries
    .filter((entry) => entry.endsWith(".json"))
    .sort();
  const jobs = [];

  for (const fileName of jobFiles) {
    const jobPath = path.join(imageJobsDir, fileName);
    const job = await readCodexImageJob(jobPath);
    jobs.push({ fileName, jobPath, job });
  }

  for (const { jobPath, job } of sortImageJobsForProcessing(jobs)) {
    if (!shouldProcessCodexJob(job, jobPath)) continue;
    await processCodexImageJob(jobPath, job);
    break;
  }
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
  const paths = createRuntimeCachePaths({
    cacheRoot: runtimeCacheRoot,
    pageId: job.pageId,
    imageModel
  });

  try {
    await mkdir(path.dirname(paths.imagePath), { recursive: true });
    await writeCodexImageJob(jobPath, {
      ...job,
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
          sceneId: job.sceneId,
          nodeId: job.nodeId,
          parentId: job.parentId,
          parentClick: job.parentClick,
          imageModel: generated.model,
          imageProvider: generated.provider ?? getConfiguredImageProvider(),
          size: generated.size,
          imageUrl: paths.imageUrl,
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

    await writeCodexImageJob(jobPath, {
      ...job,
      status: "ready",
      imageUrl: paths.imageUrl,
      source: `${generated.provider ?? getConfiguredImageProvider()}-image-api`,
      imageProvider: generated.provider ?? getConfiguredImageProvider(),
      imageModel: generated.model,
      metadataUrl: paths.metadataUrl,
      cacheKind: "runtime",
      completedAt: new Date().toISOString()
    });
    await ensurePageUnderstanding({
      id: job.pageId,
      sceneId: job.sceneId,
      nodeId: job.nodeId,
      imageUrl: paths.imageUrl,
      status: "ready"
    });
  } catch (error) {
    await writeCodexImageJob(jobPath, {
      ...job,
      status: "failed",
      error: String(error?.message ?? error),
      failedAt: new Date().toISOString()
    });
  } finally {
    processingJobs.delete(jobPath);
  }
}

function getConfiguredImageModel() {
  if (getConfiguredImageProvider() === "fal") {
    return normalizeFalImageModel(process.env.WANDERSG_IMAGE_MODEL ?? DEFAULT_FAL_IMAGE_MODEL);
  }
  return normalizeImageModel(process.env.WANDERSG_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL);
}

function getConfiguredImageProvider() {
  const provider = process.env.WANDERSG_IMAGE_PROVIDER?.trim().toLowerCase();
  if (provider === "fal" || provider === "nano-banana" || provider === "nano-banana-2") {
    return "fal";
  }
  if (provider === "openai") return "openai";
  return "fal";
}

function hasConfiguredImageProvider() {
  return getConfiguredImageProvider() === "fal"
    ? Boolean(process.env.FAL_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

async function generateConfiguredImage({ model, prompt }) {
  if (getConfiguredImageProvider() === "fal") {
    return generateTileImageWithFal({
      apiKey: process.env.FAL_KEY,
      model,
      prompt,
      aspectRatio: process.env.WANDERSG_IMAGE_ASPECT_RATIO ?? "16:9",
      resolution: process.env.WANDERSG_IMAGE_RESOLUTION ?? "1K",
      systemPrompt: process.env.WANDERSG_IMAGE_SYSTEM_PROMPT ?? DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT
    });
  }

  return generateTileImageWithOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model,
    prompt,
    size: process.env.WANDERSG_IMAGE_SIZE ?? "1536x1024"
  });
}

async function resolveClickPhraseWithOpenAI({ sceneId, imageUrl, normalizedClick, imageClick, point }) {
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
        `The browser displayed this image with object-fit: cover; use the original-image pixel coordinate, not the viewport coordinate.`
      ].join("\n")
    : normalizedClick
    ? `Click coordinates normalized to the visible viewport: x=${normalizedClick.x}, y=${normalizedClick.y}.`
    : `Click coordinates in displayed image space: x=${point?.x}, y=${point?.y}.`;
  const candidateText = getSceneCandidateText(sceneId);
  const prompt = [
    "You are WanderSG's click resolver.",
    "A red crosshair with a white halo marks the user's click. Ignore the marker itself.",
    "Describe only the exact visual subject under or closest to the crosshair in this illustrated Singapore atlas image.",
    "If the clicked region contains or is closest to one of the known WanderSG candidate labels, return that exact candidate label.",
    "Be specific. If the user clicked an infinity pool, roof garden, animal, dome, bridge, beach, canopy, food stall, or building part, name that visual subject.",
    candidateText,
    "Do not make factual travel claims. Do not invent official names, opening hours, prices, routes, or live availability.",
    "Return JSON only with this shape:",
    '{"phrase":"short visual phrase","confidence":"low|medium|high","reason":"short reason"}',
    coordinateText,
    `Current scene id: ${sceneId}.`
  ].join("\n");

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.WANDERSG_VLM_MODEL ?? "gpt-4.1-mini",
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

function getSceneCandidateText(sceneId) {
  const scene = scrollScenes[sceneId];
  const rootNode = atlasNodes[scene?.rootNodeId];
  const candidateLabels = (rootNode?.childIds ?? [])
    .map((nodeId) => atlasNodes[nodeId]?.title)
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

  const safePath = pathname === "/" ? "/index.html" : pathname;
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

async function serveRuntimeCache(pathname, response) {
  const relativePath = decodeURIComponent(pathname.slice(RUNTIME_CACHE_URL_PREFIX.length + 1));
  const compatibleRelativePath = relativePath.startsWith("codex-jobs/")
    ? relativePath.replace(/^codex-jobs\//, "image-jobs/")
    : relativePath;
  const filePath = path.normalize(path.join(runtimeCacheRoot, compatibleRelativePath));
  if (!filePath.startsWith(runtimeCacheRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const file = await readFile(filePath);
  const ext = path.extname(filePath);
  const isMutableRuntimeJson =
    compatibleRelativePath.startsWith("image-jobs/") ||
    compatibleRelativePath.startsWith("codex-jobs/") ||
    compatibleRelativePath.startsWith("understanding/");
  response.writeHead(200, {
    "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
    "Cache-Control": isMutableRuntimeJson
      ? "no-store"
      : "private, max-age=31536000, immutable"
  });
  response.end(file);
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
