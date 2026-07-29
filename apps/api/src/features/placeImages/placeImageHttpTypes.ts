import type {
  PlaceImageHistoryItem
} from "./placeImageHistoryPolicy.ts";
import type {
  PlaceImageSuggestionContext
} from "./placeImageSuggestionPolicy.ts";
import type {
  PlaceImageCountry,
  PlaceImageHistoryRecord
} from "./placeImageServiceTypes.ts";
import type {
  createPlaceImageService
} from "./placeImageService.ts";

type PlaceImageService = ReturnType<
  typeof createPlaceImageService
>;

export type PlaceImageHttpHandlers = {
  handleFeedbackRequest: (
    request: Request
  ) => Promise<Response>;
  handleHistoryDeleteRequest: (
    request: Request
  ) => Promise<Response>;
  handleHistoryRequest: (
    url: URL
  ) => Promise<Response>;
  handleHistorySelectionRequest: (
    request: Request
  ) => Promise<Response>;
  handleImageRequest: (
    url: URL
  ) => Promise<Response>;
  handleResetRequest: (
    request: Request
  ) => Promise<Response>;
  handleSuggestionsRequest: (
    request: Request
  ) => Promise<Response>;
};

export type PlaceImageHttpDependencies = {
  deleteHistoryEntry:
    PlaceImageService["deleteHistoryEntry"];
  factBoundary: string;
  getCountryBySlug: (
    countrySlug: string
  ) => PlaceImageCountry | null | undefined;
  getSuggestionContext: (
    country: PlaceImageCountry,
    place: string
  ) => PlaceImageSuggestionContext | null;
  mimeTypeForImagePath: (
    filePath: string
  ) => string;
  normalizeFeedback: (value: unknown) => string;
  readCachedImage: (
    imageUrl: string
  ) => Promise<{
    bytes: Buffer;
    filePath: string;
  } | null>;
  readHistory: PlaceImageService["readHistory"];
  resetCountryImages:
    PlaceImageService["resetCountryImages"];
  resetPlaceImage:
    PlaceImageService["resetPlaceImage"];
  resolveImage: PlaceImageService["resolveImage"];
  respondNotFound: (reason: unknown) => Response;
  selectHistoryEntry:
    PlaceImageService["selectHistoryEntry"];
  suggestPrompts:
    PlaceImageService["suggestPrompts"];
  toHistoryItem: (
    item: PlaceImageHistoryRecord
  ) => PlaceImageHistoryItem;
  toSafeHeaderValue: (value: unknown) => string;
};
