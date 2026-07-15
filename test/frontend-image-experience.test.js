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
  assert.match(environmentLookup, /imageUrl === sceneArtwork\?\.imageUrl/);
});
