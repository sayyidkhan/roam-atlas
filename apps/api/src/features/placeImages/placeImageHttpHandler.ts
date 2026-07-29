import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import {
  createPlaceImageHistoryHttpHandlers
} from "./placeImageHistoryHttpHandlers.ts";
import {
  createPlaceImageHttpContext
} from "./placeImageHttpContext.ts";
import {
  createPlaceImageMediaHttpHandlers
} from "./placeImageMediaHttpHandlers.ts";
import {
  createPlaceImageSuggestionHttpHandler
} from "./placeImageSuggestionHttpHandler.ts";
import type {
  PlaceImageHttpDependencies,
  PlaceImageHttpHandlers
} from "./placeImageHttpTypes.ts";

export type {
  PlaceImageHttpDependencies,
  PlaceImageHttpHandlers
} from "./placeImageHttpTypes.ts";

export function createPlaceImageRoutes(
  handlers: PlaceImageHttpHandlers
): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(
      app,
      ["GET", "HEAD"],
      "/api/place-image",
      (context) =>
        handlers.handleImageRequest(
          new URL(context.req.url)
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/place-image/reset",
      (context) =>
        handlers.handleResetRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/place-image/feedback",
      (context) =>
        handlers.handleFeedbackRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/place-image/suggestions",
      (context) =>
        handlers.handleSuggestionsRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "GET",
      "/api/place-image/history",
      (context) =>
        handlers.handleHistoryRequest(
          new URL(context.req.url)
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/place-image/history/select",
      (context) =>
        handlers.handleHistorySelectionRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/place-image/history/delete",
      (context) =>
        handlers.handleHistoryDeleteRequest(
          context.req.raw
        )
    );
  };
}

/**
 * Composes separate media, suggestion, and history HTTP workflows behind the
 * stable place-image route boundary.
 */
export function createPlaceImageHttpHandlers(
  dependencies: PlaceImageHttpDependencies
): PlaceImageHttpHandlers {
  const context =
    createPlaceImageHttpContext(dependencies);
  return {
    ...createPlaceImageMediaHttpHandlers(
      context
    ),
    ...createPlaceImageSuggestionHttpHandler(
      context
    ),
    ...createPlaceImageHistoryHttpHandlers(
      context
    )
  };
}
