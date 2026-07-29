import {
  bodyResponse,
  jsonResponse,
  redirectResponse
} from "../../platform/http/fetchResponses.ts";
import {
  normalizeContext,
  normalizePlace,
  readRequestObject,
  type PlaceImageHttpContext
} from "./placeImageHttpContext.ts";
import type {
  PlaceImageHttpHandlers
} from "./placeImageHttpTypes.ts";

type MediaHandlers = Pick<
  PlaceImageHttpHandlers,
  | "handleFeedbackRequest"
  | "handleImageRequest"
  | "handleResetRequest"
>;

export function createPlaceImageMediaHttpHandlers(
  context: PlaceImageHttpContext
): MediaHandlers {
  return {
    async handleImageRequest(url) {
      const countrySlug = String(
        url.searchParams.get("countrySlug") ?? ""
      )
        .trim()
        .toLowerCase();
      const place = normalizePlace(
        url.searchParams.get("place")
      );
      const imageContext = normalizeContext(
        url.searchParams.get("context")
      );
      const feedback = context.normalizeFeedback(
        url.searchParams.get("feedback")
      );
      const kind = String(
        url.searchParams.get("kind") ?? ""
      )
        .trim()
        .toLowerCase();
      const tags = String(
        url.searchParams.get("tags") ?? ""
      )
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
      const country =
        context.findCountry(countrySlug);
      if (!country || !place) {
        return context.respondNotFound(
          "unknown-country-or-place"
        );
      }

      const record = await context.resolveImage(
        country,
        place,
        {
          context: imageContext,
          kind,
          tags,
          feedback
        }
      );
      if (!record?.imageUrl) {
        return context.respondNotFound(
          record?.reason ?? "no-image-found"
        );
      }
      const cachedImage =
        await context.readCachedImage(
          record.imageUrl
        );
      const headers = {
        "Cache-Control": "no-store",
        "X-RoamAtlas-Image-Source":
          context.toSafeHeaderValue(
            record.source
          ),
        "X-RoamAtlas-Image-Page":
          context.toSafeHeaderValue(
            record.sourceUrl
          )
      };
      if (cachedImage) {
        return bodyResponse(
          Uint8Array.from(cachedImage.bytes),
          200,
          {
            "Content-Type":
              context.mimeTypeForImagePath(
                cachedImage.filePath
              ),
            ...headers
          }
        );
      }
      return redirectResponse(
        record.imageUrl,
        302,
        headers
      );
    },

    async handleResetRequest(request) {
      const body = await readRequestObject(request);
      const country = context.findCountry(
        body.countrySlug
      );
      const place = normalizePlace(body.place);
      if (!country) {
        const countrySlug = String(
          body.countrySlug ?? ""
        )
          .trim()
          .toLowerCase();
        return jsonResponse(
          {
            error: `Unknown country: ${countrySlug}`
          },
          404
        );
      }
      const result = place
        ? await context.resetPlaceImage(
            country,
            place
          )
        : await context.resetCountryImages(
            country
          );
      return jsonResponse({
        countrySlug: country.slug,
        countryName: country.name,
        ...result
      });
    },

    async handleFeedbackRequest(request) {
      const body = await readRequestObject(request);
      const country = context.findCountry(
        body.countrySlug
      );
      const place = normalizePlace(body.place);
      const feedback =
        context.normalizeFeedback(body.feedback);
      if (!country || !place || !feedback) {
        return jsonResponse(
          {
            error:
              "A country, place, and photo feedback are required."
          },
          400
        );
      }
      const result =
        await context.resetPlaceImage(
          country,
          place,
          { preserveHistory: true }
        );
      return jsonResponse({
        countrySlug: country.slug,
        countryName: country.name,
        feedback,
        ...result,
        factBoundary:
          "Photo feedback is used only to refine the external reference-image search. Curated travel data was not changed."
      });
    }
  };
}
