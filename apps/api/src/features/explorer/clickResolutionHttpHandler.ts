import type {
  FlipbookPoint,
  FlipbookResult,
  ResolveFlipbookClickInput
} from "@roamatlas/domain/flipbookPage.js";
import type { CompiledCountryPack } from "../../data/countryPacks/serverRegistry.ts";
import { jsonResponse } from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import { readJsonRequest } from "../../platform/http/readJsonRequest.ts";
import type {
  ClickResolutionRouteDependencies,
  ExplorerClickResult,
  FlipbookClickBody,
  FlipbookClickHttpDependencies,
  ResolveClickHttpDependencies
} from "./clickResolutionHttpTypes.ts";
import {
  parseFlipbookClickBody,
  parseResolveClickBody
} from "./clickResolutionRequestParser.ts";

export function createClickResolutionRoutes({
  handleResolveClick,
  handleFlipbookClick
}: ClickResolutionRouteDependencies): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(app, "POST", "/api/resolve-click", (context) =>
      handleResolveClick(context.req.raw)
    );
    registerHonoRoute(app, "POST", "/api/flipbook/click", (context) =>
      handleFlipbookClick(context.req.raw)
    );
  };
}

/**
 * Feature-owned HTTP orchestration for explorer clicks.
 *
 * Runtime cache, image generation, and provider access are injected so this
 * module can enforce the click-resolution policy without depending on the
 * legacy Node server. A VLM may describe a click, but only a curated node
 * matcher can turn that description into confirmed navigation.
 */
export async function handleResolveClickHttpRequest({
  request,
  defaultCountrySlug,
  resolveClickPhrase
}: ResolveClickHttpDependencies): Promise<Response> {
  const body = parseResolveClickBody(
    await readJsonRequest(request)
  );
  const result = await resolveClickPhrase({
    sceneId: body.sceneId,
    countrySlug: body.countrySlug ?? defaultCountrySlug,
    imageUrl: body.imageUrl,
    normalizedClick: body.normalizedClick,
    point: body.point
  });

  return jsonResponse(
    result,
    result.status === "vlm_error" ? 502 : 200
  );
}

export async function handleFlipbookClickHttpRequest({
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
}: FlipbookClickHttpDependencies): Promise<Response> {
  const body = parseFlipbookClickBody(
    await readJsonRequest(request)
  );
  const pack = getCountryPackForPage(body.currentPage);
  const normalizedClick = body.imageClick?.normalizedImage ?? body.normalizedClick;
  const currentScene = body.currentPage.sceneId
    ? pack.scenes[body.currentPage.sceneId]
    : undefined;
  const isGeneratedOverview =
    currentScene?.pageType === "homepage_overview" && hasRuntimeGeneratedPage(body.currentPage);
  const hasExplicitIntent = Boolean(body.targetNodeId || body.detourPhrase);
  const localResult = !hasExplicitIntent
    ? resolveDeterministicClick({
        currentPage: body.currentPage,
        normalizedClick
      })
    : null;
  const semanticHit = !isGeneratedOverview && !hasExplicitIntent
    ? await resolveSemanticRegionHit({
        currentPage: body.currentPage,
        normalizedClick
      })
    : null;

  if (hasExplicitIntent) {
    const result = resolvePageClick({
      body,
      pack,
      sceneArtwork,
      normalizedClick,
      resolveFlipbookClick
    });
    await attachArtworkIfRequired({ result, pack, imageQuality: body.imageQuality, attachArtwork });
    return jsonResponse(result);
  }

  if (semanticHit) {
    const semanticClick = semanticHit.cacheClick ?? centerOfBox(semanticHit.bbox) ?? normalizedClick;
    const result = resolvePageClick({
      body: { ...body, targetNodeId: semanticHit.matchedNodeId, detourPhrase: semanticHit.matchedNodeId ? null : semanticHit.phrase },
      pack,
      sceneArtwork,
      normalizedClick: semanticClick,
      resolveFlipbookClick
    });
    result.semanticCache = semanticHit;
    await attachArtworkIfRequired({ result, pack, imageQuality: body.imageQuality, attachArtwork });
    return jsonResponse(result);
  }

  const vlm = await resolveClickPhrase({
    sceneId: body.currentPage?.sceneId,
    countrySlug: getCountrySlugForPage(body.currentPage),
    imageUrl: body.currentPage?.imageUrl,
    normalizedClick: body.normalizedClick,
    imageClick: body.imageClick
  });
  const isRuntimePage = hasRuntimeGeneratedPage(body.currentPage);
  const hasReliableVlm =
    vlm.status === "resolved" &&
    (vlm.confidence === "high" || vlm.confidence === "medium") &&
    Boolean(vlm.phrase);
  const reliablePhrase =
    hasReliableVlm && vlm.phrase
      ? vlm.phrase
      : null;
  const vlmMatch = reliablePhrase
    ? matchVlmPhraseForCurrentPage({
        currentPage: body.currentPage,
        phrase: reliablePhrase
      })
    : null;
  const shouldUseVlmMatch =
    vlmMatch?.status === "matched" &&
    (!isRuntimePage || vlmMatch.confidence === "confirmed");
  const shouldUseVlmDetour = !shouldUseVlmMatch && hasReliableVlm;
  const shouldUseLocalFallback =
    !body.currentPage?.imageUrl &&
    localResult?.click?.status === "matched" &&
    (!hasReliableVlm || vlmMatch?.nodeId !== localResult.click.nodeId);
  const result = shouldUseVlmMatch
    ? resolvePageClick({
        body: { ...body, targetNodeId: vlmMatch.nodeId, detourPhrase: null },
        pack,
        sceneArtwork,
        normalizedClick,
        resolveFlipbookClick
      })
    : shouldUseVlmDetour && reliablePhrase
    ? resolvePageClick({
        body: {
          ...body,
          targetNodeId: null,
          detourPhrase: reliablePhrase
        },
        pack,
        sceneArtwork,
        normalizedClick,
        resolveFlipbookClick
      })
    : shouldUseLocalFallback
    ? localResult
    : createUnresolvedClickResult({
        currentPage: body.currentPage,
        normalizedClick,
        vlm
      });

  // Regenerated overview illustrations may move regions, so only deeper
  // runtime pages may reuse semantic-coordinate observations.
  if (!isGeneratedOverview) {
    await appendSemanticRegionFromResult({
      currentPage: body.currentPage,
      normalizedClick,
      result,
      vlm
    });
  }

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
  await attachArtworkIfRequired({ result, pack, imageQuality: body.imageQuality, attachArtwork });
  return jsonResponse(result);
}

function resolvePageClick({
  body,
  pack,
  sceneArtwork,
  normalizedClick,
  resolveFlipbookClick
}: {
  body: FlipbookClickBody;
  normalizedClick: FlipbookPoint;
  pack: CompiledCountryPack;
  resolveFlipbookClick: (
    input: ResolveFlipbookClickInput
  ) => FlipbookResult;
  sceneArtwork: ResolveFlipbookClickInput["sceneArtwork"];
}): ExplorerClickResult {
  return resolveFlipbookClick({
    currentPage: body.currentPage,
    normalizedClick,
    targetNodeId: body.targetNodeId,
    detourPhrase: body.detourPhrase,
    scenes:
      pack.scenes as unknown as ResolveFlipbookClickInput["scenes"],
    nodes:
      pack.nodes as unknown as ResolveFlipbookClickInput["nodes"],
    sceneArtwork,
    countryName: pack.title
  });
}

async function attachArtworkIfRequired({
  result,
  pack,
  imageQuality,
  attachArtwork
}: {
  attachArtwork: FlipbookClickHttpDependencies["attachArtwork"];
  imageQuality?: string;
  pack: CompiledCountryPack;
  result: ExplorerClickResult;
}): Promise<void> {
  if (result.page.status === "generation_required") {
    result.page = await attachArtwork(result.page, pack, imageQuality);
  }
}
