import { APP_CONFIG } from "../../../config/appConfig";
import type { LandingVariantProps } from "../landingVariantTypes";

export function countryPhotoUrl(slug: string) {
  const config = APP_CONFIG.countryCatalog;
  const extension = config.localAssetExtensionOverrides[slug as keyof typeof config.localAssetExtensionOverrides] ?? config.localAssetExtension;
  return `${config.localAssetBasePath}/${slug}.${extension}`;
}

export function countryPackLabel(pack: LandingVariantProps["countryPacks"][string]) {
  if (pack?.registration === "source_controlled" && pack.confidence === "confirmed") return "Source-reviewed atlas";
  if (pack?.registration === "source_controlled" || pack?.registration === "runtime_draft") return "Starter atlas · unverified";
  return "Create a starter atlas";
}
