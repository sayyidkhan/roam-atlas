import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const startIndex = appSource.indexOf(start);
  const endIndex = appSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return appSource.slice(startIndex, endIndex);
}

test("visible artwork is interactive while speculative generation is narrowly bounded", () => {
  const sceneRequest = sourceBetween("async function requestSceneArtwork", "async function requestCurrentPageArtwork");
  const pageRequest = sourceBetween("async function requestCurrentPageArtwork", "async function pollArtworkJob");
  const prefetch = sourceBetween("function prefetchNextDestinations", "function resetPrefetchForSceneChange");

  assert.match(sceneRequest, /jobKind = "interactive"/);
  assert.match(sceneRequest, /params\.set\("priority", "interactive"\)/);
  assert.match(pageRequest, /params\.set\("priority", "interactive"\)/);
  assert.match(appSource, /state\.experienceConfig\.prefetchDestinationLimit/);
  assert.match(appSource, /state\.experienceConfig\.maxParallelImageJobs/);
  assert.match(prefetch, /limit: getPrefetchDestinationLimit\(\)/);
  assert.match(appSource, /state\.prefetchJobs\.has\(target\.key\)/);
  assert.match(appSource, /hasArtwork \? 3 \/ 2 : spaceAspect/);
  assert.match(styleSource, /var\(--scene-display-aspect, 1\.5\)/);
});

test("current artwork polling copies server state and has terminal cleanup", () => {
  const scenePoll = sourceBetween("async function pollArtworkJob", "async function pollCurrentPageArtworkJob");
  const pagePoll = sourceBetween("async function pollCurrentPageArtworkJob", "function startArtworkPoller");

  assert.match(scenePoll, /copyArtworkJobStatus\(sceneId, job, page\)/);
  assert.match(pagePoll, /copyArtworkJobStatus\(artworkJobKey, job, artworkPage\)/);
  assert.match(appSource, /ARTWORK_POLL_TIMEOUT_MS/);
  assert.match(appSource, /ARTWORK_REQUEST_TIMEOUT_MS/);
  assert.match(appSource, /ARTWORK_POLL_MAX_ATTEMPTS/);
  assert.match(appSource, /window\.clearInterval\(current\.intervalId\)/);
  assert.match(appSource, /markArtworkJobFailed/);
  assert.match(appSource, /function retryArtwork/);
  assert.match(appSource, /function fetchArtworkResource/);
  assert.match(appSource, /data-artwork-retry/);
  assert.match(appSource, /function getArtworkFailureMessage/);
  assert.match(appSource, /The factual page remains available/);
  assert.doesNotMatch(appSource, /escapeHtml\(job\.error \?\?/);
  assert.match(scenePoll, /job\.status === "ready" && !job\.imageUrl/);
  assert.match(pagePoll, /job\.status === "ready" && !job\.imageUrl/);
  assert.match(appSource, /isCurrentArtworkAttempt/);
  assert.match(appSource, /attemptId: \+\+artworkAttemptSequence|const attemptId = \+\+artworkAttemptSequence/);
  assert.match(scenePoll, /didChange && isArtworkJobVisible\(sceneId\)/);
  assert.match(pagePoll, /didChange && isArtworkJobVisible\(artworkJobKey\)/);
});

test("stale navigation and prefetch responses are invalidated", () => {
  const clickResolver = sourceBetween("async function resolveClickAt", "function buildImmediatePageFromClick");
  const overlayResolver = sourceBetween("async function resolveOverlayTarget", "function buildImmediatePageFromTarget");
  const prefetch = sourceBetween("function prefetchArtworkTarget", "async function storeArtworkCache");

  assert.match(clickResolver, /isNavigationRequestCurrent\(navigationRequest\.id\)/);
  assert.match(clickResolver, /finishNavigationRequest\(navigationRequest\.id\)/);
  assert.match(overlayResolver, /isNavigationRequestCurrent\(navigationRequest\.id\)/);
  assert.match(overlayResolver, /finishNavigationRequest\(navigationRequest\.id\)/);
  assert.match(appSource, /navigationAbortController\?\.abort\(\)/);
  assert.match(appSource, /prefetchEpoch \+= 1/);
  assert.match(prefetch, /isCurrentPrefetchRequest\(requestEpoch, requestSceneId\)/);
  assert.match(appSource, /stopPrefetchPoller\(target\.key, requestEpoch\)/);
});

test("runtime cache flush clears every in-memory artwork tier", () => {
  const clearCache = sourceBetween("function clearCountryGeneratedState", "function enterMappedCountry");
  const clearPrefetch = sourceBetween("function invalidatePrefetchState", "function isArtworkTargetReady");
  assert.match(clearCache, /state\.artworkJobs\.clear\(\)/);
  assert.match(clearCache, /state\.artworkByScene\.clear\(\)/);
  assert.match(clearCache, /state\.artworkByPage\.clear\(\)/);
  assert.match(clearCache, /state\.artworkImageLoads\.clear\(\)/);
  assert.match(clearCache, /invalidatePrefetchState\(\)/);
  assert.match(clearCache, /environmentPlanEpoch \+= 1/);
  assert.match(clearPrefetch, /state\.prefetchJobs\.clear\(\)/);
});

test("pending destinations open before their background artwork poll starts", () => {
  const pendingFlow = sourceBetween("function renderImageGenerationPending", "function getArtworkJobKeyForPage");
  const enterIndex = pendingFlow.indexOf("enterReadyPage(pendingPage)");
  const pollIndex = pendingFlow.indexOf("startArtworkPoller");

  assert.ok(enterIndex >= 0, "pending page should enter immediately");
  assert.ok(pollIndex > enterIndex, "background polling should start after the page is entered");
  assert.doesNotMatch(pendingFlow, /viewport\.classList\.add\("is-busy"\)/);
  assert.doesNotMatch(pendingFlow, /state\.pendingJob\s*=/);
});

test("artwork becomes ready only after browser preload and decode", () => {
  const preload = sourceBetween("function preloadArtworkImage", "function renderEnvironmentLayerNodes");
  const sceneCompletion = sourceBetween("async function completeSceneArtwork", "async function completeCurrentPageArtwork");
  const pageCompletion = sourceBetween("async function completeCurrentPageArtwork", "async function preparePartialArtwork");

  assert.match(preload, /new Image\(\)/);
  assert.match(preload, /await image\.decode\(\)/);
  assert.match(sceneCompletion, /await preloadArtworkImage\(imageUrl\)/);
  assert.match(pageCompletion, /await preloadArtworkImage\(imageUrl\)/);
  assert.match(sceneCompletion, /getPageEnvironmentUrl\(\{ \.\.\.page, \.\.\.imageResult \}\)/);
  assert.match(pageCompletion, /getPageEnvironmentUrl\(\{ \.\.\.targetPage, \.\.\.imageResult \}\)/);
  assert.match(appSource, /decodedPartialImageUrl/);
  assert.match(appSource, /partialImageUrl/);
  assert.match(appSource, /getContainedImageRect\(image\)/);
  assert.match(styleSource, /\.scene-canvas \.scene-image--preview/);
  assert.match(styleSource, /\.scroll-stage--placeholder\.has-artwork-preview \.scene-canvas/);
});

test("responsive image overlays use the rendered artwork bounds", () => {
  const sceneRender = sourceBetween("function renderScene", "function applySceneLayout");
  const overlayLayout = sourceBetween("function renderSceneImageOverlayFrame", "function toScenePercent");
  const targetRender = sourceBetween("function renderImageTargetHotspots", "function normalizeEnvironmentPlanBounds");

  assert.match(sceneRender, /renderSceneImageOverlayFrame/);
  assert.match(sceneRender, /renderEnvironmentLayerNodes/);
  assert.match(sceneRender, /renderImageTargetHotspots/);
  assert.match(sceneRender, /observeSceneImageOverlayLayout\(canvas\)/);
  assert.match(overlayLayout, /new ResizeObserver\(scheduleSceneImageOverlayLayout\)/);
  assert.match(overlayLayout, /getContainedImageRect\(image\)/);
  assert.match(overlayLayout, /imageRect\.left - canvasRect\.left/);
  assert.match(overlayLayout, /imageRect\.width \/ canvasRect\.width/);
  assert.match(appSource, /window\.addEventListener\("resize", scheduleSceneImageOverlayLayout\)/);
  assert.match(styleSource, /\.scene-image-overlay-frame\s*\{[^}]*position: absolute;[^}]*pointer-events: none;/s);
  assert.match(styleSource, /\.image-target-hotspot\s*\{[^}]*pointer-events: auto;/s);
  assert.match(styleSource, /\.image-target-hotspot\s*\{[^}]*box-shadow: inset 0 0 0 2px rgba\(36, 95, 82, 0\.22\);/s);
  assert.match(styleSource, /\.image-target-hotspot\.is-active\s*\{/);
  assert.match(targetRender, /target\.visualBounds/);
  assert.match(targetRender, /target\.labelBounds/);
  assert.match(targetRender, /image-target-hotspot--\$\{mode\}/);
  assert.match(targetRender, /target\.nodeId === state\.selectedNodeId/);
  assert.match(styleSource, /\.image-target-hotspot--label\s*\{[^}]*display: none;[^}]*pointer-events: none;/s);
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.image-target-hotspot--visual\s*\{[^}]*display: none;[^}]*pointer-events: none;/s);
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.image-target-hotspot--label\s*\{[^}]*display: block;[^}]*pointer-events: auto;/s);
});

test("missing artwork keeps an accessible, honest, low-motion blueprint", () => {
  assert.match(appSource, /setAttribute\("aria-busy", isArtworkPending \? "true" : "false"\)/);
  assert.match(appSource, /loading-scene-progress--indeterminate/);
  assert.match(appSource, /loading-panel-progress--indeterminate/);
  assert.match(appSource, /captureExplorerFocusKey/);
  assert.match(appSource, /dataset\.roamFocusKey/);
  assert.match(styleSource, /\.scroll-stage--placeholder \.tile-art\s*\{[^}]*opacity: 0\.28/s);
  assert.match(styleSource, /\.artwork-retry-button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px/s);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
});

test("environment enhancement retries pending responses without gating artwork", () => {
  const environmentRequest = sourceBetween("async function requestEnvironmentPlan", "function normalizeEnvironmentPlan");
  const environmentLookup = sourceBetween("function getSceneEnvironmentUrl", "function getPageEnvironmentUrl");

  assert.match(appSource, /ENVIRONMENT_PLAN_RETRY_DELAYS_MS/);
  assert.match(environmentRequest, /response\.status === 202/);
  assert.match(environmentRequest, /response\.status === 404/);
  assert.match(environmentRequest, /\["pending", "queued", "processing"\]/);
  assert.match(environmentRequest, /return null/);
  assert.match(appSource, /status === "deferred"/);
  assert.doesNotMatch(environmentLookup, /getPageEnvironmentUrl\(state\.currentPage\) \?\?/);
  assert.match(environmentLookup, /isSameArtworkUrl\(imageUrl, sceneArtwork\?\.imageUrl\)/);
  assert.match(appSource, /new URL\(imageUrl, window\.location\.origin\)\.pathname/);
});

test("opening prefetched child artwork promotes its exact child target plan", () => {
  const sceneRender = sourceBetween("function renderScene", "function applySceneLayout");
  const promotion = sourceBetween(
    "async function promoteCurrentPageEnvironmentPlan",
    "function applyCurrentPageEnvironmentReference"
  );
  const environmentReference = sourceBetween(
    "function applyCurrentPageEnvironmentReference",
    "async function fetchEnvironmentPlanWithRetry"
  );

  assert.match(sceneRender, /pageNode\?\.childIds\?\.length/);
  assert.match(sceneRender, /promoteCurrentPageEnvironmentPlan\(imageUrl\)/);
  assert.match(promotion, /currentNode\?\.childIds\?\.length > 0/);
  assert.match(promotion, /nodeId: requestPage\.nodeId/);
  assert.match(promotion, /priority: "interactive"/);
  assert.match(promotion, /state\.currentPage\?\.nodeId !== expectedNodeId/);
  assert.match(promotion, /requestEnvironmentPlan\(environmentUrl\)/);
  assert.match(environmentReference, /state\.artworkByPage/);
  assert.match(environmentReference, /environmentStatus/);
  assert.doesNotMatch(promotion, /imageUrl:\s*null/);
});

test("VLM mappings provide responsive visual and label targets without giant boxes", () => {
  const environmentRequest = sourceBetween(
    "async function requestEnvironmentPlan",
    "async function promoteCurrentPageEnvironmentPlan"
  );
  const environmentNormalization = sourceBetween(
    "function normalizeEnvironmentPlan",
    "function renderMapHotspotLabels"
  );

  assert.match(appSource, /ENVIRONMENT_PLAN_SCHEMA_VERSION = "environment-plan-v4"/);
  assert.match(appSource, /ENVIRONMENT_PLAN_PROMPT_VERSION = "environment-plan-v7"/);
  assert.match(environmentRequest, /!isCurrentEnvironmentPlan\(plan\)/);
  assert.match(
    environmentRequest,
    /promoteCurrentPageEnvironmentPlan\(state\.currentPage\?\.imageUrl \?\? environmentUrl\)/
  );
  assert.match(environmentNormalization, /visualBounds: normalizeEnvironmentPlanBounds/);
  assert.match(environmentNormalization, /labelBounds: normalizeEnvironmentPlanBounds/);
  assert.match(environmentNormalization, /maxWidth: 0\.48/);
  assert.match(environmentNormalization, /maxHeight: 0\.52/);
  assert.match(environmentNormalization, /maxWidth: 0\.24/);
  assert.match(environmentNormalization, /maxHeight: 0\.12/);
  assert.match(environmentNormalization, /centerX - width \/ 2/);
});

test("empty fallback target maps recover instead of disabling every selection box", () => {
  const sceneRender = sourceBetween("function renderScene", "function applySceneLayout");
  const environmentRequest = sourceBetween(
    "async function requestEnvironmentPlan",
    "async function promoteCurrentPageEnvironmentPlan"
  );
  const planRecovery = sourceBetween(
    "function isCurrentEnvironmentPlan",
    "function renderImageTargetHotspots"
  );

  assert.match(sceneRender, /environmentPlanNeedsTargetRecovery\(environmentPlan\)/);
  assert.match(environmentRequest, /environmentPlanNeedsTargetRecovery\(cachedPlan\)/);
  assert.match(environmentRequest, /environmentPlanNeedsTargetRecovery\(normalizedPlan\)/);
  assert.match(environmentRequest, /Environment plan has no destination targets/);
  assert.match(planRecovery, /plan\.targets\.length > 0/);
  assert.match(planRecovery, /node\?\.childIds\?\.length/);
});

test("image quality selection is accessible, persistent, and reaches artwork requests", () => {
  const qualitySetting = sourceBetween(
    "function renderImageQualitySetting",
    "function normalizeImageQuality"
  );
  const sceneRequest = sourceBetween(
    "async function requestSceneArtwork",
    "async function requestCurrentPageArtwork"
  );
  const pageRequest = sourceBetween(
    "async function requestCurrentPageArtwork",
    "async function pollArtworkJob"
  );
  const prefetchRequest = sourceBetween(
    "function prefetchArtworkTarget",
    "async function storeArtworkCache"
  );

  assert.match(appSource, /IMAGE_QUALITY_STORAGE_KEY/);
  assert.match(appSource, /value: "low"/);
  assert.match(appSource, /value: "medium"/);
  assert.match(appSource, /value: "high"[\s\S]*recommended: true/);
  assert.match(qualitySetting, /role="radiogroup"/);
  assert.match(qualitySetting, /role="radio"/);
  assert.match(qualitySetting, /aria-checked/);
  assert.match(sceneRequest, /quality: state\.imageQuality/);
  assert.match(pageRequest, /quality: state\.imageQuality/);
  assert.match(prefetchRequest, /quality: state\.imageQuality/);
  assert.match(appSource, /imageQuality: state\.imageQuality/);
  assert.match(appSource, /localStorage\.setItem\(IMAGE_QUALITY_STORAGE_KEY/);
  assert.match(styleSource, /\.image-quality-option\.is-active/);
});

test("the artwork poll budget covers high-quality provider generation", () => {
  assert.match(appSource, /ARTWORK_POLL_TIMEOUT_MS = 10 \* 60 \* 1000/);
});
