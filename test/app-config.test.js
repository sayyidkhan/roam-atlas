import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { APP_CONFIG } from "../apps/web/src/config/appConfig.js";
import { readFrontendRuntimeSource } from "./support/frontend-runtime-source.js";

const appSource = readFrontendRuntimeSource();

test("browser application policy is centralized in an immutable app config", () => {
  assert.equal(APP_CONFIG.storageKeys.imageQuality, "roamatlas:image-quality");
  assert.equal(APP_CONFIG.imageQuality.defaultValue, "high");
  assert.deepEqual(
    APP_CONFIG.imageQuality.options.map(({ value }) => value),
    ["low", "medium", "high"]
  );
  assert.ok(APP_CONFIG.artwork.pollTimeoutMs > APP_CONFIG.artwork.pollIntervalMs);
  assert.ok(Object.isFrozen(APP_CONFIG));
  assert.ok(Object.isFrozen(APP_CONFIG.environmentPlan.retryDelaysMs));
});

test("UI entry point consumes app config instead of owning browser policy literals", () => {
  assert.match(appSource, /import \{ APP_CONFIG \} from "\.\.\/config\/appConfig\.js";/);
  assert.match(appSource, /APP_CONFIG\.countryDraft\.candidateNameMaxLength/);
  assert.match(appSource, /APP_CONFIG\.placeImages\.feedbackMaxLength/);
  assert.match(appSource, /APP_CONFIG\.notifications\.defaultToastDurationMs/);
  assert.doesNotMatch(appSource, /roamatlas:image-quality/);
  assert.doesNotMatch(appSource, /environment-plan-v4/);
  assert.doesNotMatch(appSource, /environment-plan-v7/);
});
