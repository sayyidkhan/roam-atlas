import { ROAMATLAS_CONFIG } from "../../config/roamAtlasConfig.ts";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_OUTPUT_COMPRESSION,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  DEFAULT_IMAGE_PARTIAL_IMAGES,
  DEFAULT_IMAGE_PROVIDER,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_IMAGE_SIZE,
  normalizeImageCompression,
  normalizeImageModel,
  normalizeImageOutputFormat,
  normalizeImageQuality,
  normalizeImageRequestTimeout,
  resolveImageRequestTimeoutMs,
  type ImageOutputFormat,
  type ImageQuality
} from "../../domain/imageGenerationPolicy.ts";

type ImageUsage = Record<string, unknown> | null;

export type GeneratedImage = {
  b64Json: string;
  revisedPrompt?: string;
  model: string;
  size: string;
  quality: string;
  outputFormat: ImageOutputFormat;
  outputCompression?: number;
  usage: ImageUsage;
  provider: string;
};

export type PartialGeneratedImage = Omit<
  GeneratedImage,
  "revisedPrompt" | "outputCompression" | "usage"
> & {
  partialImageIndex: number;
};

export type GenerateImageOptions = {
  apiKey?: string | null;
  model?: unknown;
  prompt: string;
  fallbackModel?: unknown;
  size?: string;
  quality?: unknown;
  outputFormat?: unknown;
  outputCompression?: unknown;
  partialImages?: unknown;
  onPartialImage?: ((image: PartialGeneratedImage) => void | Promise<void>) | null;
  requestTimeoutMs?: unknown;
  signal?: AbortSignal | null;
};

type OpenAiImagePayload = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  output_format?: ImageOutputFormat;
  quality?: string;
  usage?: Record<string, unknown>;
};

type OpenAiImageStreamEvent = {
  type?: string;
  b64_json?: string;
  partial_image_index?: number;
  revised_prompt?: string;
  size?: string;
  quality?: string;
  output_format?: ImageOutputFormat;
  usage?: Record<string, unknown>;
};

type OpenAiImageRequestBody = {
  model: string;
  prompt: string;
  size: string;
  quality: ImageQuality;
  output_format: ImageOutputFormat;
  n: 1;
  output_compression?: number;
  stream?: true;
  partial_images?: number;
};

export class ImageProviderNotConfiguredError extends Error {
  constructor(model = DEFAULT_IMAGE_MODEL) {
    super(
      `OpenAI image generation is not configured. Preferred model is ${model}; set OPENAI_API_KEY before generating tiles.`
    );
    this.name = "ImageProviderNotConfiguredError";
  }
}

export class ImageProviderRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs: number;

  constructor(status: number, body: string, retryAfterMs: number) {
    super(`OpenAI image generation failed: ${status} ${body}`);
    this.name = "ImageProviderRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
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
}: GenerateImageOptions): Promise<GeneratedImage> {
  const requestedModel = normalizeImageModel(model);
  const requestedFallbackModel = fallbackModel
    ? normalizeImageModel(fallbackModel)
    : null;
  const requestedFormat = normalizeImageOutputFormat(outputFormat);
  const partialImageCount = Number.parseInt(String(partialImages), 10);
  const shouldStream =
    partialImageCount > 0 && typeof onPartialImage === "function";

  if (!apiKey) {
    throw new ImageProviderNotConfiguredError(requestedModel);
  }

  const requestBody: OpenAiImageRequestBody = {
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
          stream: true as const,
          partial_images: Math.min(3, Math.max(1, partialImageCount || 1))
        }
      : {})
  };

  const requestAbort = createImageRequestAbortContext(
    signal,
    resolveImageRequestTimeoutMs({
      quality: requestBody.quality,
      requestTimeoutMs
    })
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

    requestAbort.clearRequestTimeout();

    if (!response.ok) {
      const body = await response.text();
      if (
        shouldTryFallbackImageModel({
          model: requestedModel,
          fallbackModel: requestedFallbackModel,
          body
        })
      ) {
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
      throw new ImageProviderRequestError(
        response.status,
        body,
        parseRetryAfterMs(response.headers.get("retry-after"))
      );
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

    const payload = (await response.json()) as OpenAiImagePayload;
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

export function parseRetryAfterMs(
  value: string | null | undefined,
  now = Date.now()
): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const retryAt = Date.parse(raw);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : 0;
}

export function createImageRequestAbortContext(
  externalSignal: AbortSignal | null | undefined,
  requestTimeoutMs: unknown
): {
  signal: AbortSignal;
  clearRequestTimeout: () => void;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
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
    if (!controller.signal.aborted) {
      controller.abort(externalSignal?.reason);
    }
  };
  if (externalSignal?.aborted) {
    forwardExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", forwardExternalAbort, {
      once: true
    });
  }

  return {
    signal: controller.signal,
    clearRequestTimeout,
    dispose() {
      clearRequestTimeout();
      externalSignal?.removeEventListener("abort", forwardExternalAbort);
    }
  };
}

async function readStreamingImageResponse(
  response: Response,
  {
    requestedModel,
    size,
    quality,
    outputFormat,
    outputCompression,
    onPartialImage
  }: {
    requestedModel: string;
    size: string;
    quality: ImageQuality;
    outputFormat: ImageOutputFormat;
    outputCompression?: number;
    onPartialImage: (image: PartialGeneratedImage) => void | Promise<void>;
  }
): Promise<GeneratedImage> {
  if (!response.body) {
    throw new Error(
      "OpenAI image generation streaming returned no response body."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: OpenAiImageStreamEvent | null = null;

  const consumeEvent = async (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return;

    let event: OpenAiImageStreamEvent;
    try {
      event = JSON.parse(data) as OpenAiImageStreamEvent;
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

  const finalImage = completed as OpenAiImageStreamEvent | null;
  if (!finalImage?.b64_json) {
    throw new Error(
      "OpenAI image generation stream completed without a final image."
    );
  }

  return {
    b64Json: finalImage.b64_json,
    revisedPrompt: finalImage.revised_prompt,
    model: requestedModel,
    size: finalImage.size ?? size,
    quality: finalImage.quality ?? quality,
    outputFormat: finalImage.output_format ?? outputFormat,
    outputCompression,
    usage: finalImage.usage ?? null,
    provider: DEFAULT_IMAGE_PROVIDER
  };
}

function shouldTryFallbackImageModel({
  model,
  fallbackModel,
  body
}: {
  model: string;
  fallbackModel: string | null;
  body: string;
}): boolean {
  return (
    Boolean(fallbackModel) &&
    model !== fallbackModel &&
    body.includes("must be verified") &&
    body.includes(model)
  );
}
