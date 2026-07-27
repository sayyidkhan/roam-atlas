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
