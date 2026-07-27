import { APP_CONFIG } from "../../config/appConfig.js";

export function normalizeImageQuality(
  value: unknown,
  fallback = APP_CONFIG.imageQuality.defaultValue
) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return APP_CONFIG.imageQuality.options.some((option) => option.value === normalized)
    ? normalized
    : fallback;
}

export function imageQualityLabel(value: unknown) {
  return APP_CONFIG.imageQuality.options.find((option) => option.value === value)?.label ?? "High";
}
