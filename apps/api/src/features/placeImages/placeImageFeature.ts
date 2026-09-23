import {
  PLACE_IMAGE_SELECTION_VERSION
} from "@roamatlas/domain/placeImageSelection.js";
import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  mimeTypeForImagePath
} from "../../platform/http/mediaTypes.ts";
import {
  toSafeHeaderValue
} from "../../platform/http/safeHeaderValue.ts";
import {
  createExaPlaceImageProvider
} from "./exaPlaceImageProvider.ts";
import {
  createPlaceImageHttpHandlers
} from "./placeImageHttpHandler.ts";
import {
  PLACE_IMAGE_FACT_BOUNDARY
} from "./placeImageMediaPolicy.ts";
import {
  createPlaceImageRepository
} from "./placeImageRepository.ts";
import {
  createPlaceImageService
} from "./placeImageService.ts";
import type {
  PlaceImageCountry,
  PlaceImageServiceDependencies
} from "./placeImageServiceTypes.ts";
import {
  createPlaceImageSuggestionProvider
} from "./placeImageSuggestionProvider.ts";
import type {
  RecordProviderUsage
} from "../usage/usageService.ts";

type JsonObject = Record<string, unknown>;

type PlaceImageFeatureOptions = {
  apiKeys: {
    exa?: string;
    openai?: string;
  };
  cacheRoot: string;
  extractOpenAIText: (
    payload: unknown
  ) => string;
  fetchFn?: typeof fetch;
  getCountryBySlug: (
    countrySlug: string
  ) => PlaceImageCountry | null | undefined;
  getCountryPack:
    PlaceImageServiceDependencies["getCountryPack"];
  getImagePathFromUrl: (
    imageUrl: string
  ) => string | null;
  parseJsonObject: (
    text: unknown
  ) => JsonObject | null;
  recordUsage?: RecordProviderUsage;
  resolveWikipediaImage:
    PlaceImageServiceDependencies["wikipediaProvider"];
  serviceTier?: "fast";
  textModel: string;
};

export function createPlaceImageFeature({
  cacheRoot,
  getImagePathFromUrl,
  getCountryBySlug,
  getCountryPack,
  resolveWikipediaImage,
  apiKeys,
  textModel,
  recordUsage,
  serviceTier,
  extractOpenAIText,
  parseJsonObject,
  fetchFn = fetch
}: PlaceImageFeatureOptions) {
  const repository = createPlaceImageRepository({
    cacheRoot,
    getImagePathFromUrl,
    selectionVersion:
      PLACE_IMAGE_SELECTION_VERSION
  });
  const service = createPlaceImageService({
    repository,
    exaProvider: createExaPlaceImageProvider({
      apiKey: apiKeys.exa,
      fetchFn
    }),
    wikipediaProvider: resolveWikipediaImage,
    suggestionProvider:
      createPlaceImageSuggestionProvider({
        apiKey: apiKeys.openai,
        model: textModel,
        recordUsage,
        serviceTier,
        extractText: extractOpenAIText,
        parseJson: parseJsonObject,
        fetchFn
      }),
    getCountryPack,
    selectionVersion:
      PLACE_IMAGE_SELECTION_VERSION,
    fetchFn
  });
  const handlers = createPlaceImageHttpHandlers({
    getCountryBySlug,
    normalizeFeedback: service.normalizeFeedback,
    respondNotFound,
    resolveImage: service.resolveImage,
    readCachedImage:
      repository.readCachedImage,
    mimeTypeForImagePath,
    toSafeHeaderValue,
    resetPlaceImage: service.resetPlaceImage,
    resetCountryImages:
      service.resetCountryImages,
    getSuggestionContext:
      service.getSuggestionContext,
    suggestPrompts: service.suggestPrompts,
    readHistory: service.readHistory,
    toHistoryItem: service.toHistoryItem,
    selectHistoryEntry:
      service.selectHistoryEntry,
    deleteHistoryEntry:
      service.deleteHistoryEntry,
    factBoundary: PLACE_IMAGE_FACT_BOUNDARY
  });

  return {
    handlers,
    clearRuntimeMemory:
      service.clearRuntimeMemory
  };
}

function respondNotFound(
  reason: unknown
): Response {
  return jsonResponse(
    {
      error: "No place image found",
      reason
    },
    404,
    {
      "Cache-Control": "no-store",
      "X-RoamAtlas-Image-Source":
        "not-found"
    }
  );
}
