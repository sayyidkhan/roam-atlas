import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const semanticHit = await resolveSemanticRegionHit({
    currentPage: body.currentPage,
    normalizedClick: body.imageClick?.normalizedImage ?? body.normalizedClick
  });
  if (semanticHit) {
    const semanticClick = semanticHit.cacheClick ?? centerOfBox(semanticHit.bbox) ?? body.normalizedClick;
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
  const localResult = resolveFlipbookClick({
    currentPage: body.currentPage,
    normalizedClick: body.normalizedClick,
    targetNodeId: body.targetNodeId,
    detourPhrase: body.detourPhrase,
    scenes: scrollScenes,
    nodes: atlasNodes,
    sceneArtwork
  });
  const shouldUseVlmMatch =
    vlmMatch?.status === "matched" &&
    (!isRuntimePage || vlmMatch.confidence === "confirmed");
  const shouldUseVlmDetour =
    !body.targetNodeId &&
    !body.detourPhrase &&
    (localResult.click.status === "unmapped" || isRuntimePage) &&
    !shouldUseVlmMatch &&
    hasReliableVlm;
  const result = shouldUseVlmMatch
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick: body.normalizedClick,
        targetNodeId: vlmMatch.nodeId,
        scenes: scrollScenes,
        nodes: atlasNodes,
        sceneArtwork
      })
    : shouldUseVlmDetour
    ? resolveFlipbookClick({
        currentPage: body.currentPage,
        normalizedClick: body.normalizedClick,
        detourPhrase: vlm.phrase,
        scenes: scrollScenes,
        nodes: atlasNodes,
        sceneArtwork
      })
    : !body.targetNodeId && !body.detourPhrase
    ? createUnresolvedClickResult({
        currentPage: body.currentPage,
        normalizedClick: body.normalizedClick,
        vlm
      })
    : localResult;

  await appendSemanticRegionFromResult({
    currentPage: body.currentPage,
    normalizedClick: body.imageClick?.normalizedImage ?? body.normalizedClick,
    result,
    vlm
  });

  result.vlm = {
    status: vlm.status,
    phrase: vlm.phrase ?? null,
    matchedNodeId: vlmMatch?.nodeId ?? null,
    confidence: vlm.confidence ?? null,
    reason: vlm.reason ?? null
  };

  if (result.page.status === "generation_required") {
    result.page = await createCodexImageJob(result.page);
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(result));
}

async function resolveSemanticRegionHit({ currentPage, normalizedClick }) {
  if (!hasRuntimeGeneratedPage(currentPage) || !normalizedClick) return null;

  const understanding = await readPageUnderstanding(currentPage);
  const region = understanding?.regions
    ?.filter((item) => pointInBox(normalizedClick, item.bbox))
    .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))[0];

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
    existing.bbox = mergeBoxes(existing.bbox, nextRegion.bbox);
    existing.phrase = existing.phrase || nextRegion.phrase;
    existing.cacheClick = existing.cacheClick ?? nextRegion.cacheClick;
    existing.updatedAt = nextRegion.updatedAt;
    existing.confidenceScore = Math.max(existing.confidenceScore ?? 0, nextRegion.confidenceScore);
  } else {
    understanding.regions.push(nextRegion);
  }

  await writePageUnderstanding(currentPage, understanding);
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
      resolution: process.env.WANDERSG_IMAGE_RESOLUTION ?? "2K",
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
  if (!artwork.imageUrl) {
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
    "Describe only the exact visual subject at the clicked pixel in this illustrated Singapore atlas image.",
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
              image_url: `data:image/png;base64,${imageBytes.toString("base64")}`,
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
      ...JSON.parse(text)
    };
  } catch {
    return {
      status: "resolved",
      phrase: text,
      confidence: "low",
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

async function serveStatic(pathname, response) {
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
  response.writeHead(200, {
    "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
    "Cache-Control": "private, max-age=31536000, immutable"
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
