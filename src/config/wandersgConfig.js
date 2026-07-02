export const WANDERSG_CONFIG = {
  ai: {
    textModel: "gpt-4.1-mini",
    vlmModel: "gpt-4.1-mini",
    environmentModel: "gpt-5.5",
    environmentFallbackModel: "gpt-4.1-mini"
  },
  image: {
    provider: "openai",
    model: "gpt-image-2",
    fallbackModel: "gpt-image-1",
    size: "1536x1024"
  },
  server: {
    port: 4173
  }
};

export function resolveWandersgConfig(env = {}) {
  return {
    ai: { ...WANDERSG_CONFIG.ai },
    image: { ...WANDERSG_CONFIG.image },
    server: {
      port: Number(readConfigValue(env.PORT, WANDERSG_CONFIG.server.port))
    }
  };
}

function readConfigValue(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}
