/**
 * HTTP policy for optional external reference photos. Provider search, local
 * file access, and history storage are injected adapters. This feature keeps
 * the factual boundary explicit: reference media and feedback are never facts.
 */
export function createPlaceImageHttpHandlers(dependencies) {
  const {
    readJson,
    getCountryBySlug,
    normalizeFeedback,
    respondNotFound,
    resolveImage,
    getImagePathFromUrl,
    readFile,
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
    async handleImageRequest(url, response) {
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
      if (!country || !place) return respondNotFound(response, "unknown-country-or-place");

      const record = await resolveImage(country, place, { context, kind, tags, feedback });
      if (!record?.imageUrl) return respondNotFound(response, record?.reason ?? "no-image-found");
      const cachedImagePath = getImagePathFromUrl(record.imageUrl);
      if (cachedImagePath) {
        try {
          const image = await readFile(cachedImagePath);
          response.writeHead(200, {
            "Content-Type": mimeTypeForImagePath(cachedImagePath),
            "Cache-Control": "no-store",
            "X-RoamAtlas-Image-Source": toSafeHeaderValue(record.source),
            "X-RoamAtlas-Image-Page": toSafeHeaderValue(record.sourceUrl)
          });
          response.end(image);
          return;
        } catch {
          // A manually deleted local artifact may leave metadata behind; use
          // the recorded URL so the browser's normal image error path remains.
        }
      }
      response.writeHead(302, {
        Location: record.imageUrl,
        "Cache-Control": "no-store",
        "X-RoamAtlas-Image-Source": toSafeHeaderValue(record.source),
        "X-RoamAtlas-Image-Page": toSafeHeaderValue(record.sourceUrl)
      });
      response.end();
    },

    async handleResetRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      if (!country) return sendJson(response, 404, { error: `Unknown country: ${String(body.countrySlug ?? "").trim().toLowerCase()}` });
      const result = place
        ? await resetPlaceImage(country, place)
        : await resetCountryImages(country);
      sendJson(response, 200, { countrySlug: country.slug, countryName: country.name, ...result });
    },

    async handleFeedbackRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const feedback = normalizeFeedback(body.feedback);
      if (!country || !place || !feedback) {
        return sendJson(response, 400, { error: "A country, place, and photo feedback are required." });
      }
      const result = await resetPlaceImage(country, place, { preserveHistory: true });
      sendJson(response, 200, {
        countrySlug: country.slug,
        countryName: country.name,
        place,
        feedback,
        ...result,
        factBoundary: "Photo feedback is used only to refine the external reference-image search. Curated travel data was not changed."
      });
    },

    async handleSuggestionsRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const kind = String(body.kind ?? "region").replace(/[^a-z-]/gi, "").trim().toLowerCase().slice(0, 32) || "region";
      const currentFeedback = normalizeFeedback(body.currentFeedback);
      const mappedLocation = getSuggestionContext(country, place);
      if (!country || !place || !mappedLocation) {
        return sendJson(response, 400, { error: "A country and a mapped place are required." });
      }
      const result = await suggestPrompts(country, {
        place: mappedLocation.title,
        context: mappedLocation.children,
        kind: mappedLocation.kind ?? kind,
        currentFeedback
      });
      sendJson(response, 200, {
        countrySlug: country.slug,
        place,
        suggestions: result.suggestions,
        source: result.source,
        factBoundary: "Prompt suggestions only steer an external reference-image search. They are not travel facts."
      }, { "Cache-Control": "no-store" });
    },

    async handleHistoryRequest(url, response) {
      const country = findCountry(url.searchParams.get("countrySlug"));
      const place = normalizePlace(url.searchParams.get("place"));
      if (!country || !place) return sendJson(response, 400, { error: "A country and place are required." });
      const history = await readHistory(country, place);
      sendJson(response, 200, {
        countrySlug: country.slug,
        place,
        items: history.map(toHistoryItem),
        factBoundary
      }, { "Cache-Control": "no-store" });
    },

    async handleHistorySelectionRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const entryId = String(body.entryId ?? "").trim();
      if (!country || !place || !entryId) {
        return sendJson(response, 400, { error: "A country, place, and saved photo are required." });
      }
      const result = await selectHistoryEntry(country, place, entryId);
      sendJson(response, 200, { countrySlug: country.slug, place, ...result });
    },

    async handleHistoryDeleteRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      const place = normalizePlace(body.place);
      const entryId = String(body.entryId ?? "").trim();
      if (!country || !place || !entryId) {
        return sendJson(response, 400, { error: "A country, place, and saved photo are required." });
      }
      const result = await deleteHistoryEntry(country, place, entryId);
      sendJson(response, 200, { countrySlug: country.slug, place, ...result });
    }
  };
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(payload));
}
