import { ROAMATLAS_CONFIG } from "../config/roamAtlasConfig.js";

export const DEFAULT_IMAGE_PROVIDER = ROAMATLAS_CONFIG.image.provider;
export const DEFAULT_IMAGE_MODEL = ROAMATLAS_CONFIG.image.model;
export const DEFAULT_IMAGE_SIZE = ROAMATLAS_CONFIG.image.size;
export const DEFAULT_IMAGE_QUALITY = ROAMATLAS_CONFIG.image.quality;
export const DEFAULT_IMAGE_OUTPUT_FORMAT = ROAMATLAS_CONFIG.image.outputFormat;
export const DEFAULT_IMAGE_OUTPUT_COMPRESSION = ROAMATLAS_CONFIG.image.outputCompression;
export const DEFAULT_IMAGE_PARTIAL_IMAGES = ROAMATLAS_CONFIG.image.partialImages;
export const DEFAULT_IMAGE_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
export const IMAGE_REQUEST_TIMEOUT_MS_BY_QUALITY = Object.freeze({
  low: 1 * 60 * 1000,
  medium: 3 * 60 * 1000,
  high: 5 * 60 * 1000,
  auto: 3 * 60 * 1000
});
export const DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT = `
You are the travel image prompt compiler and visual style director.

Always generate images in this app's restrained flipbook encyclopedia style:
- clean isometric or lightly axonometric architectural planning illustration
- precise thin grey ink outlines
- flat muted pastel colors
- desaturated greens and pale blues
- light beige paths and roads
- generous spacing and clear object separation
- medium-low density
- calm urban planning proposal board feeling
- illustrated encyclopedia / museum guide page feeling

The image should feel like a clean travel visual encyclopedia page, not a
tourist poster, not a dense atlas, not a fantasy city, and not a children's book.

Short readable text is allowed only when it is supplied by the app: page titles,
curated node names, short chapter labels, numbers, and one- to three-word callout
headings. Do not invent prices, opening hours, route times, official signage,
source citations, marketing copy, or long factual paragraphs.

Compose for a browser viewport. Keep important subjects, labels, callouts, and
faces inside the central 3:2 safe area. Use simple water, paper, lawn, road, or
sky-like areas near the outer edges so full-screen cover cropping does not cut
off the important content.
`.trim();

export function normalizeImageModel(model = DEFAULT_IMAGE_MODEL) {
  const value = String(model).trim();
  if (value === "image2" || value === "image-2" || value === "gpt image 2") {
    return "gpt-image-2";
  }
  return value || DEFAULT_IMAGE_MODEL;
}

export class ImageProviderNotConfiguredError extends Error {
  constructor(model = DEFAULT_IMAGE_MODEL) {
    super(
      `OpenAI image generation is not configured. Preferred model is ${model}; set OPENAI_API_KEY before generating tiles.`
    );
    this.name = "ImageProviderNotConfiguredError";
  }
}

export function createImageGenerationJob({ scene, tile, promptVersion }) {
  return {
    sceneId: scene.id,
    tileId: tile.id,
    row: tile.row,
    column: tile.column,
    bounds: tile.bounds,
    styleVersion: scene.styleVersion,
    dataVersion: scene.dataVersion,
    promptVersion,
    imageModel: tile.imageModel,
    basePrompt: tile.prompt,
    continuityPrompt: tile.continuityPrompt,
    neighborContext: tile.neighborContext ?? {}
  };
}

export async function generateTileImage() {
  throw new ImageProviderNotConfiguredError();
}

export async function generateTileImageWithOpenAI({
  apiKey,
  model = DEFAULT_IMAGE_MODEL,
  prompt,
  fallbackModel = ROAMATLAS_CONFIG.image.fallbackModel,
  size = DEFAULT_IMAGE_SIZE,
  quality = DEFAULT_IMAGE_QUALITY,
  outputFormat = DEFAULT_IMAGE_OUTPUT_FORMAT,
  outputCompression = DEFAULT_IMAGE_OUTPUT_COMPRESSION,
  partialImages = DEFAULT_IMAGE_PARTIAL_IMAGES,
  onPartialImage = null,
  requestTimeoutMs = null,
  signal = null
}) {
  const requestedModel = normalizeImageModel(model);
  const requestedFallbackModel = fallbackModel ? normalizeImageModel(fallbackModel) : null;
  const requestedFormat = normalizeImageOutputFormat(outputFormat);
  const shouldStream = Number(partialImages) > 0 && typeof onPartialImage === "function";
  if (!apiKey) {
    throw new ImageProviderNotConfiguredError(requestedModel);
  }

  const requestBody = {
    model: requestedModel,
    prompt,
    size,
    quality: normalizeImageQuality(quality),
    output_format: requestedFormat,
    n: 1,
    ...(requestedFormat === "jpeg" || requestedFormat === "webp"
      ? { output_compression: normalizeImageCompression(outputCompression) }
      : {}),
    ...(shouldStream
      ? {
          stream: true,
          partial_images: Math.min(3, Math.max(1, Number.parseInt(partialImages, 10) || 1))
        }
      : {})
  };

  const requestAbort = createImageRequestAbortContext(
    signal,
    resolveImageRequestTimeoutMs({ quality: requestBody.quality, requestTimeoutMs })
  );

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: requestAbort.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    // The quality timeout controls how long OpenAI may take to start the
    // response. Once a streaming response has started, keeping the same timer
    // attached aborts healthy generations after partial images have arrived.
    // External cancellation remains active until the response is fully read.
    requestAbort.clearRequestTimeout();

    if (!response.ok) {
      const body = await response.text();
      if (shouldTryFallbackImageModel({ model: requestedModel, fallbackModel: requestedFallbackModel, body })) {
        return generateTileImageWithOpenAI({
          apiKey,
          model: requestedFallbackModel,
          fallbackModel: null,
          prompt,
          size,
          quality,
          outputFormat: requestedFormat,
          outputCompression,
          partialImages,
          onPartialImage,
          requestTimeoutMs,
          signal
        });
      }
      const error = new Error(`OpenAI image generation failed: ${response.status} ${body}`);
      error.status = response.status;
      error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      throw error;
    }

    if (shouldStream) {
      return readStreamingImageResponse(response, {
        requestedModel,
        size,
        quality: requestBody.quality,
        outputFormat: requestedFormat,
        outputCompression: requestBody.output_compression,
        onPartialImage
      });
    }

    const payload = await response.json();
    const image = payload.data?.[0];
    if (!image?.b64_json) {
      throw new Error("OpenAI image generation returned no base64 image data.");
    }

    return {
      b64Json: image.b64_json,
      revisedPrompt: image.revised_prompt,
      model: requestedModel,
      size,
      quality: payload.quality ?? requestBody.quality,
      outputFormat: payload.output_format ?? requestedFormat,
      outputCompression: requestBody.output_compression,
      usage: payload.usage ?? null,
      provider: DEFAULT_IMAGE_PROVIDER
    };
  } finally {
    requestAbort.dispose();
  }
}

export function normalizeImageQuality(value = DEFAULT_IMAGE_QUALITY) {
  const normalized = String(value ?? "auto").trim().toLowerCase();
  return ["low", "medium", "high", "auto"].includes(normalized) ? normalized : "medium";
}

export function normalizeImageOutputFormat(value = DEFAULT_IMAGE_OUTPUT_FORMAT) {
  const normalized = String(value ?? "png").trim().toLowerCase();
  if (normalized === "jpg") return "jpeg";
  return ["png", "jpeg", "webp"].includes(normalized) ? normalized : "jpeg";
}

export function normalizeImageCompression(value = DEFAULT_IMAGE_OUTPUT_COMPRESSION) {
  const parsed = Number.parseInt(value, 10);
  return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : 82));
}

export function normalizeImageRequestTimeout(value = DEFAULT_IMAGE_REQUEST_TIMEOUT_MS) {
  const parsed = Number.parseInt(value, 10);
  return Math.min(10 * 60 * 1000, Math.max(10_000, Number.isFinite(parsed) ? parsed : DEFAULT_IMAGE_REQUEST_TIMEOUT_MS));
}

export function resolveImageRequestTimeoutMs({
  quality = DEFAULT_IMAGE_QUALITY,
  requestTimeoutMs = null
} = {}) {
  if (requestTimeoutMs != null && String(requestTimeoutMs).trim() !== "") {
    return normalizeImageRequestTimeout(requestTimeoutMs);
  }
  const normalizedQuality = normalizeImageQuality(quality);
  return IMAGE_REQUEST_TIMEOUT_MS_BY_QUALITY[normalizedQuality] ?? DEFAULT_IMAGE_REQUEST_TIMEOUT_MS;
}

export function parseRetryAfterMs(value, now = Date.now()) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const retryAt = Date.parse(raw);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : 0;
}

export function createImageRequestAbortContext(externalSignal, requestTimeoutMs) {
  const controller = new AbortController();
  let timeoutId = setTimeout(() => {
    if (controller.signal.aborted) return;
    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    controller.abort(timeoutError);
  }, normalizeImageRequestTimeout(requestTimeoutMs));
  timeoutId.unref?.();

  const clearRequestTimeout = () => {
    if (timeoutId == null) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  const forwardExternalAbort = () => {
    if (!controller.signal.aborted) controller.abort(externalSignal?.reason);
  };
  if (externalSignal?.aborted) {
    forwardExternalAbort();
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", forwardExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    clearRequestTimeout,
    dispose() {
      clearRequestTimeout();
      externalSignal?.removeEventListener?.("abort", forwardExternalAbort);
    }
  };
}

async function readStreamingImageResponse(
  response,
  { requestedModel, size, quality, outputFormat, outputCompression, onPartialImage }
) {
  if (!response.body) {
    throw new Error("OpenAI image generation streaming returned no response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = null;

  const consumeEvent = async (rawEvent) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return;

    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }

    if (event.type === "image_generation.partial_image" && event.b64_json) {
      await onPartialImage({
        b64Json: event.b64_json,
        partialImageIndex: event.partial_image_index ?? 0,
        size: event.size ?? size,
        quality: event.quality ?? quality,
        outputFormat: event.output_format ?? outputFormat,
        provider: DEFAULT_IMAGE_PROVIDER,
        model: requestedModel
      });
    }

    if (event.type === "image_generation.completed" && event.b64_json) {
      completed = event;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) {
      await consumeEvent(event);
    }
    if (done) break;
  }
  if (buffer.trim()) await consumeEvent(buffer);

  if (!completed?.b64_json) {
    throw new Error("OpenAI image generation stream completed without a final image.");
  }

  return {
    b64Json: completed.b64_json,
    revisedPrompt: completed.revised_prompt,
    model: requestedModel,
    size: completed.size ?? size,
    quality: completed.quality ?? quality,
    outputFormat: completed.output_format ?? outputFormat,
    outputCompression,
    usage: completed.usage ?? null,
    provider: DEFAULT_IMAGE_PROVIDER
  };
}

function shouldTryFallbackImageModel({ model, fallbackModel, body }) {
  return (
    Boolean(fallbackModel) &&
    model !== fallbackModel &&
    body.includes("must be verified") &&
    body.includes(model)
  );
}
