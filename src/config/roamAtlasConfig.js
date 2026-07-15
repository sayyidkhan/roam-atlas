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
    // Auto can select the slowest quality tier. Medium is the default interactive
    // balance; reviewed core artwork can still be generated at a higher tier.
    quality: "medium",
    // RoamAtlas artwork is opaque. JPEG materially reduces transfer and decode
    // work compared with the previous multi-megabyte PNG output.
    outputFormat: "jpeg",
    outputCompression: 82,
    // The first partial is a perception aid, not a fact source or final asset.
    partialImages: 1
  },
  server: {
    port: 4173
  }
};

export function resolveRoamAtlasConfig(env = {}) {
  return {
    ai: { ...ROAMATLAS_CONFIG.ai },
    image: { ...ROAMATLAS_CONFIG.image },
    server: {
      port: Number(readConfigValue(env.PORT, ROAMATLAS_CONFIG.server.port))
    }
  };
}

function readConfigValue(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}
