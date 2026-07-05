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
    size: "1536x1024"
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
