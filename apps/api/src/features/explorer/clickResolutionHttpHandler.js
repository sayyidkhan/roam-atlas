import { jsonResponse } from "../../platform/http/fetchResponses.js";
import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";
import { readJsonRequest } from "../../platform/http/readJsonRequest.js";

export function createClickResolutionRoutes({
  handleResolveClick,
  handleFlipbookClick
}) {
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
}) {
  const body = await readJsonRequest(request);
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
}) {
  const body = await readJsonRequest(request);
  const pack = getCountryPackForPage(body.currentPage);
  const normalizedClick = body.imageClick?.normalizedImage ?? body.normalizedClick;
  const currentScene = pack.scenes[body.currentPage?.sceneId];
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
  const vlmMatch = hasReliableVlm
    ? matchVlmPhraseForCurrentPage({ currentPage: body.currentPage, phrase: vlm.phrase })
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
    : shouldUseVlmDetour
    ? resolvePageClick({
        body: { ...body, targetNodeId: null, detourPhrase: vlm.phrase },
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

function resolvePageClick({ body, pack, sceneArtwork, normalizedClick, resolveFlipbookClick }) {
  return resolveFlipbookClick({
    currentPage: body.currentPage,
    normalizedClick,
    targetNodeId: body.targetNodeId,
    detourPhrase: body.detourPhrase,
    scenes: pack.scenes,
    nodes: pack.nodes,
    sceneArtwork,
    countryName: pack.title
  });
}

async function attachArtworkIfRequired({ result, pack, imageQuality, attachArtwork }) {
  if (result.page.status === "generation_required") {
    result.page = await attachArtwork(result.page, pack, imageQuality);
  }
}
