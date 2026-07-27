import {
  bodyResponse,
  jsonResponse,
  redirectResponse
} from "../../platform/http/fetchResponses.js";
import { registerHonoRoute } from "../../platform/http/honoRoutes.ts";
import { readJsonRequest } from "../../platform/http/readJsonRequest.js";

export function createPlaceImageRoutes(handlers) {
  return (app) => {
    registerHonoRoute(app, ["GET", "HEAD"], "/api/place-image", (context) =>
      handlers.handleImageRequest(new URL(context.req.url))
    );
    registerHonoRoute(app, "POST", "/api/place-image/reset", (context) =>
      handlers.handleResetRequest(context.req.raw)
    );
    registerHonoRoute(app, "POST", "/api/place-image/feedback", (context) =>
      handlers.handleFeedbackRequest(context.req.raw)
    );
    registerHonoRoute(app, "POST", "/api/place-image/suggestions", (context) =>
      handlers.handleSuggestionsRequest(context.req.raw)
    );
    registerHonoRoute(app, "GET", "/api/place-image/history", (context) =>
      handlers.handleHistoryRequest(new URL(context.req.url))
    );
    registerHonoRoute(app, "POST", "/api/place-image/history/select", (context) =>
      handlers.handleHistorySelectionRequest(context.req.raw)
    );
    registerHonoRoute(app, "POST", "/api/place-image/history/delete", (context) =>
      handlers.handleHistoryDeleteRequest(context.req.raw)
    );
  };
}

/**
 * HTTP policy for optional external reference photos. Provider search, local
 * file access, and history storage are injected adapters. This feature keeps
 * the factual boundary explicit: reference media and feedback are never facts.
 */
export function createPlaceImageHttpHandlers(dependencies) {
  const {
    getCountryBySlug,
    normalizeFeedback,
    respondNotFound,
    resolveImage,
    readCachedImage,
    mimeTypeForImagePath,
    toSafeHeaderValue,
    resetPlaceImage,
    resetCountryImages,
    getSuggestionContext,
    suggestPrompts,
    readHistory,
    toHistoryItem,
    selectHistoryEntry,
    deleteHistoryEntry,
    factBoundary
  } = dependencies;
  const normalizePlace = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const findCountry = (value) => getCountryBySlug(String(value ?? "").trim().toLowerCase());

  return {
    async handleImageRequest(url) {
      const countrySlug = String(url.searchParams.get("countrySlug") ?? "").trim().toLowerCase();
      const place = normalizePlace(url.searchParams.get("place"));
      const context = String(url.searchParams.get("context") ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
      const feedback = normalizeFeedback(url.searchParams.get("feedback"));
      const kind = String(url.searchParams.get("kind") ?? "").trim().toLowerCase();
      const tags = String(url.searchParams.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
      const country = findCountry(countrySlug);
      if (!country || !place) return respondNotFound("unknown-country-or-place");

      const record = await resolveImage(country, place, { context, kind, tags, feedback });
      if (!record?.imageUrl) return respondNotFound(record?.reason ?? "no-image-found");
      const cachedImage = await readCachedImage(record.imageUrl);
      if (cachedImage) {
        return bodyResponse(cachedImage.bytes, 200, {
          "Content-Type": mimeTypeForImagePath(cachedImage.filePath),
          "Cache-Control": "no-store",
          "X-RoamAtlas-Image-Source": toSafeHeaderValue(record.source),
          "X-RoamAtlas-Image-Page": toSafeHeaderValue(record.sourceUrl)
        });
      }
      return redirectResponse(record.imageUrl, 302, {
        "Cache-Control": "no-store",
        "X-RoamAtlas-Image-Source": toSafeHeaderValue(record.source),
        "X-RoamAtlas-Image-Page": toSafeHeaderValue(record.sourceUrl)
      });
    },

    async handleResetRequest(request) {
      const body = await readJsonRequest(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      if (!country) return jsonResponse({ error: `Unknown country: ${String(body.countrySlug ?? "").trim().toLowerCase()}` }, 404);
      const result = place
        ? await resetPlaceImage(country, place)
        : await resetCountryImages(country);
      return jsonResponse({ countrySlug: country.slug, countryName: country.name, ...result });
    },

    async handleFeedbackRequest(request) {
      const body = await readJsonRequest(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const feedback = normalizeFeedback(body.feedback);
      if (!country || !place || !feedback) {
        return jsonResponse({ error: "A country, place, and photo feedback are required." }, 400);
      }
      const result = await resetPlaceImage(country, place, { preserveHistory: true });
      return jsonResponse({
        countrySlug: country.slug,
        countryName: country.name,
        place,
        feedback,
        ...result,
        factBoundary: "Photo feedback is used only to refine the external reference-image search. Curated travel data was not changed."
      });
    },

    async handleSuggestionsRequest(request) {
      const body = await readJsonRequest(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const kind = String(body.kind ?? "region").replace(/[^a-z-]/gi, "").trim().toLowerCase().slice(0, 32) || "region";
      const currentFeedback = normalizeFeedback(body.currentFeedback);
      const mappedLocation = getSuggestionContext(country, place);
      if (!country || !place || !mappedLocation) {
        return jsonResponse({ error: "A country and a mapped place are required." }, 400);
      }
      const result = await suggestPrompts(country, {
        place: mappedLocation.title,
        context: mappedLocation.children,
        kind: mappedLocation.kind ?? kind,
        currentFeedback
      });
      return jsonResponse({
        countrySlug: country.slug,
        place,
        suggestions: result.suggestions,
        source: result.source,
        factBoundary: "Prompt suggestions only steer an external reference-image search. They are not travel facts."
      }, 200, { "Cache-Control": "no-store" });
    },

    async handleHistoryRequest(url) {
      const country = findCountry(url.searchParams.get("countrySlug"));
      const place = normalizePlace(url.searchParams.get("place"));
      if (!country || !place) return jsonResponse({ error: "A country and place are required." }, 400);
      const history = await readHistory(country, place);
      return jsonResponse({
        countrySlug: country.slug,
        place,
        items: history.map(toHistoryItem),
        factBoundary
      }, 200, { "Cache-Control": "no-store" });
    },

    async handleHistorySelectionRequest(request) {
      const body = await readJsonRequest(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const entryId = String(body.entryId ?? "").trim();
      if (!country || !place || !entryId) {
        return jsonResponse({ error: "A country, place, and saved photo are required." }, 400);
      }
      const result = await selectHistoryEntry(country, place, entryId);
      return jsonResponse({ countrySlug: country.slug, place, ...result });
    },

    async handleHistoryDeleteRequest(request) {
      const body = await readJsonRequest(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const entryId = String(body.entryId ?? "").trim();
      if (!country || !place || !entryId) {
        return jsonResponse({ error: "A country, place, and saved photo are required." }, 400);
      }
      const result = await deleteHistoryEntry(country, place, entryId);
      return jsonResponse({ countrySlug: country.slug, place, ...result });
    }
  };
}
