import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("../scripts/dev-server.js", import.meta.url), "utf8");
const playwrightConfig = readFileSync(new URL("../playwright.config.js", import.meta.url), "utf8");

test("local environment loading preserves intentionally blank provider credentials", () => {
  assert.match(serverSource, /Object\.hasOwn\(process\.env, key\)/);
});

test("browser tests disable live image-provider credentials and concurrency", () => {
  assert.match(playwrightConfig, /OPENAI_API_KEY:\s*""/);
  assert.match(playwrightConfig, /EXA_API_KEY:\s*""/);
  assert.match(playwrightConfig, /ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY:\s*"0"/);
});
