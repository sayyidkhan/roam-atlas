import { matchClickPhraseToNode } from "@roamatlas/domain/nodeMatcher.js";
import { resolveFlipbookClick } from "@roamatlas/domain/flipbookPage.js";
import { RUNTIME_CACHE_URL_PREFIX } from "../../domain/runtimeCache.js";
import { getCanonicalArtworkPageForGeneration } from "../../data/defaultArtworkPages.js";
import { sceneArtwork } from "../../data/sceneArtwork.js";
import {
  handleFlipbookClickHttpRequest,
  handleResolveClickHttpRequest
} from "./clickResolutionHttpHandler.js";
import { createPageUnderstandingRepository } from "./pageUnderstandingRepository.js";
import {
  appendSemanticRegion,
  centerOfBox,
  createBaseUnderstanding,
  createUnresolvedClickResult,
  selectSemanticRegionForPoint
} from "./semanticRegionPolicy.js";

export function createClickResolutionFeature({
  defaultCountrySlug,
  resolveClickPhrase,
  getCountryPackForPage,
  getCountrySlugForPage,
  resolveAssetVersionForPage,
  createImageJob,
  normalizeImageQuality,
  runtimeCacheRoot,
  imageModel,
  outputFormat
}) {
  const repository = createPageUnderstandingRepository({
    cacheRoot: runtimeCacheRoot,
    imageModel,
    outputFormat,
    getCountrySlugForPage,
    resolveAssetVersionForPage
  });

  async function handleResolveClick(request) {
    return handleResolveClickHttpRequest({
      request,
      defaultCountrySlug,
      resolveClickPhrase
    });
  }

  async function handleFlipbookClick(request) {
    return handleFlipbookClickHttpRequest({
      request,
      getCountryPackForPage,
      getCountrySlugForPage,
      sceneArtwork,
      hasRuntimeGeneratedPage,
      resolveDeterministicClick,
      resolveSemanticRegionHit,
      resolveClickPhrase,
      matchVlmPhraseForCurrentPage,
      resolveFlipbookClick,
      appendSemanticRegionFromResult,
      createUnresolvedClickResult,
      centerOfBox,
      attachArtwork
    });
  }

  async function attachArtwork(page, pack, imageQuality) {
    const artworkPage = await createImageJob(
      getCanonicalArtworkPageForGeneration(
        page,
        pack.scenes,
        pack.nodes,
        pack.countrySlug,
        pack.title
      ),
      { imageQuality: normalizeImageQuality(imageQuality) }
    );
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
    const understanding = await repository.read(currentPage);
    return selectSemanticRegionForPoint(
      understanding?.regions ?? [],
      normalizedClick
    );
  }

  async function appendSemanticRegionFromResult({
    currentPage,
    normalizedClick,
    result,
    vlm
  }) {
    if (!hasRuntimeGeneratedPage(currentPage) || !normalizedClick) return;
    const phrase = result.click?.phrase ?? vlm.phrase;
    if (!phrase || result.click?.resolver === "vlm_guard") return;
    const understanding =
      (await repository.read(currentPage)) ??
      createUnderstanding(currentPage);
    appendSemanticRegion(understanding, {
      normalizedClick,
      result,
      vlm,
      pack: getCountryPackForPage(currentPage)
    });
    await repository.write(currentPage, understanding);
  }

  async function ensurePageUnderstanding(page) {
    if (!hasRuntimeGeneratedPage(page)) return null;
    const existing = await repository.read(page);
    if (existing) return existing;
    const understanding = createUnderstanding(page);
    await repository.write(page, understanding);
    return understanding;
  }

  function createUnderstanding(page) {
    return createBaseUnderstanding(page, {
      countrySlug: getCountrySlugForPage(page),
      assetVersion: resolveAssetVersionForPage(page)
    });
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
        confidence: child.facts?.some(
          (fact) => fact.confidence === "confirmed"
        )
          ? "confirmed"
          : "general",
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
    return matchClickPhraseToNode({ phrase, candidates, nodes: pack.nodes });
  }

  return {
    handleResolveClick,
    handleFlipbookClick,
    ensurePageUnderstanding
  };
}

function hasRuntimeGeneratedPage(page) {
  return String(page?.imageUrl ?? "").startsWith(RUNTIME_CACHE_URL_PREFIX);
}

function actionForNode(nodeId, pack) {
  const scene = Object.values(pack.scenes).find(
    (item) => item.rootNodeId === nodeId
  );
  return scene
    ? { type: "enter_scene", sceneId: scene.id }
    : { type: "open_node", nodeId };
}
