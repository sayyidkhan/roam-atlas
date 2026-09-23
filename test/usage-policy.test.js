import test from "node:test";
import assert from "node:assert/strict";

import {
  createUsageRecord,
  summarizeUsage
} from "../apps/api/src/features/usage/usagePolicy.ts";

test("normalizes Responses API usage and estimates Fast-mode cost", () => {
  const record = createUsageRecord({
    feature: "environment_plan",
    model: "gpt-5.6-terra",
    serviceTier: "fast",
    durationMs: 1234,
    timestamp: new Date("2026-09-22T00:00:00.000Z"),
    usage: {
      input_tokens: 1000,
      input_tokens_details: { cached_tokens: 100 },
      output_tokens: 500
    }
  });

  assert.equal(record.inputTokens, 1000);
  assert.equal(record.cachedInputTokens, 100);
  assert.equal(record.outputTokens, 500);
  assert.equal(record.estimatedCostUsd, 0.01564);
  assert.equal(record.durationMs, 1234);
});

test("separates image tokens and summarizes usage records", () => {
  const record = createUsageRecord({
    feature: "image_generation",
    model: "gpt-image-2.5-flare-2026-09-08",
    durationMs: 12_000,
    usage: {
      input_tokens: 1000,
      input_tokens_details: {
        cached_tokens: 100,
        image_tokens: 400
      },
      output_tokens: 2000,
      output_tokens_details: { image_tokens: 2000 }
    }
  });

  assert.equal(record.inputTokens, 600);
  assert.equal(record.imageInputTokens, 400);
  assert.equal(record.outputTokens, 0);
  assert.equal(record.imageOutputTokens, 2000);
  assert.equal(record.estimatedCostUsd, 0.065825);
  assert.deepEqual(summarizeUsage([record]), {
    requests: 1,
    inputTokens: 600,
    cachedInputTokens: 100,
    outputTokens: 0,
    imageInputTokens: 400,
    imageOutputTokens: 2000,
    estimatedCostUsd: 0.065825
  });
});
