import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/app/applicationRuntime.ts", import.meta.url), "utf8");
const featureRoot = new URL("../src/features/", import.meta.url);

test("React composition root owns the frontend entry without an app monolith bridge", () => {
  const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appComposition = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");
  const runtimeHost = readFileSync(
    new URL("../src/app/ApplicationRuntimeHost.tsx", import.meta.url),
    "utf8"
  );

  assert.match(htmlSource, /src="\/src\/app\/main\.tsx"/);
  assert.doesNotMatch(htmlSource, /src="\/src\/ui\/app\.js/);
  assert.match(appComposition, /<Routes>/);
  assert.doesNotMatch(appComposition, /ui\/app\.js/);
  assert.match(runtimeHost, /import\("\.\/applicationRuntime"\)/);
  assert.equal(existsSync(new URL("../src/ui/app.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/app/applicationRuntime.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/app/browserRuntime.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/app/applicationRuntime.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../src/app/browserRuntime.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../src/features/countrySetup/countryShellView.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/features/countrySetup/countryShellView.ts", import.meta.url)), true);
});

test("application runtime delegates mutable feature API calls to feature clients", () => {
  const explorerController = readFileSync(
    new URL("explorer/explorerController.js", featureRoot),
    "utf8"
  );

  assert.doesNotMatch(appSource, /fetch\(apiPath\("\/api\/(?:country-draft|place-image|runtime-cache|flipbook)/);
  assert.match(appSource, /createCountryDraftClient/);
  assert.match(appSource, /createPlaceImageClient/);
  assert.match(appSource, /flushCountryRuntimeCache/);
  assert.doesNotMatch(appSource, /explorerClient\.resolveFlipbookClick/);
  assert.match(explorerController, /explorerClient\.resolveFlipbookClick/);
});

test("feature clients retain endpoint ownership outside the UI entry point", () => {
  const countryDraftClient = readFileSync(new URL("countryDraft/countryDraftClient.js", featureRoot), "utf8");
  const placeImageClient = readFileSync(new URL("placeImages/placeImageClient.js", featureRoot), "utf8");
  const runtimeCacheClient = readFileSync(new URL("runtimeCache/runtimeCacheClient.js", featureRoot), "utf8");
  const explorerClient = readFileSync(new URL("explorer/explorerClient.js", featureRoot), "utf8");

  assert.match(countryDraftClient, /\/api\/country-draft\/influence/);
  assert.match(placeImageClient, /\/api\/place-image\/feedback/);
  assert.match(runtimeCacheClient, /\/api\/runtime-cache\/flush/);
  assert.match(explorerClient, /\/api\/flipbook\/click/);
});

test("country-draft rendering is feature-owned instead of embedded in the UI controller", () => {
  const countryDraftPanel = readFileSync(
    new URL("countryDraft/countryDraftPanelView.js", featureRoot),
    "utf8"
  );

  assert.match(appSource, /createCountryDraftPanelView/);
  assert.doesNotMatch(appSource, /function renderDraftRegion\(/);
  assert.doesNotMatch(appSource, /function renderDraftTheme\(/);
  assert.doesNotMatch(appSource, /function renderDraftChildNodes\(/);
  assert.match(countryDraftPanel, /function renderCountryDraftPanel\(/);
  assert.match(countryDraftPanel, /function renderDraftRegion\(/);
  assert.match(countryDraftPanel, /function renderDraftChildNodes\(/);
});

test("destination navigation rendering is feature-owned instead of embedded in the UI controller", () => {
  const destinationNavigationView = readFileSync(
    new URL("explorer/destinationNavigationView.js", featureRoot),
    "utf8"
  );

  assert.match(appSource, /createDestinationNavigationView/);
  assert.doesNotMatch(appSource, /function renderRegionRail\(/);
  assert.doesNotMatch(appSource, /function renderLoadingSceneBoard\(/);
  assert.doesNotMatch(appSource, /function getPrefetchTargetState\(/);
  assert.match(destinationNavigationView, /function renderRegionRail\(/);
  assert.match(destinationNavigationView, /function renderLoadingSceneBoard\(/);
  assert.match(destinationNavigationView, /function getPrefetchTargetState\(/);
});

test("country setup owns its DOM event controller instead of the UI entry point", () => {
  const countryShellController = readFileSync(
    new URL("countrySetup/countryShellController.js", featureRoot),
    "utf8"
  );

  assert.match(appSource, /createCountryShellController/);
  assert.doesNotMatch(appSource, /function bindCountryShell\(/);
  assert.doesNotMatch(appSource, /function focusOpenDraftGenAiTextarea\(/);
  assert.match(countryShellController, /function bindCountryShell\(/);
  assert.match(countryShellController, /function focusOpenDraftGenAiTextarea\(/);
  assert.match(countryShellController, /data-country-action/);
});

test("stateless feature policy does not remain embedded in the application runtime", () => {
  const artworkPolicy = readFileSync(
    new URL("artwork/artworkJobPolicy.ts", featureRoot),
    "utf8"
  );
  const draftTree = readFileSync(new URL("countryDraft/draftTree.ts", featureRoot), "utf8");
  const sceneGeometry = readFileSync(new URL("explorer/sceneGeometry.ts", featureRoot), "utf8");
  const environmentPlanPolicy = readFileSync(
    new URL("explorer/environmentPlanPolicy.ts", featureRoot),
    "utf8"
  );

  assert.doesNotMatch(appSource, /function getArtworkFailureMessage\(/);
  assert.doesNotMatch(appSource, /function getDraftNodeAtPath\(/);
  assert.doesNotMatch(appSource, /function normalizeEnvironmentPlanBounds\(/);
  assert.doesNotMatch(appSource, /function normalizeEnvironmentPlan\(/);
  assert.match(artworkPolicy, /function getArtworkFailureMessage\(/);
  assert.match(draftTree, /function getDraftNodeAtPath\(/);
  assert.match(sceneGeometry, /function normalizeEnvironmentPlanBounds\(/);
  assert.match(environmentPlanPolicy, /function normalizeEnvironmentPlan\(/);
});

test("CSS entry is an import manifest and React catalog styles are locally owned", () => {
  const styleEntry = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const catalogView = readFileSync(
    new URL("countryCatalog/CountryCatalogView.tsx", featureRoot),
    "utf8"
  );

  assert.ok(styleEntry.trim().split("\n").length <= 24);
  assert.match(styleEntry, /features\/countrySetup\/countrySetup\.css/);
  assert.match(styleEntry, /features\/countryDraft\/draftTree\.css/);
  assert.match(styleEntry, /features\/explorer\/environmentLayers\.css/);
  assert.doesNotMatch(styleEntry, /\{\s*$/m);
  assert.match(catalogView, /import styles from "\.\/CountryCatalog\.module\.css"/);
  assert.equal(
    existsSync(new URL("countryCatalog/CountryCatalog.module.css", featureRoot)),
    true
  );
});

test("development command executes the typed server composition root directly", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(
    packageJson.scripts["dev:api"],
    "cross-env PORT=4151 node src/server/roamAtlasDevServer.ts"
  );
  assert.equal(
    existsSync(new URL("../scripts/dev-server.js", import.meta.url)),
    false
  );
});

test("platform concerns stay outside the backend composition entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /platform\/env\/loadLocalEnv/);
  assert.match(serverSource, /platform\/http\/staticAssetServer/);
  assert.match(serverSource, /platform\/dev\/liveReloadServer/);
  assert.doesNotMatch(serverSource, /function loadLocalEnv\(/);
  assert.doesNotMatch(serverSource, /readJsonBody|function readJson\(/);
  assert.doesNotMatch(serverSource, /function serveStatic\(/);
  assert.doesNotMatch(serverSource, /function startLiveReloadWatcher\(/);
});

test("country and Wikipedia media ownership stays outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL(
      "../src/features/countryImages/countryImageService.js",
      import.meta.url
    ),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL(
      "../src/features/countryImages/countryImageRepository.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createCountryImageService/);
  assert.match(serverSource, /createCountryImageRepository/);
  assert.match(serverSource, /wikipediaPlaceImageProvider/);
  assert.match(serviceSource, /repository\.find\(country\)/);
  assert.match(repositorySource, /async function write\(/);
  assert.doesNotMatch(serviceSource, /from "node:fs/);
  assert.doesNotMatch(serverSource, /function handleCountryImageRequest\(/);
  assert.doesNotMatch(serverSource, /function persistCountryCardImage\(/);
  assert.doesNotMatch(serverSource, /function resolveCountryWikipediaArticleImage\(/);
  assert.doesNotMatch(serverSource, /function resolveCountryLandmarkSearchImage\(/);
  assert.doesNotMatch(serverSource, /function resolvePlaceWikipediaImage\(/);
});

test("place-image policy, persistence, and providers stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const featureSource = readFileSync(
    new URL("../src/features/placeImages/placeImageFeature.js", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL("../src/features/placeImages/placeImageService.js", import.meta.url),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../src/features/placeImages/placeImageRepository.js", import.meta.url),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("../src/features/placeImages/exaPlaceImageProvider.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createPlaceImageFeature/);
  assert.match(featureSource, /createPlaceImageService/);
  assert.match(featureSource, /createPlaceImageRepository/);
  assert.match(serviceSource, /async function resolveImage/);
  assert.match(featureSource, /readCachedImage: repository\.readCachedImage/);
  assert.doesNotMatch(featureSource, /from "node:fs/);
  assert.match(repositorySource, /async function readCachedImage/);
  assert.match(repositorySource, /async function selectHistoryEntry/);
  assert.match(providerSource, /https:\/\/api\.exa\.ai\/search/);
  assert.doesNotMatch(serverSource, /function resolvePlaceImage/);
  assert.doesNotMatch(serverSource, /function archiveStoredPlaceImage/);
  assert.doesNotMatch(serverSource, /function searchExaPlaceImageQuery/);
  assert.doesNotMatch(serverSource, /contents: \{ extras: \{ imageLinks/);
});

test("country-draft generation and persistence stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const featureSource = readFileSync(
    new URL("../src/features/countryDraft/countryDraftFeature.js", import.meta.url),
    "utf8"
  );
  const generatorSource = readFileSync(
    new URL("../src/features/countryDraft/countryDraftGenerator.js", import.meta.url),
    "utf8"
  );
  const openAIProviderSource = readFileSync(
    new URL(
      "../src/features/countryDraft/openAICountryDraftProvider.js",
      import.meta.url
    ),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../src/features/countryDraft/countryDraftRepository.js", import.meta.url),
    "utf8"
  );
  const groundingSource = readFileSync(
    new URL("../src/features/countryDraft/exaCountryGroundingProvider.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createCountryDraftFeature/);
  assert.match(featureSource, /createCountryDraftGenerator/);
  assert.match(featureSource, /createCountryDraftRepository/);
  assert.match(featureSource, /createOpenAICountryDraftProvider/);
  assert.match(generatorSource, /buildCountryDraftPrompt/);
  assert.match(generatorSource, /draftProvider\.generate\(prompt\)/);
  assert.doesNotMatch(generatorSource, /api\.openai\.com/);
  assert.match(openAIProviderSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(repositorySource, /createCountryStarterMapCachePaths/);
  assert.match(groundingSource, /EXA_MIN_SNIPPET_TEXT_LENGTH/);
  assert.doesNotMatch(serverSource, /function generateCountryDraft/);
  assert.doesNotMatch(serverSource, /function readStoredCountryDraft/);
  assert.doesNotMatch(serverSource, /const EXA_GROUNDING_DOMAINS/);
});

test("click VLM provider and PNG annotation stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const resolverSource = readFileSync(
    new URL("../src/features/explorer/openAIClickResolver.js", import.meta.url),
    "utf8"
  );
  const markerSource = readFileSync(
    new URL("../src/features/explorer/clickMarkerPng.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createOpenAIClickResolver/);
  assert.match(resolverSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(markerSource, /annotateClickPointOnPng/);
  assert.doesNotMatch(serverSource, /function resolveClickPhraseWithOpenAI/);
  assert.doesNotMatch(serverSource, /function decodeSimplePng/);
  assert.doesNotMatch(serverSource, /PNG_CRC_TABLE/);
});

test("environment provider and normalization policy stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("../src/features/explorer/openAIEnvironmentPlanner.js", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL("../src/features/explorer/environmentPlanServerPolicy.js", import.meta.url),
    "utf8"
  );
  const queueSource = readFileSync(
    new URL("../src/features/artwork/environmentPlanQueue.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createOpenAIEnvironmentPlanner/);
  assert.match(serverSource, /createEnvironmentPlanServerPolicy/);
  assert.match(providerSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(policySource, /function normalizeTarget/);
  assert.match(queueSource, /async function ensurePlan/);
  assert.match(queueSource, /function scheduleProcessing/);
  assert.doesNotMatch(serverSource, /function normalizeEnvironmentTarget/);
  assert.doesNotMatch(serverSource, /function createEnvironmentFallbackPlan/);
  assert.doesNotMatch(serverSource, /function createServerRequestSignal/);
  assert.doesNotMatch(serverSource, /function processNextEnvironmentPlan/);
  assert.doesNotMatch(serverSource, /function ensureEnvironmentPlanForPage/);
});

test("configured image provider stays outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("../src/features/artwork/configuredImageProvider.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createConfiguredImageProvider/);
  assert.match(providerSource, /generateTileImageWithOpenAI/);
  assert.match(providerSource, /normalizeImageModel/);
  assert.doesNotMatch(serverSource, /function generateConfiguredImage/);
  assert.doesNotMatch(serverSource, /generateTileImageWithOpenAI/);
});

test("semantic click policy and persistence stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const featureSource = readFileSync(
    new URL("../src/features/explorer/clickResolutionFeature.js", import.meta.url),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../src/features/explorer/pageUnderstandingRepository.js", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL("../src/features/explorer/semanticRegionPolicy.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createClickResolutionFeature/);
  assert.match(featureSource, /createPageUnderstandingRepository/);
  assert.match(repositorySource, /understandingPath/);
  assert.match(policySource, /selectSemanticRegionForPoint/);
  assert.doesNotMatch(serverSource, /function appendSemanticRegionFromResult/);
  assert.doesNotMatch(serverSource, /function readPageUnderstanding/);
  assert.doesNotMatch(serverSource, /function matchVlmPhraseForCurrentPage/);
});

test("artwork job files and terminal-state indexing stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../src/features/artwork/artworkJobRepository.js", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createArtworkJobRepository/);
  assert.match(repositorySource, /async function writeJob/);
  assert.match(repositorySource, /async function writeBinaryArtifact/);
  assert.match(repositorySource, /async function writeJsonArtifact/);
  assert.match(repositorySource, /async function listJobFiles/);
  assert.match(repositorySource, /const terminalJobs = new Set/);
  assert.doesNotMatch(serverSource, /async function writeCodexImageJob/);
  assert.doesNotMatch(serverSource, /async function listRuntimeImageJobFiles/);
  assert.doesNotMatch(serverSource, /terminalImageJobs/);
});

test("artwork job eligibility and cache identity stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL(
      "../src/features/artwork/artworkJobProcessingPolicy.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createArtworkJobPolicy/);
  assert.match(policySource, /createImageVariantKey/);
  assert.match(policySource, /function shouldProcessJob/);
  assert.match(policySource, /function isTransientGenerationError/);
  assert.doesNotMatch(serverSource, /function createAssetVersionForPage/);
  assert.doesNotMatch(serverSource, /function shouldProcessCodexJob/);
  assert.doesNotMatch(serverSource, /function isTransientImageGenerationError/);
});

test("artwork job lifecycle stays outside the server composition entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL("../src/features/artwork/artworkJobService.js", import.meta.url),
    "utf8"
  );
  const creationSource = readFileSync(
    new URL(
      "../src/features/artwork/artworkJobCreationService.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createArtworkJobService/);
  assert.match(serviceSource, /createArtworkJobCreationService/);
  assert.match(creationSource, /async function createImageJob/);
  assert.match(serviceSource, /async function processJob/);
  assert.match(serviceSource, /function cancelForCountry/);
  assert.match(serviceSource, /jobRepository\.writeBinaryArtifact/);
  assert.match(serviceSource, /jobRepository\.writeJsonArtifact/);
  assert.doesNotMatch(serviceSource, /from "node:fs/);
  assert.doesNotMatch(creationSource, /from "node:fs/);
  assert.doesNotMatch(serverSource, /function processCodexImageJob/);
  assert.doesNotMatch(serverSource, /function createCodexImageJobUnlocked/);
  assert.doesNotMatch(serverSource, /const processingJobs = new Map/);
});

test("country runtime cache coordination stays outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL(
      "../src/features/runtimeCache/runtimeCacheService.js",
      import.meta.url
    ),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL(
      "../src/features/runtimeCache/runtimeCacheRepository.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createRuntimeCacheService/);
  assert.match(serverSource, /createRuntimeCacheRepository/);
  assert.match(serviceSource, /async function flushVisualCache/);
  assert.match(serviceSource, /async function flushRuntimeCache/);
  assert.match(serviceSource, /function isPathBeingFlushed/);
  assert.match(serviceSource, /repository\.removeFolders/);
  assert.doesNotMatch(serviceSource, /from "node:fs/);
  assert.match(repositorySource, /async function removeCountryRoot/);
  assert.doesNotMatch(serverSource, /function flushCountryGeneratedVisualCache/);
  assert.doesNotMatch(serverSource, /const flushingCountryCacheRoots/);
});

test("typed Hono API composes feature-owned routes outside the dev bootstrap", () => {
  const serverSource = readFileSync(
    new URL("../src/server/roamAtlasDevServer.ts", import.meta.url),
    "utf8"
  );
  const apiSource = readFileSync(
    new URL("../src/server/createRoamAtlasApi.ts", import.meta.url),
    "utf8"
  );
  const runtimeCacheHttpSource = readFileSync(
    new URL(
      "../src/features/runtimeCache/runtimeCacheHttpHandler.js",
      import.meta.url
    ),
    "utf8"
  );
  const honoRoutesSource = readFileSync(
    new URL(
      "../src/platform/http/honoRoutes.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createRoamAtlasApi/);
  assert.match(serverSource, /serve\(\{/);
  assert.match(serverSource, /createRuntimeCacheRoutes/);
  assert.match(apiSource, /new Hono\(\)/);
  assert.match(apiSource, /for \(const registerRoutes of routeRegistrars\)/);
  assert.doesNotMatch(apiSource, /RESPONSE_ALREADY_SENT|IncomingMessage|ServerResponse/);
  assert.doesNotMatch(apiSource, /"\/api\//);
  assert.match(honoRoutesSource, /registerHonoRoute/);
  assert.doesNotMatch(honoRoutesSource, /RESPONSE_ALREADY_SENT|IncomingMessage|ServerResponse/);
  assert.match(runtimeCacheHttpSource, /"\/api\/runtime-cache\/flush"/);
  assert.doesNotMatch(serverSource, /createServer\(async/);
  assert.doesNotMatch(serverSource, /request\.method ===/);
  assert.doesNotMatch(serverSource, /"\/api\//);
});
