export type ConfiguredImageQuality =
  | "low"
  | "medium"
  | "high";

export type RoamAtlasConfig = {
  ai: {
    environmentModel: string;
    textModel: string;
    vlmModel: string;
  };
  image: {
    fallbackModel: string | null;
    model: string;
    outputCompression: number;
    outputFormat: "jpeg";
    partialImages: number;
    provider: "openai";
    quality: ConfiguredImageQuality;
    size: string;
  };
  server: {
    host: string;
    port: number;
  };
};

export type RoamAtlasConfigEnvironment =
  Record<string, unknown>;

export const ROAMATLAS_CONFIG = {
  ai: {
    textModel: "gpt-5.4-mini",
    vlmModel: "gpt-5.4-mini",
    environmentModel: "gpt-5.5"
  },
  image: {
    provider: "openai",
    model: "gpt-image-2.5-flare-2026-09-08",
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
    host: "127.0.0.1",
    port: 4151
  }
} satisfies RoamAtlasConfig;

export function resolveRoamAtlasConfig(
  env: RoamAtlasConfigEnvironment = {}
): RoamAtlasConfig {
  return {
    ai: { ...ROAMATLAS_CONFIG.ai },
    image: {
      ...ROAMATLAS_CONFIG.image,
      quality: normalizeImageQuality(
        readConfigValue(
          env.ROAMATLAS_IMAGE_QUALITY,
          ROAMATLAS_CONFIG.image.quality
        )
      )
    },
    server: {
      host: String(
        readConfigValue(
          env.HOST,
          ROAMATLAS_CONFIG.server.host
        )
      ),
      port: Number(
        readConfigValue(
          env.PORT,
          ROAMATLAS_CONFIG.server.port
        )
      )
    }
  };
}

function normalizeImageQuality(
  value: unknown
): ConfiguredImageQuality {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return isConfiguredImageQuality(normalized)
    ? normalized
    : ROAMATLAS_CONFIG.image.quality;
}

function isConfiguredImageQuality(
  value: string
): value is ConfiguredImageQuality {
  return ["low", "medium", "high"].includes(value);
}

function readConfigValue<T extends string | number>(
  value: unknown,
  fallback: T
): string | T {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}
