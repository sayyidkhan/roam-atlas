import {
  bodyResponse,
  jsonResponse,
  redirectResponse
} from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import { toSafeHeaderValue } from "../../platform/http/safeHeaderValue.ts";
import type {
  CountryImageCountry,
  CountryImageRecord
} from "./countryImageTypes.ts";

type CountryImageHttpDependencies = {
  getCountryBySlug: (
    countrySlug: string
  ) => CountryImageCountry | null | undefined;
  isLocalImageUrl: (imageUrl: string) => boolean;
  resolveImage: (
    country: CountryImageCountry
  ) => Promise<CountryImageRecord | null>;
};

type CountryImageHttpRequestDependencies =
  CountryImageHttpDependencies & {
    isHeadRequest?: boolean;
    url: URL;
  };

export function createCountryImageRoutes(
  dependencies: CountryImageHttpDependencies
): HonoRouteRegistrar {
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
}: CountryImageHttpRequestDependencies): Promise<Response> {
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

function withCacheVersion(
  imageUrl: string,
  version: string | null,
  isLocalImageUrl: (imageUrl: string) => boolean
): string {
  const cleanVersion = String(version ?? "").trim();
  if (!cleanVersion || !isLocalImageUrl(imageUrl)) return imageUrl;
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}v=${encodeURIComponent(cleanVersion)}`;
}

function respondNotFound(
  country: CountryImageCountry | null
): Response {
  return jsonResponse(
    {
      error: country
        ? `No country media image found for ${country.name}`
        : "Unknown country"
    },
    404,
    {
      "Cache-Control": "no-store",
      "X-RoamAtlas-Image-Source": "not-found"
    }
  );
}
