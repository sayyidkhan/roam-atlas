import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROVIDER,
  normalizeImageModel
} from "../../domain/imageGenerationPolicy.ts";
import {
  generateTileImageWithOpenAI,
  type GenerateImageOptions,
  type GeneratedImage
} from "../../platform/openai/openAiImageProvider.ts";

type ConfiguredImageProviderConfig = {
  model?: unknown;
  fallbackModel?: unknown;
  size: string;
  quality: string;
  outputFormat: unknown;
  outputCompression: unknown;
  partialImages: unknown;
};

type ConfiguredImageProviderOptions = {
  apiKey?: string | null;
  imageConfig: ConfiguredImageProviderConfig;
  providerConcurrency: number;
};

type GenerateConfiguredImageOptions = Pick<
  GenerateImageOptions,
  "model" | "prompt" | "onPartialImage" | "signal"
> & {
  quality?: unknown;
};

export function createConfiguredImageProvider({
  apiKey,
  imageConfig,
  providerConcurrency
}: ConfiguredImageProviderOptions): {
  model: string;
  provider: string;
  isConfigured: boolean;
  canAutoProcess: boolean;
  normalizeQuality: (value: unknown) => string;
  generate: (options: GenerateConfiguredImageOptions) => Promise<GeneratedImage>;
} {
  function normalizeQuality(value: unknown): string {
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["low", "medium", "high"].includes(normalized)
      ? normalized
      : imageConfig.quality;
  }

  return {
    model: normalizeImageModel(imageConfig.model ?? DEFAULT_IMAGE_MODEL),
    provider: DEFAULT_IMAGE_PROVIDER,
    isConfigured: Boolean(apiKey),
    canAutoProcess: Boolean(apiKey) && providerConcurrency > 0,
    normalizeQuality,

    async generate({
      model,
      prompt,
      quality = imageConfig.quality,
      onPartialImage,
      signal = null
    }) {
      return generateTileImageWithOpenAI({
        apiKey,
        model,
        prompt,
        fallbackModel: imageConfig.fallbackModel,
        size: imageConfig.size,
        quality: normalizeQuality(quality),
        outputFormat: imageConfig.outputFormat,
        outputCompression: imageConfig.outputCompression,
        partialImages: imageConfig.partialImages,
        onPartialImage,
        signal
      });
    }
  };
}
