import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROVIDER,
  generateTileImageWithOpenAI,
  normalizeImageModel
} from "../../domain/imageProvider.js";

export function createConfiguredImageProvider({
  apiKey,
  imageConfig,
  providerConcurrency
}) {
  function normalizeQuality(value) {
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
