import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import {
  createCountryDraftHttpContext
} from "./countryDraftHttpContext.ts";
import {
  createCountryDraftInfluenceHttpHandler
} from "./countryDraftInfluenceHttpHandler.ts";
import {
  createCountryDraftReadHttpHandler
} from "./countryDraftReadHttpHandler.ts";
import {
  createCountryDraftReviewHttpHandlers
} from "./countryDraftReviewHttpHandlers.ts";
import type {
  CountryDraftHttpDependencies,
  CountryDraftHttpHandlers
} from "./countryDraftHttpTypes.ts";

export type {
  CountryDraftHttpDependencies,
  CountryDraftHttpHandlers
} from "./countryDraftHttpTypes.ts";

export function createCountryDraftRoutes(
  handlers: CountryDraftHttpHandlers
): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(
      app,
      "GET",
      "/api/country-draft",
      (context) =>
        handlers.handleDraftRequest(
          new URL(context.req.url)
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/country-draft/influence",
      (context) =>
        handlers.handleInfluenceRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/country-draft/confirm",
      (context) =>
        handlers.handleConfirmRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/country-draft/reorder",
      (context) =>
        handlers.handleReorderRequest(
          context.req.raw
        )
    );
    registerHonoRoute(
      app,
      "POST",
      "/api/country-draft/approve-item",
      (context) =>
        handlers.handleApprovalRequest(
          context.req.raw
        )
    );
  };
}

/**
 * Composes read, GenAI-influence, and human-review workflows behind the stable
 * country-draft route boundary.
 */
export function createCountryDraftHttpHandlers<
  CountryPack extends {
    confidence?: unknown;
  }
>(
  dependencies:
    CountryDraftHttpDependencies<CountryPack>
): CountryDraftHttpHandlers {
  const context =
    createCountryDraftHttpContext(
      dependencies
    );
  return {
    ...createCountryDraftReadHttpHandler(
      context
    ),
    ...createCountryDraftInfluenceHttpHandler(
      context
    ),
    ...createCountryDraftReviewHttpHandlers(
      context
    )
  };
}
