import { PLACE_IMAGE_SELECTION_VERSION } from "@roamatlas/domain/placeImageSelection.js";
import { jsonResponse } from "../../platform/http/fetchResponses.js";
import { mimeTypeForImagePath } from "../../platform/http/mediaTypes.js";
import { toSafeHeaderValue } from "../../platform/http/safeHeaderValue.js";
import { createExaPlaceImageProvider } from "./exaPlaceImageProvider.js";
import { createPlaceImageHttpHandlers } from "./placeImageHttpHandler.js";
import { PLACE_IMAGE_FACT_BOUNDARY } from "./placeImagePolicy.js";
import { createPlaceImageRepository } from "./placeImageRepository.js";
import { createPlaceImageService } from "./placeImageService.js";
import { createPlaceImageSuggestionProvider } from "./placeImageSuggestionProvider.js";

export function createPlaceImageFeature({
  cacheRoot,
  getImagePathFromUrl,
  getCountryBySlug,
  getCountryPack,
  resolveWikipediaImage,
  apiKeys,
  textModel,
  extractOpenAIText,
  parseJsonObject,
  fetchFn = fetch
}) {
  const repository = createPlaceImageRepository({
    cacheRoot,
    getImagePathFromUrl,
    selectionVersion: PLACE_IMAGE_SELECTION_VERSION
  });
  const service = createPlaceImageService({
    repository,
    exaProvider: createExaPlaceImageProvider({
      apiKey: apiKeys.exa,
      fetchFn
    }),
    wikipediaProvider: resolveWikipediaImage,
    suggestionProvider: createPlaceImageSuggestionProvider({
      apiKey: apiKeys.openai,
      model: textModel,
      extractText: extractOpenAIText,
      parseJson: parseJsonObject,
      fetchFn
    }),
    getCountryPack,
    selectionVersion: PLACE_IMAGE_SELECTION_VERSION,
    fetchFn
  });
  const handlers = createPlaceImageHttpHandlers({
    getCountryBySlug,
    normalizeFeedback: service.normalizeFeedback,
    respondNotFound,
    resolveImage: service.resolveImage,
    readCachedImage: repository.readCachedImage,
    mimeTypeForImagePath,
    toSafeHeaderValue,
    resetPlaceImage: service.resetPlaceImage,
    resetCountryImages: service.resetCountryImages,
    getSuggestionContext: service.getSuggestionContext,
    suggestPrompts: service.suggestPrompts,
    readHistory: service.readHistory,
    toHistoryItem: service.toHistoryItem,
    selectHistoryEntry: service.selectHistoryEntry,
    deleteHistoryEntry: service.deleteHistoryEntry,
    factBoundary: PLACE_IMAGE_FACT_BOUNDARY
  });

  return {
    handlers,
    clearRuntimeMemory: service.clearRuntimeMemory
  };
}

function respondNotFound(reason) {
  return jsonResponse({ error: "No place image found", reason }, 404, {
    "Cache-Control": "no-store",
    "X-RoamAtlas-Image-Source": "not-found"
  });
}
