import test from "node:test";
import assert from "node:assert/strict";

import { ROAMATLAS_CONFIG } from "../src/config/roamAtlasConfig.js";
import {
  generateTileImageWithOpenAI,
  normalizeImageCompression,
  normalizeImageOutputFormat,
  normalizeImageQuality,
  normalizeImageRequestTimeout,
  parseRetryAfterMs
} from "../src/domain/imageProvider.js";
import {
  createImageVariantKey,
  createRuntimeCachePaths
} from "../src/domain/runtimeCache.js";

test("interactive image defaults use an explicit lower-latency output profile", () => {
  assert.deepEqual(ROAMATLAS_CONFIG.image, {
    provider: "openai",
    model: "gpt-image-2",
    fallbackModel: null,
    size: "1536x1024",
    quality: "medium",
    outputFormat: "jpeg",
    outputCompression: 82,
    partialImages: 1
  });
  assert.equal(normalizeImageQuality("unexpected"), "medium");
  assert.equal(normalizeImageOutputFormat("jpg"), "jpeg");
  assert.equal(normalizeImageCompression(140), 100);
  assert.equal(normalizeImageRequestTimeout(1000), 10_000);
  assert.equal(parseRetryAfterMs("7"), 7000);
});

test("image variant keys and URLs change with generation inputs", () => {
  const base = {
    prompt: "Draw Singapore",
    imageModel: "gpt-image-2",
    fallbackImageModel: null,
    size: "1536x1024",
    quality: "medium",
    outputFormat: "jpeg",
    outputCompression: 82,
    promptVersion: "prompt-v1",
    styleVersion: "style-v1",
    dataVersion: "data-v1"
  };
  const first = createImageVariantKey(base);
  const second = createImageVariantKey({ ...base, quality: "low" });
  assert.notEqual(first, second);
  assert.notEqual(first, createImageVariantKey({ ...base, fallbackImageModel: "gpt-image-1" }));

  const paths = createRuntimeCachePaths({
    cacheRoot: "/tmp/roamatlas",
    countrySlug: "singapore",
    pageId: "artwork-singapore-overview",
    imageModel: "gpt-image-2",
    outputFormat: "jpeg",
    variantKey: first
  });
  assert.match(paths.imagePath, new RegExp(`${first}\\.jpg$`));
  assert.match(paths.partialImagePath, new RegExp(`${first}\\.partial\\.jpg$`));
  assert.match(paths.jobUrl, new RegExp(`${first}\\.json$`));
  assert.match(paths.understandingUrl, new RegExp(`${first}\\.json$`));
});

test("non-streaming image requests send explicit quality and compressed format", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(
      JSON.stringify({
        data: [{ b64_json: "ZmluYWw=" }],
        output_format: "jpeg",
        quality: "medium",
        usage: { total_tokens: 42 }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const result = await generateTileImageWithOpenAI({
      apiKey: "test-key",
      prompt: "Draw a calm atlas page",
      size: "1536x1024",
      quality: "medium",
      outputFormat: "jpeg",
      outputCompression: 82,
      partialImages: 0
    });
    assert.equal(requestBody.quality, "medium");
    assert.equal(requestBody.output_format, "jpeg");
    assert.equal(requestBody.output_compression, 82);
    assert.equal(requestBody.stream, undefined);
    assert.equal(result.outputFormat, "jpeg");
    assert.equal(result.usage.total_tokens, 42);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streaming image requests surface a partial before the final image", async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const events = [
    'data: {"type":"image_generation.partial_image","b64_json":"cGFydGlhbA==","partial_image_index":0,"output_format":"jpeg"}\n\n',
    'data: {"type":"image_generation.completed","b64_json":"ZmluYWw=","output_format":"jpeg","quality":"medium","size":"1536x1024"}\n\n'
  ];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.stream, true);
    assert.equal(body.partial_images, 1);
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const event of events) controller.enqueue(encoder.encode(event));
          controller.close();
        }
      }),
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    );
  };

  const partials = [];
  try {
    const result = await generateTileImageWithOpenAI({
      apiKey: "test-key",
      prompt: "Draw a calm atlas page",
      partialImages: 1,
      onPartialImage: async (partial) => partials.push(partial)
    });
    assert.equal(partials.length, 1);
    assert.equal(partials[0].b64Json, "cGFydGlhbA==");
    assert.equal(result.b64Json, "ZmluYWw=");
    assert.equal(result.outputFormat, "jpeg");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider failures retain retry timing for the queue", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limited", {
    status: 429,
    headers: { "Retry-After": "12" }
  });

  try {
    await assert.rejects(
      generateTileImageWithOpenAI({
        apiKey: "test-key",
        prompt: "Draw a calm atlas page"
      }),
      (error) => error.status === 429 && error.retryAfterMs === 12_000
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
