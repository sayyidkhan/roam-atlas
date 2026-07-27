import {
  bodyResponse,
  jsonResponse,
  redirectResponse
} from "../../platform/http/fetchResponses.js";
import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";
import { toSafeHeaderValue } from "../../platform/http/safeHeaderValue.js";

export function createCountryImageRoutes(dependencies) {
  return (app) => {
    registerHonoRoute(
      app,
      ["GET", "HEAD"],
      "/api/country-image",
      (context) =>
        handleCountryImageHttpRequest({
          ...dependencies,
          url: new URL(context.req.url),
          isHeadRequest: context.req.method === "HEAD"
        })
    );
  };
}

export async function handleCountryImageHttpRequest({
  url,
  isHeadRequest = false,
  getCountryBySlug,
  resolveImage,
  isLocalImageUrl
}) {
  const countrySlug = String(
    url.searchParams.get("countrySlug") ?? ""
  )
    .trim()
    .toLowerCase();
  const country = getCountryBySlug(countrySlug);
  if (!country) return respondNotFound(null);

  const image = await resolveImage(country);
  if (!image?.imageUrl) return respondNotFound(country);

  const location = withCacheVersion(
    image.imageUrl,
    url.searchParams.get("v"),
    isLocalImageUrl
  );
  const headers = {
    "Cache-Control": "public, max-age=86400",
    "X-RoamAtlas-Image-Source": image.source,
    "X-RoamAtlas-Image-Page": toSafeHeaderValue(image.pageTitle)
  };
  return isHeadRequest
    ? bodyResponse(null, 302, { Location: location, ...headers })
    : redirectResponse(location, 302, headers);
}

function withCacheVersion(imageUrl, version, isLocalImageUrl) {
  const cleanVersion = String(version ?? "").trim();
  if (!cleanVersion || !isLocalImageUrl(imageUrl)) return imageUrl;
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}v=${encodeURIComponent(cleanVersion)}`;
}

function respondNotFound(country) {
  return jsonResponse({
    error: country
      ? `No country media image found for ${country.name}`
      : "Unknown country"
  }, 404, {
    "Cache-Control": "no-store",
    "X-RoamAtlas-Image-Source": "not-found"
  });
}
