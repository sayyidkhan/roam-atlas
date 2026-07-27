import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const localEnvSource = readFileSync(
  new URL("../src/platform/env/loadLocalEnv.js", import.meta.url),
  "utf8"
);
const playwrightConfig = readFileSync(new URL("../playwright.config.js", import.meta.url), "utf8");
const browserFixture = readFileSync(
  new URL("../test/browser/explorer-fixture.spec.js", import.meta.url),
  "utf8"
);

test("local environment loading preserves intentionally blank provider credentials", () => {
  assert.match(localEnvSource, /Object\.hasOwn\(environment, key\)/);
});

test("browser tests disable live image-provider credentials and concurrency", () => {
  assert.match(playwrightConfig, /OPENAI_API_KEY:\s*""/);
  assert.match(playwrightConfig, /EXA_API_KEY:\s*""/);
  assert.match(playwrightConfig, /ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY:\s*"0"/);
});

test("Playwright uses local artwork fixtures and blocks external browser traffic", () => {
  assert.match(browserFixture, /public\/art\/country-card-atlas\.jpg/);
  assert.match(browserFixture, /requestUrl\.pathname === "\/api\/artwork"/);
  assert.match(browserFixture, /unexpectedExternalRequests\.push/);
  assert.match(browserFixture, /await route\.abort\(\)/);
  assert.match(browserFixture, /expect\(unexpectedExternalRequests\)\.toEqual\(\[\]\)/);
});
