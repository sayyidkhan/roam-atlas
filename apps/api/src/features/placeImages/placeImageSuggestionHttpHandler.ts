import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  mappedPlaceRequiredResponse,
  normalizeKind,
  normalizePlace,
  readRequestObject,
  type PlaceImageHttpContext
} from "./placeImageHttpContext.ts";
import type {
  PlaceImageHttpHandlers
} from "./placeImageHttpTypes.ts";

export function createPlaceImageSuggestionHttpHandler(
  context: PlaceImageHttpContext
): Pick<
  PlaceImageHttpHandlers,
  "handleSuggestionsRequest"
> {
  return {
    async handleSuggestionsRequest(request) {
      const body = await readRequestObject(request);
      const country = context.findCountry(
        body.countrySlug
      );
      const place = normalizePlace(body.place);
      const kind = normalizeKind(body.kind);
      const currentFeedback =
        context.normalizeFeedback(
          body.currentFeedback
        );
      if (!country || !place) {
        return mappedPlaceRequiredResponse();
      }
      const mappedLocation =
        context.getSuggestionContext(
          country,
          place
        );
      if (!mappedLocation) {
        return mappedPlaceRequiredResponse();
      }
      const result = await context.suggestPrompts(
        country,
        {
          place: mappedLocation.title,
          context: mappedLocation.children,
          kind: mappedLocation.kind || kind,
          currentFeedback
        }
      );
      return jsonResponse(
        {
          countrySlug: country.slug,
          place,
          suggestions: result.suggestions,
          source: result.source,
          factBoundary:
            "Prompt suggestions only steer an external reference-image search. They are not travel facts."
        },
        200,
        { "Cache-Control": "no-store" }
      );
    }
  };
}
