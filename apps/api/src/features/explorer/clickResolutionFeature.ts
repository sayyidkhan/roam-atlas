import { matchClickPhraseToNode } from "@roamatlas/domain/nodeMatcher.js";
import { resolveFlipbookClick } from "@roamatlas/domain/flipbookPage.js";
import type {
  ClickPhraseCandidate
} from "@roamatlas/domain/nodeMatcher.js";
import type {
  FlipbookAction,
  FlipbookPoint,
  FlipbookResult,
  ResolveFlipbookClickInput
} from "@roamatlas/domain/flipbookPage.js";
import type {
  CompiledCountryPack
} from "../../data/countryPacks/serverRegistry.ts";
import type {
  ArtworkCreationPage
} from "../artwork/artworkJobCreationService.ts";
import { RUNTIME_CACHE_URL_PREFIX } from "../../domain/runtimeCache.ts";
import { getCanonicalArtworkPageForGeneration } from "../../data/defaultArtworkPages.ts";
import { sceneArtwork } from "../../data/sceneArtwork.ts";
import {
  handleFlipbookClickHttpRequest,
  handleResolveClickHttpRequest
} from "./clickResolutionHttpHandler.ts";
import type {
  ExplorerClickResult,
  ExplorerResultPage
} from "./clickResolutionHttpTypes.ts";
import { createPageUnderstandingRepository } from "./pageUnderstandingRepository.ts";
import {
  appendSemanticRegion,
  centerOfBox,
  createBaseUnderstanding,
  createUnresolvedClickResult,
  selectSemanticRegionForPoint
} from "./semanticRegionPolicy.ts";
import type {
  SemanticPage
} from "./semanticRegionPolicy.ts";
import type {
  ClickPhraseRequest,
  ClickPhraseResult
} from "./openAIClickResolver.ts";

type ExplorerPage =
  ResolveFlipbookClickInput["currentPage"] &
  SemanticPage &
  Record<string, unknown>;

type ArtworkJobResult =
  Record<string, unknown> & {
    assetVersion?: string;
    environmentUrl?: string | null;
    generated?: Record<string, unknown>;
    imageUrl?: string | null;
    partialImageUrl?: string | null;
    status: string;
  };

type ClickResolutionFeatureDependencies = {
  createImageJob: (
    page: ArtworkCreationPage,
    options: {
      imageQuality: string;
    }
  ) => Promise<ArtworkJobResult>;
  defaultCountrySlug: string;
  getCountryPackForPage: (
    page: ExplorerPage
  ) => CompiledCountryPack;
  getCountrySlugForPage: (
    page: SemanticPage
  ) => string;
  imageModel: string;
  normalizeImageQuality: (
    imageQuality: unknown
  ) => string;
  outputFormat: string;
  resolveAssetVersionForPage: (
    page: SemanticPage
  ) => string | null | undefined;
  resolveClickPhrase: (
    request: ClickPhraseRequest
  ) => Promise<ClickPhraseResult>;
  runtimeCacheRoot: string;
};

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
}: ClickResolutionFeatureDependencies) {
  const repository = createPageUnderstandingRepository({
    cacheRoot: runtimeCacheRoot,
    imageModel,
    outputFormat,
    getCountrySlugForPage,
    resolveAssetVersionForPage
  });

  async function handleResolveClick(
    request: Request
  ): Promise<Response> {
    return handleResolveClickHttpRequest({
      request,
      defaultCountrySlug,
      resolveClickPhrase
    });
  }

  async function handleFlipbookClick(
    request: Request
  ): Promise<Response> {
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

  async function attachArtwork(
    page: ExplorerResultPage,
    pack: CompiledCountryPack,
    imageQuality?: string
  ): Promise<ExplorerResultPage> {
    if (!page.id) {
      throw new Error(
        "Artwork generation requires a stable page id."
      );
    }
    const canonicalPage =
      getCanonicalArtworkPageForGeneration(
        page,
        pack
      );
    const artworkPage = await createImageJob(
      {
        ...canonicalPage,
        id: canonicalPage.id
      } as ArtworkCreationPage,
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

  function resolveDeterministicClick({
    currentPage,
    normalizedClick
  }: {
    currentPage: ExplorerPage;
    normalizedClick: FlipbookPoint;
  }): FlipbookResult | null {
    const pack = getCountryPackForPage(currentPage);
    const scene = currentPage.sceneId
      ? pack.scenes[currentPage.sceneId]
      : undefined;
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

  async function resolveSemanticRegionHit({
    currentPage,
    normalizedClick
  }: {
    currentPage: ExplorerPage;
    normalizedClick: FlipbookPoint;
  }) {
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
  }: {
    currentPage: ExplorerPage;
    normalizedClick: FlipbookPoint;
    result: ExplorerClickResult;
    vlm: ClickPhraseResult;
  }): Promise<void> {
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

  async function ensurePageUnderstanding(
    page: SemanticPage
  ) {
    if (!hasRuntimeGeneratedPage(page)) return null;
    const existing = await repository.read(page);
    if (existing) return existing;
    const understanding = createUnderstanding(page);
    await repository.write(page, understanding);
    return understanding;
  }

  function createUnderstanding(
    page: SemanticPage
  ) {
    return createBaseUnderstanding(page, {
      countrySlug: getCountrySlugForPage(page),
      assetVersion: resolveAssetVersionForPage(page)
    });
  }

  function matchVlmPhraseForCurrentPage({
    currentPage,
    phrase
  }: {
    currentPage: ExplorerPage;
    phrase: string;
  }) {
    const pack = getCountryPackForPage(currentPage);
    const currentNode = currentPage.nodeId
      ? pack.nodes[currentPage.nodeId]
      : undefined;
    const scene = currentPage.sceneId
      ? pack.scenes[currentPage.sceneId]
      : undefined;
    const candidates: ClickPhraseCandidate[] = [];
    const seen = new Set<string>();

    for (const childId of currentNode?.childIds ?? []) {
      const child = pack.nodes[childId];
      if (!child || seen.has(childId)) continue;
      seen.add(childId);
      candidates.push({
        nodeId: childId,
        label: child.title,
        confidence: hasConfirmedFact(child.facts)
          ? "confirmed"
          : "general",
        action: actionForNode(childId, pack)
      });
    }
    const hotspots =
      scene &&
      currentNode &&
      scene.rootNodeId === currentNode.id
        ? scene.hotspots ?? []
        : [];
    for (const hotspot of hotspots) {
        const hotspotNodeId =
          typeof hotspot.nodeId === "string"
            ? hotspot.nodeId
            : null;
        if (
          !hotspotNodeId ||
          seen.has(hotspotNodeId)
        ) continue;
        seen.add(hotspotNodeId);
        candidates.push({
          action:
            hotspot.action as FlipbookAction | undefined,
          confidence:
            typeof hotspot.confidence === "string"
              ? hotspot.confidence
              : "general",
          label:
            typeof hotspot.label === "string"
              ? hotspot.label
              : undefined,
          nodeId: hotspotNodeId
        });
    }
    return matchClickPhraseToNode({
      phrase,
      candidates,
      nodes: pack.nodes
    });
  }

  return {
    handleResolveClick,
    handleFlipbookClick,
    ensurePageUnderstanding
  };
}

function hasRuntimeGeneratedPage(
  page: SemanticPage
): boolean {
  return String(page?.imageUrl ?? "").startsWith(RUNTIME_CACHE_URL_PREFIX);
}

function actionForNode(
  nodeId: string,
  pack: CompiledCountryPack
): FlipbookAction {
  const scene = Object.values(pack.scenes).find(
    (item) => item.rootNodeId === nodeId
  );
  return scene
    ? { type: "enter_scene", sceneId: scene.id }
    : { type: "open_node", nodeId };
}

function hasConfirmedFact(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (fact) =>
        Boolean(fact) &&
        typeof fact === "object" &&
        "confidence" in fact &&
        fact.confidence === "confirmed"
    )
  );
}
