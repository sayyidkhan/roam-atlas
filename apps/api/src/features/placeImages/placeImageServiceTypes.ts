import type { PlaceImageCountry } from "./placeImageSuggestionPolicy.ts";
import type {
  PlaceImageProfile
} from "@roamatlas/domain/placeImageSelection.js";

export type {
  PlaceImageCountry,
  PlaceImageProfile
};

export type PlaceImageCandidate = {
  imageUrl: string;
  query?: string;
  score?: number;
  sourceUrl?: string | null;
};

export type PlaceImageSuggestionRequest = {
  context?: string[];
  currentFeedback?: string;
  kind?: string;
  place: string;
};

export type PlaceImageSuggestionResult = {
  source: "curated-fallback" | "llm";
  suggestions: string[];
};

export type PlaceImageRecord = {
  active?: unknown;
  archivedAt?: unknown;
  countrySlug?: string;
  factBoundary?: string;
  feedback?: unknown;
  fetchedAt?: unknown;
  id?: unknown;
  imageUrl?: string | null;
  place?: string;
  remoteImageUrl?: string;
  selectionVersion?: string;
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type PlaceImageHistoryRecord = PlaceImageRecord & {
  id: unknown;
  imageUrl: string;
};

export type PlaceImagePaths = {
  countryCacheRoot: string;
  countrySlug: string;
  historyImagePathForExtension: (
    entryId: string,
    extension: string
  ) => string;
  historyImageUrlForExtension: (
    entryId: string,
    extension: string
  ) => string;
  historyMetadataPath: string;
  historyRoot: string;
  imagePathForExtension: (extension: string) => string;
  imageUrlForExtension: (extension: string) => string;
  metadataPath: string;
  placeSlug: string;
};

export type PlaceImageRepository = {
  deleteActive: (
    paths: PlaceImagePaths
  ) => Promise<PlaceImageRecord>;
  deleteHistoryEntry: (
    paths: PlaceImagePaths,
    entryId: string
  ) => Promise<unknown>;
  listStoredRecords: (
    countryCacheRoot: string
  ) => Promise<PlaceImageRecord[]>;
  pathsFor: (
    countrySlug: string,
    place: string
  ) => PlaceImagePaths;
  readCachedImage: (
    imageUrl: string
  ) => Promise<{
    bytes: Buffer;
    filePath: string;
  } | null>;
  readHistory: (
    paths: PlaceImagePaths
  ) => Promise<PlaceImageHistoryRecord[]>;
  readStoredRecord: (
    paths: PlaceImagePaths
  ) => Promise<PlaceImageRecord | null>;
  removeCountry: (countrySlug: string) => Promise<unknown>;
  removePlace: (
    paths: PlaceImagePaths,
    options?: { preserveHistory?: boolean }
  ) => Promise<{
    archived: PlaceImageRecord | null;
    imagePaths: string[];
    record: PlaceImageRecord | null;
  }>;
  selectHistoryEntry: (
    paths: PlaceImagePaths,
    entryId: string
  ) => Promise<{
    previousRecord: PlaceImageRecord | null;
    record: PlaceImageRecord;
  }>;
  writeImage: (
    paths: PlaceImagePaths,
    extension: string,
    imageBuffer: Buffer
  ) => Promise<unknown>;
  writeMetadata: (
    paths: PlaceImagePaths,
    record: PlaceImageRecord
  ) => Promise<void>;
};

export type PlaceImageMemoryReset = {
  claimKey?: string;
  place?: string;
  placeSlug: string;
};

export type PlaceImageServiceDependencies = {
  exaProvider: {
    available: boolean;
    search: (
      profile: PlaceImageProfile
    ) => Promise<PlaceImageCandidate[]>;
  };
  fetchFn?: typeof fetch;
  getCountryPack: Parameters<
    typeof import("./placeImageSuggestionPolicy.ts").getMappedPlaceImageSuggestionContext
  >[2];
  repository: PlaceImageRepository;
  selectionVersion: string;
  suggestionProvider: {
    suggest: (
      country: PlaceImageCountry,
      options: PlaceImageSuggestionRequest
    ) => Promise<PlaceImageSuggestionResult>;
  };
  wikipediaProvider: (
    country: PlaceImageCountry,
    place: string,
    options: { context: string }
  ) => Promise<PlaceImageCandidate | null>;
};
