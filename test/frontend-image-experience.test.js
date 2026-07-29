import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { APP_CONFIG } from "../apps/web/src/config/appConfig.ts";
import { readFrontendRuntimeSource } from "./support/frontend-runtime-source.js";
import { readFrontendStylesSource } from "./support/frontend-styles-source.js";

const appSource = readFrontendRuntimeSource();
const styleSource = readFrontendStylesSource();
const explorerClientSource = readFileSync(
  new URL("../apps/web/src/features/explorer/explorerClient.ts", import.meta.url),
  "utf8"
);
const countrySetupViewSource = readFileSync(
  new URL("../apps/web/src/features/countrySetup/CountrySetupSurface.tsx", import.meta.url),
  "utf8"
);
const imageQualityPreferenceSource = readFileSync(
  new URL(
    "../apps/web/src/features/experience/imageQualityPreference.ts",
    import.meta.url
  ),
  "utf8"
);
const environmentLayerSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/ExplorerEnvironmentLayers.tsx",
    import.meta.url
  ),
  "utf8"
);
const destinationNavigationSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/ExplorerDestinationNavigation.tsx",
    import.meta.url
  ),
  "utf8"
);
const artworkJobPolicySource = readFileSync(
  new URL("../apps/web/src/features/artwork/artworkJobPolicy.ts", import.meta.url),
  "utf8"
);
const artworkPrefetchPolicySource = readFileSync(
  new URL(
    "../apps/web/src/features/artwork/artworkPrefetchPolicy.ts",
    import.meta.url
  ),
  "utf8"
);
const artworkPrefetchJobSource = readFileSync(
  new URL(
    "../apps/web/src/features/artwork/artworkPrefetchJobController.ts",
    import.meta.url
  ),
  "utf8"
);
const artworkPrefetchControllerSource = readFileSync(
  new URL(
    "../apps/web/src/features/artwork/artworkPrefetchController.ts",
    import.meta.url
  ),
  "utf8"
);
const sceneGeometrySource = readFileSync(
  new URL("../apps/web/src/features/explorer/sceneGeometry.ts", import.meta.url),
  "utf8"
);
const environmentPlanPolicySource = readFileSync(
  new URL("../apps/web/src/features/explorer/environmentPlanPolicy.ts", import.meta.url),
  "utf8"
);
const explorerEnvironmentSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/explorerEnvironmentController.ts",
    import.meta.url
  ),
  "utf8"
);
const explorerEnvironmentPromotionSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/explorerEnvironmentPromotionController.ts",
    import.meta.url
  ),
  "utf8"
);
const explorerNavigationSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/explorerNavigationController.ts",
    import.meta.url
  ),
  "utf8"
);
const explorerSceneStageSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/ExplorerSceneStage.tsx",
    import.meta.url
  ),
  "utf8"
);
const explorerScenePolicySource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/explorerScenePolicy.ts",
    import.meta.url
  ),
  "utf8"
);

function sourceBetween(start, end) {
  return sourceBetweenIn(appSource, start, end);
}

function sourceBetweenIn(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("visible artwork is interactive while speculative generation is narrowly bounded", () => {
  const sceneRequest = sourceBetween("async function requestSceneArtwork", "async function requestCurrentPageArtwork");
  const pageRequest = sourceBetween("async function requestCurrentPageArtwork", "async function pollArtworkJob");
  const prefetch = sourceBetweenIn(
    artworkPrefetchControllerSource,
    "function getCurrentPrefetchTargets",
    "function mergeCachedArtwork"
  );

  assert.match(sceneRequest, /jobKind = "interactive"/);
  assert.match(sceneRequest, /params\.set\("priority", "interactive"\)/);
  assert.match(pageRequest, /params\.set\("priority", "interactive"\)/);
  assert.match(artworkPrefetchPolicySource, /config\.prefetchDestinationLimit/);
  assert.match(artworkPrefetchPolicySource, /config\.maxParallelImageJobs/);
  assert.match(
    prefetch,
    /limit: getPrefetchDestinationLimit\(\s*state\.experienceConfig\s*\)/s
  );
  assert.match(appSource, /state\.prefetchJobs\.has\(target\.key\)/);
  assert.match(
    explorerSceneStageSource,
    /imageAspect \?\? 3 \/ 2/
  );
  assert.match(styleSource, /var\(--scene-display-aspect, 1\.5\)/);
});

test("current artwork polling copies server state and has terminal cleanup", () => {
  const scenePoll = sourceBetween("async function pollArtworkJob", "async function pollCurrentPageArtworkJob");
  const pagePoll = sourceBetween("async function pollCurrentPageArtworkJob", "function startArtworkPoller");

  assert.match(
    scenePoll,
    /copyArtworkJobStatus\(\s*sceneId,\s*job,\s*page\s*\)/
  );
  assert.match(
    pagePoll,
    /copyArtworkJobStatus\(\s*artworkJobKey,\s*job,\s*artworkPage\s*\)/
  );
  assert.match(appSource, /ARTWORK_POLL_TIMEOUT_MS/);
  assert.match(appSource, /ARTWORK_POLL_MAX_ATTEMPTS/);
  assert.match(appSource, /window\.clearInterval\(current\.intervalId\)/);
  assert.match(appSource, /markArtworkJobFailed/);
  assert.match(appSource, /function retryArtwork/);
  assert.match(appSource, /function fetchArtworkResource/);
  assert.match(destinationNavigationSource, /Retry illustration/);
  assert.match(
    destinationNavigationSource,
    /snapshot\.commands\.retryArtwork/
  );
  assert.match(artworkJobPolicySource, /function getArtworkFailureMessage/);
  assert.match(artworkJobPolicySource, /The factual page remains available/);
  assert.doesNotMatch(appSource, /escapeHtml\(job\.error \?\?/);
  assert.match(scenePoll, /job\.status === "ready" && !job\.imageUrl/);
  assert.match(pagePoll, /job\.status === "ready" && !job\.imageUrl/);
  assert.match(appSource, /isCurrentArtworkAttempt/);
  assert.match(
    appSource,
    /const nextAttemptId[\s\S]*\+\+artworkAttemptSequence/
  );
  assert.match(appSource, /const attemptId = nextAttemptId\(\)/);
  assert.match(scenePoll, /didChange && isArtworkJobVisible\(sceneId\)/);
  assert.match(pagePoll, /didChange && isArtworkJobVisible\(artworkJobKey\)/);
});

test("stale navigation and prefetch responses are invalidated", () => {
  const clickResolver = sourceBetweenIn(
    explorerNavigationSource,
    "async function resolveClickAt",
    "async function resolveOverlayTarget"
  );
  const overlayResolver = sourceBetweenIn(
    explorerNavigationSource,
    "async function resolveOverlayTarget",
    "function beginNavigationFeedback"
  );
  const prefetch = sourceBetweenIn(
    artworkPrefetchJobSource,
    "function prefetchArtworkTarget",
    "function pollPrefetchJob"
  );

  assert.match(clickResolver, /isNavigationRequestCurrent\(navigationRequest\.id\)/);
  assert.match(clickResolver, /finishNavigationRequest\(navigationRequest\.id\)/);
  assert.match(overlayResolver, /isNavigationRequestCurrent\(navigationRequest\.id\)/);
  assert.match(overlayResolver, /finishNavigationRequest\(navigationRequest\.id\)/);
  assert.match(appSource, /navigationAbortController\?\.abort\(\)/);
  assert.match(appSource, /prefetchEpoch \+= 1/);
  assert.match(
    prefetch,
    /isCurrentPrefetchRequest\(\s*requestEpoch,\s*requestSceneId\s*\)/
  );
  assert.match(appSource, /stopPrefetchPoller\(target\.key, requestEpoch\)/);
});

test("runtime cache flush clears every in-memory artwork tier", () => {
  const clearCache = sourceBetween("function clearCountryGeneratedState", "function enterMappedCountry");
  const clearPrefetch = sourceBetweenIn(
    artworkPrefetchControllerSource,
    "function invalidatePrefetchState",
    "function getReadinessLabel"
  );
  const clearPrefetchJobs = sourceBetweenIn(
    artworkPrefetchJobSource,
    "function invalidatePrefetchJobs",
    "function isCurrentPrefetchRequest"
  );
  const clearEnvironment = sourceBetween("function clearEnvironmentState", "return {");
  assert.match(clearCache, /state\.artworkJobs\.clear\(\)/);
  assert.match(clearCache, /state\.artworkByScene\.clear\(\)/);
  assert.match(clearCache, /state\.artworkByPage\.clear\(\)/);
  assert.match(clearCache, /state\.artworkImageLoads\.clear\(\)/);
  assert.match(clearCache, /invalidatePrefetchState\(\)/);
  assert.match(clearCache, /clearEnvironmentState\(countrySlug\)/);
  assert.match(clearEnvironment, /environmentPlanEpoch \+= 1/);
  assert.match(
    clearPrefetch,
    /prefetchJobController\.invalidatePrefetchJobs\(\)/
  );
  assert.match(
    clearPrefetchJobs,
    /state\.prefetchJobs\.clear\(\)/
  );
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
  const preload = sourceBetween("function preloadArtworkImage", "function bindPageClick");
  const sceneCompletion = sourceBetween("async function completeSceneArtwork", "async function completeCurrentPageArtwork");
  const pageCompletion = sourceBetween("async function completeCurrentPageArtwork", "async function preparePartialArtwork");

  assert.match(preload, /new Image\(\)/);
  assert.match(preload, /await image\.decode\(\)/);
  assert.match(sceneCompletion, /await preloadArtworkImage\(imageUrl\)/);
  assert.match(pageCompletion, /await preloadArtworkImage\(imageUrl\)/);
  assert.match(
    sceneCompletion,
    /getPageEnvironmentUrl\(\{\s*\.\.\.page,\s*\.\.\.imageResult\s*\}\)/
  );
  assert.match(
    pageCompletion,
    /getPageEnvironmentUrl\(\{\s*\.\.\.targetPage,\s*\.\.\.imageResult\s*\}\)/
  );
  assert.match(appSource, /decodedPartialImageUrl/);
  assert.match(appSource, /partialImageUrl/);
  assert.match(appSource, /getContainedImageRect\(image\)/);
  assert.match(styleSource, /\.scene-canvas \.scene-image--preview/);
  assert.match(styleSource, /\.scroll-stage--placeholder\.has-artwork-preview \.scene-canvas/);
});

test("responsive image overlays use the rendered artwork bounds", () => {
  assert.match(appSource, /publishExplorerScene/);
  assert.match(
    explorerSceneStageSource,
    /<ExplorerEnvironmentLayers/
  );
  assert.match(
    explorerSceneStageSource,
    /className="scene-image-overlay-frame"/
  );
  assert.match(
    explorerSceneStageSource,
    /new ResizeObserver\(sync\)/
  );
  assert.match(
    explorerSceneStageSource,
    /getContainedImageRect\(image\)/
  );
  assert.match(
    explorerSceneStageSource,
    /imageRect\.left - canvasRect\.left/
  );
  assert.match(
    explorerSceneStageSource,
    /imageRect\.width \/ canvasRect\.width/
  );
  assert.match(
    explorerSceneStageSource,
    /window\.addEventListener\("resize", sync\)/
  );
  assert.match(styleSource, /\.scene-image-overlay-frame\s*\{[^}]*position: absolute;[^}]*pointer-events: none;/s);
  assert.match(styleSource, /\.image-target-hotspot\s*\{[^}]*pointer-events: auto;/s);
  assert.match(styleSource, /\.image-target-hotspot\s*\{[^}]*box-shadow: inset 0 0 0 2px rgba\(36, 95, 82, 0\.22\);/s);
  assert.match(styleSource, /\.image-target-hotspot\.is-active\s*\{/);
  assert.match(explorerScenePolicySource, /target\.visualBounds/);
  assert.match(explorerScenePolicySource, /target\.labelBounds/);
  assert.match(
    explorerSceneStageSource,
    /image-target-hotspot--\$\{target\.mode\}/
  );
  assert.match(
    explorerScenePolicySource,
    /target\.nodeId === selectedNodeId/
  );
  assert.match(styleSource, /\.image-target-hotspot--label\s*\{[^}]*display: none;[^}]*pointer-events: none;/s);
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.image-target-hotspot--visual\s*\{[^}]*display: none;[^}]*pointer-events: none;/s);
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.image-target-hotspot--label\s*\{[^}]*display: block;[^}]*pointer-events: auto;/s);
});

test("missing artwork keeps an accessible, honest, low-motion blueprint", () => {
  assert.match(
    explorerSceneStageSource,
    /aria-busy=\{snapshot\.isArtworkPending\}/
  );
  assert.match(destinationNavigationSource, /loading-scene-progress--indeterminate/);
  assert.match(
    appSource,
    /loading-panel-progress--\$\{snapshot\.loadingPanel\.progressState\}/
  );
  assert.match(appSource, /progressState:[\s\S]*"indeterminate"/);
  assert.match(appSource, /captureExplorerFocusKey/);
  assert.match(appSource, /dataset\.roamFocusKey/);
  assert.match(styleSource, /\.scroll-stage--placeholder \.tile-art\s*\{[^}]*opacity: 0\.28/s);
  assert.match(styleSource, /\.artwork-retry-button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px/s);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
});

test("environment enhancement retries pending responses without gating artwork", () => {
  const environmentLookup = sourceBetween("function getSceneEnvironmentUrl", "function getPageEnvironmentUrl");

  assert.match(appSource, /ENVIRONMENT_PLAN_RETRY_DELAYS_MS/);
  assert.match(explorerEnvironmentSource, /Number\(error\.status\)/);
  assert.match(explorerEnvironmentSource, /\[202, 404, 409, 425\]/);
  assert.match(explorerClientSource, /error\.status = response\.status/);
  assert.match(
    explorerEnvironmentSource,
    /\["pending", "queued", "processing"\]/
  );
  assert.match(explorerEnvironmentSource, /return null/);
  assert.match(appSource, /status === "deferred"/);
  assert.doesNotMatch(environmentLookup, /getPageEnvironmentUrl\(state\.currentPage\) \?\?/);
  assert.match(environmentLookup, /isSameArtworkUrl\(imageUrl, sceneArtwork\?\.imageUrl\)/);
  assert.match(appSource, /new URL\(imageUrl, window\.location\.origin\)\.pathname/);
});

test("opening prefetched child artwork promotes its exact child target plan", () => {
  const sceneRender = sourceBetween(
    "function renderScene",
    "function canCurrentPageUseSceneArtwork"
  );
  const promotion = sourceBetweenIn(
    explorerEnvironmentPromotionSource,
    "async function promoteCurrentPageEnvironmentPlan",
    "function applyCurrentPageEnvironmentReference"
  );
  const environmentReference = sourceBetweenIn(
    explorerEnvironmentPromotionSource,
    "function applyCurrentPageEnvironmentReference",
    "return {"
  );

  assert.match(sceneRender, /pageNode\?\.childIds\?\.length/);
  assert.match(sceneRender, /promoteCurrentPageEnvironmentPlan\(imageUrl\)/);
  assert.match(promotion, /!currentNode\?\.childIds\?\.length/);
  assert.match(promotion, /nodeId: requestPage\.nodeId/);
  assert.match(promotion, /priority: "interactive"/);
  assert.match(promotion, /state\.currentPage\?\.nodeId !== expectedNodeId/);
  assert.match(promotion, /requestEnvironmentPlan\(environmentUrl\)/);
  assert.match(environmentReference, /state\.artworkByPage/);
  assert.match(environmentReference, /environmentStatus/);
  assert.doesNotMatch(promotion, /imageUrl:\s*null/);
});

test("VLM mappings provide responsive visual and label targets without giant boxes", () => {
  const environmentRequest = sourceBetweenIn(
    explorerEnvironmentSource,
    "async function requestEnvironmentPlan",
    "async function fetchEnvironmentPlanWithRetry"
  );
  const environmentNormalization = environmentPlanPolicySource;

  assert.equal(APP_CONFIG.environmentPlan.schemaVersion, "environment-plan-v4");
  assert.equal(APP_CONFIG.environmentPlan.promptVersion, "environment-plan-v7");
  assert.match(environmentRequest, /!isCurrentEnvironmentPlan\(plan\)/);
  assert.match(
    environmentRequest,
    /promoteCurrentPageEnvironmentPlan\(\s*state\.currentPage\?\.imageUrl \?\? environmentUrl\s*\)/s
  );
  assert.match(environmentNormalization, /visualBounds: normalizeEnvironmentPlanBounds/);
  assert.match(environmentNormalization, /labelBounds: normalizeEnvironmentPlanBounds/);
  assert.match(environmentNormalization, /maxWidth: 0\.48/);
  assert.match(environmentNormalization, /maxHeight: 0\.52/);
  assert.match(environmentNormalization, /maxWidth: 0\.24/);
  assert.match(environmentNormalization, /maxHeight: 0\.12/);
  assert.match(sceneGeometrySource, /centerX - width \/ 2/);
});

test("empty fallback target maps recover instead of disabling every selection box", () => {
  const sceneRender = sourceBetween(
    "function renderScene",
    "function canCurrentPageUseSceneArtwork"
  );
  const environmentRequest = sourceBetweenIn(
    explorerEnvironmentSource,
    "async function requestEnvironmentPlan",
    "async function fetchEnvironmentPlanWithRetry"
  );
  const planRecovery = environmentPlanPolicySource;

  assert.match(sceneRender, /environmentPlanNeedsTargetRecovery\(\s*environmentPlan,/);
  assert.match(environmentRequest, /environmentPlanNeedsTargetRecovery\(\s*cachedPlan,/);
  assert.match(environmentRequest, /environmentPlanNeedsTargetRecovery\(\s*normalizedPlan,/);
  assert.match(environmentRequest, /Environment plan has no destination targets/);
  assert.match(planRecovery, /source\.targets\.length > 0/);
  assert.match(planRecovery, /nodes\?\.\[nodeId\]\?\.childIds\?\.length/);
});

test("image quality selection is accessible, persistent, and reaches artwork requests", () => {
  const qualitySetting = countrySetupViewSource;
  const sceneRequest = sourceBetween(
    "async function requestSceneArtwork",
    "async function requestCurrentPageArtwork"
  );
  const pageRequest = sourceBetween(
    "async function requestCurrentPageArtwork",
    "async function pollArtworkJob"
  );
  const prefetchRequest = sourceBetweenIn(
    artworkPrefetchJobSource,
    "function prefetchArtworkTarget",
    "function pollPrefetchJob"
  );

  assert.match(
    appSource,
    /imageQualityStorageKey:\s*APP_CONFIG\.storageKeys\.imageQuality/
  );
  assert.deepEqual(
    APP_CONFIG.imageQuality.options.map(({ value }) => value),
    ["low", "medium", "high"]
  );
  assert.equal(
    APP_CONFIG.imageQuality.options.find(({ value }) => value === "high")?.recommended,
    true
  );
  assert.match(qualitySetting, /role="radiogroup"/);
  assert.match(qualitySetting, /role="radio"/);
  assert.match(qualitySetting, /aria-checked/);
  assert.match(sceneRequest, /quality: state\.imageQuality/);
  assert.match(pageRequest, /quality: state\.imageQuality/);
  assert.match(prefetchRequest, /quality: state\.imageQuality/);
  assert.match(appSource, /imageQuality: state\.imageQuality/);
  assert.match(appSource, /createImageQualityPreference/);
  assert.match(
    imageQualityPreferenceSource,
    /localStorage\.setItem\(storageKey, value\)/
  );
  assert.match(styleSource, /\.image-quality-option\.is-active/);
});

test("the artwork poll budget covers high-quality provider generation", () => {
  assert.ok(APP_CONFIG.artwork.pollTimeoutMs >= 10 * 60 * 1_000);
});
