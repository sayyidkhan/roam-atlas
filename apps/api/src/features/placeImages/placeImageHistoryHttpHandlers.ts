import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  normalizePlace,
  readRequestObject,
  savedPhotoRequiredResponse,
  type PlaceImageHttpContext
} from "./placeImageHttpContext.ts";
import type {
  PlaceImageHttpHandlers
} from "./placeImageHttpTypes.ts";

type HistoryHandlers = Pick<
  PlaceImageHttpHandlers,
  | "handleHistoryDeleteRequest"
  | "handleHistoryRequest"
  | "handleHistorySelectionRequest"
>;

export function createPlaceImageHistoryHttpHandlers(
  context: PlaceImageHttpContext
): HistoryHandlers {
  return {
    async handleHistoryRequest(url) {
      const country = context.findCountry(
        url.searchParams.get("countrySlug")
      );
      const place = normalizePlace(
        url.searchParams.get("place")
      );
      if (!country || !place) {
        return jsonResponse(
          {
            error:
              "A country and place are required."
          },
          400
        );
      }
      const history = await context.readHistory(
        country,
        place
      );
      return jsonResponse(
        {
          countrySlug: country.slug,
          place,
          items: history.map(
            context.toHistoryItem
          ),
          factBoundary: context.factBoundary
        },
        200,
        { "Cache-Control": "no-store" }
      );
    },

    async handleHistorySelectionRequest(request) {
      const body = await readRequestObject(request);
      const country = context.findCountry(
        body.countrySlug
      );
      const place = normalizePlace(body.place);
      const entryId = String(
        body.entryId ?? ""
      ).trim();
      if (!country || !place || !entryId) {
        return savedPhotoRequiredResponse();
      }
      const result =
        await context.selectHistoryEntry(
          country,
          place,
          entryId
        );
      return jsonResponse({
        countrySlug: country.slug,
        place,
        ...result
      });
    },

    async handleHistoryDeleteRequest(request) {
      const body = await readRequestObject(request);
      const country = context.findCountry(
        body.countrySlug
      );
      const place = normalizePlace(body.place);
      const entryId = String(
        body.entryId ?? ""
      ).trim();
      if (!country || !place || !entryId) {
        return savedPhotoRequiredResponse();
      }
      const result =
        await context.deleteHistoryEntry(
          country,
          place,
          entryId
        );
      return jsonResponse({
        countrySlug: country.slug,
        place,
        ...result
      });
    }
  };
}
