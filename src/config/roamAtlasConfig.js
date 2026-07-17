export const ROAMATLAS_CONFIG = {
  ai: {
    textModel: "gpt-5.4-mini",
    vlmModel: "gpt-5.4-mini",
    environmentModel: "gpt-5.5"
  },
  image: {
    provider: "openai",
    model: "gpt-image-2",
    fallbackModel: null,
    // Use the widest landscape size supported by the Images API. The browser
    // preserves this 3:2 composition so generated pixels are not cropped.
    size: "1536x1024",
    // Prefer the best visual result by default. The config UI can lower this
    // per browser when faster generation is more important than detail.
    quality: "high",
    // RoamAtlas artwork is opaque. JPEG materially reduces transfer and decode
    // work compared with the previous multi-megabyte PNG output.
    outputFormat: "jpeg",
    outputCompression: 82,
    // The first partial is a perception aid, not a fact source or final asset.
    partialImages: 1
  },
  server: {
    port: 4150
  }
};

export function resolveRoamAtlasConfig(env = {}) {
  return {
    ai: { ...ROAMATLAS_CONFIG.ai },
    image: {
      ...ROAMATLAS_CONFIG.image,
      quality: normalizeImageQuality(
        readConfigValue(env.ROAMATLAS_IMAGE_QUALITY, ROAMATLAS_CONFIG.image.quality)
      )
    },
    server: {
      port: Number(readConfigValue(env.PORT, ROAMATLAS_CONFIG.server.port))
    }
  };
}

function normalizeImageQuality(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalized)
    ? normalized
    : ROAMATLAS_CONFIG.image.quality;
}

function readConfigValue(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}
