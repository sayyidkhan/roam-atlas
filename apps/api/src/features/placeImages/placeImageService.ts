import { inferPlaceImageProfile } from "@roamatlas/domain/placeImageSelection.js";
import {
  createMediaDownloadOptions,
  mediaImageExtension
} from "../../platform/media/mediaFetch.ts";
import {
  getMappedPlaceImageSuggestionContext,
  normalizePlaceImageFeedback
} from "./placeImageSuggestionPolicy.ts";
import {
  PLACE_IMAGE_FACT_BOUNDARY,
  getPlaceImageCandidateClaimKey,
  getPlaceImageRecordClaimKey,
  hasUsablePlaceImageDimensions
} from "./placeImageMediaPolicy.ts";
import {
  toPlaceImageHistoryItem
} from "./placeImageHistoryPolicy.ts";
import { createPlaceImageClaimRegistry } from "./placeImageClaimRegistry.ts";
import { createPlaceImageHistoryService } from "./placeImageHistoryService.ts";
import type {
  PlaceImageCandidate,
  PlaceImageCountry,
  PlaceImageMemoryReset,
  PlaceImagePaths,
  PlaceImageProfile,
  PlaceImageRecord,
  PlaceImageServiceDependencies
} from "./placeImageServiceTypes.ts";

export function createPlaceImageService({
  repository,
  exaProvider,
  wikipediaProvider,
  suggestionProvider,
  getCountryPack,
  selectionVersion,
  fetchFn = fetch
}: PlaceImageServiceDependencies) {
  const cache = new Map<string, PlaceImageRecord>();
  const requestsInFlight =
    new Map<string, Promise<PlaceImageRecord>>();
  const claimRegistry = createPlaceImageClaimRegistry({
    repository,
    selectionVersion
  });
  const historyService = createPlaceImageHistoryService({
    clearRuntimeMemory,
    readStoredRecord,
    repository,
    reserveClaim: claimRegistry.reserve,
    settlePlaceRequest
  });

  async function resolveImage(
    country: PlaceImageCountry,
    place: string,
    {
      context = "",
      kind = "",
      tags = [],
      feedback = ""
    }: {
      context?: string;
      feedback?: string;
      kind?: string;
      tags?: string[];
    } = {}
  ): Promise<PlaceImageRecord> {
    const paths = repository.pathsFor(country.slug, place);
    const cacheKey = keyFor(paths);
    const cachedRecord = cache.get(cacheKey);
    if (cachedRecord) return cachedRecord;
    const activeRequest = requestsInFlight.get(cacheKey);
    if (activeRequest) return activeRequest;

    const request = resolveUncached(
      country,
      place,
      { context, kind, tags, feedback },
      paths
    )
      .then((record) => {
        cache.set(cacheKey, record);
        return record;
      })
      .finally(() => requestsInFlight.delete(cacheKey));
    requestsInFlight.set(cacheKey, request);
    return request;
  }

  async function resolveUncached(
    country: PlaceImageCountry,
    place: string,
    {
      context,
      kind,
      tags,
      feedback
    }: {
      context: string;
      feedback: string;
      kind: string;
      tags: string[];
    },
    paths: PlaceImagePaths
  ): Promise<PlaceImageRecord> {
    const storedRecord = await readStoredRecord(paths, place);
    if (storedRecord) return storedRecord;
    if (!exaProvider.available) {
      return { imageUrl: null, reason: "exa-key-missing" };
    }

    const profile = inferPlaceImageProfile({
      place,
      countryName: country.name,
      countrySlug: country.slug,
      kind,
      tags,
      context
    });
    const normalizedFeedback = normalizePlaceImageFeedback(feedback);
    if (normalizedFeedback) {
      profile.queries.unshift(
        `${place} ${context} ${country.name} ${normalizedFeedback} reference photograph`
          .replace(/\s+/g, " ")
          .trim()
      );
    }

    const candidates = await exaProvider.search(profile);
    for (const candidate of candidates) {
      const record = await claimAndPersist(
        paths,
        country,
        place,
        candidate,
        profile,
        normalizedFeedback
      );
      if (record) return record;
    }

    const wikipediaCandidate = await wikipediaProvider(country, place, { context });
    if (wikipediaCandidate) {
      const record = await claimAndPersist(
        paths,
        country,
        place,
        wikipediaCandidate,
        profile,
        normalizedFeedback
      );
      if (record) return record;
    }

    const notFoundRecord = {
      place,
      countrySlug: country.slug,
      imageUrl: null,
      sourceUrl: null,
      source: "exa_place_search",
      reason: "no-image-found",
      selectionVersion,
      fetchedAt: new Date().toISOString(),
      factBoundary: PLACE_IMAGE_FACT_BOUNDARY
    };
    await repository.writeMetadata(paths, notFoundRecord);
    return notFoundRecord;
  }

  async function claimAndPersist(
    paths: PlaceImagePaths,
    country: PlaceImageCountry,
    place: string,
    candidate: PlaceImageCandidate,
    profile: PlaceImageProfile,
    feedback: string
  ): Promise<PlaceImageRecord | null> {
    const claimKey = getPlaceImageCandidateClaimKey(candidate);
    if (
      await claimRegistry.isClaimedByAnotherPlace(
        paths,
        place,
        claimKey
      )
    ) {
      return null;
    }

    claimRegistry.reserve(paths.countrySlug, place, claimKey);
    const record = await persistImage(
      paths,
      { country, place, candidate, profile, feedback }
    );
    if (record) return record;
    claimRegistry.release(paths.countrySlug, place, claimKey);
    return null;
  }

  async function persistImage(
    paths: PlaceImagePaths,
    {
      country,
      place,
      candidate,
      profile,
      feedback
    }: {
      candidate: PlaceImageCandidate;
      country: PlaceImageCountry;
      feedback: string;
      place: string;
      profile: PlaceImageProfile;
    }
  ): Promise<PlaceImageRecord | null> {
    try {
      const response = await fetchFn(
        candidate.imageUrl,
        createMediaDownloadOptions()
      );
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/") || contentType.includes("svg")) {
        return null;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      if (
        imageBuffer.length < 4096 ||
        !hasUsablePlaceImageDimensions(imageBuffer, contentType)
      ) {
        return null;
      }

      const extension = mediaImageExtension(contentType, candidate.imageUrl);
      await repository.writeImage(paths, extension, imageBuffer);
      const record = {
        place,
        countrySlug: country.slug,
        imageUrl: paths.imageUrlForExtension(extension),
        remoteImageUrl: candidate.imageUrl,
        sourceUrl: candidate.sourceUrl,
        query: candidate.query,
        feedback: normalizePlaceImageFeedback(feedback) || null,
        selectionVersion,
        selectionStrategy: profile?.strategy ?? null,
        selectionScore: candidate.score ?? null,
        source: "exa_place_search:local-cache",
        fetchedAt: new Date().toISOString(),
        factBoundary: PLACE_IMAGE_FACT_BOUNDARY
      };
      await repository.writeMetadata(paths, record);
      return record;
    } catch {
      return null;
    }
  }

  async function resetCountryImages(
    country: PlaceImageCountry
  ) {
    await settleCountryRequests(country.slug);
    await repository.removeCountry(country.slug);
    clearRuntimeMemory(country.slug);
    return {
      reset: true,
      scope: "all-place-images",
      removedFolders: ["place-images"],
      factBoundary: "Reference-photo cache was cleared. Starter-map builder data and generated map illustrations were not changed."
    };
  }

  async function resetPlaceImage(
    country: PlaceImageCountry,
    place: string,
    { preserveHistory = false }: {
      preserveHistory?: boolean;
    } = {}
  ) {
    const paths = repository.pathsFor(country.slug, place);
    await settlePlaceRequest(paths);
    const { record, archived, imagePaths } = await repository.removePlace(
      paths,
      { preserveHistory }
    );
    clearRuntimeMemory(country.slug, {
      placeSlug: paths.placeSlug,
      place,
      claimKey: record ? getPlaceImageRecordClaimKey(record) : ""
    });
    return {
      reset: true,
      scope: "single-place-image",
      place,
      removedFiles: [paths.metadataPath, ...imagePaths],
      archived,
      factBoundary: preserveHistory
        ? "The current reference photo was saved to its local history before a fresh search. Starter-map builder data and generated map illustrations were not changed."
        : "One reference-photo cache entry was cleared. Starter-map builder data and generated map illustrations were not changed."
    };
  }

  function clearRuntimeMemory(
    countrySlug: string,
    place: PlaceImageMemoryReset | null = null
  ): void {
    const cachePrefix = `${countrySlug}:`;
    if (!place?.placeSlug) {
      for (const cacheKey of cache.keys()) {
        if (cacheKey.startsWith(cachePrefix)) cache.delete(cacheKey);
      }
      for (const cacheKey of requestsInFlight.keys()) {
        if (cacheKey.startsWith(cachePrefix)) requestsInFlight.delete(cacheKey);
      }
      claimRegistry.clearCountry(countrySlug);
      return;
    }

    const cacheKey = `${countrySlug}:${place.placeSlug}:${selectionVersion}`;
    cache.delete(cacheKey);
    requestsInFlight.delete(cacheKey);
    claimRegistry.clearPlace(
      countrySlug,
      place.place ?? "",
      place.claimKey
    );
  }

  return {
    resolveImage,
    resetCountryImages,
    resetPlaceImage,
    readHistory: historyService.readHistory,
    selectHistoryEntry: historyService.selectHistoryEntry,
    deleteHistoryEntry: historyService.deleteHistoryEntry,
    clearRuntimeMemory,
    normalizeFeedback: normalizePlaceImageFeedback,
    getSuggestionContext: (
      country: PlaceImageCountry,
      place: string
    ) =>
      getMappedPlaceImageSuggestionContext(country, place, getCountryPack),
    suggestPrompts: suggestionProvider.suggest,
    toHistoryItem: toPlaceImageHistoryItem
  };

  async function readStoredRecord(
    paths: PlaceImagePaths,
    place: string
  ): Promise<PlaceImageRecord | null> {
    const record = await repository.readStoredRecord(paths);
    if (!record?.imageUrl) return record;
    const claimKey = getPlaceImageRecordClaimKey(record);
    if (
      await claimRegistry.isClaimedByAnotherPlace(
        paths,
        place ?? record.place ?? "",
        claimKey
      )
    ) {
      return null;
    }
    claimRegistry.reserve(
      paths.countrySlug,
      place ?? record.place ?? "",
      claimKey
    );
    return record;
  }

  async function settleCountryRequests(
    countrySlug: string
  ): Promise<void> {
    const prefix = `${countrySlug}:`;
    const requests = [...requestsInFlight.entries()]
      .filter(([cacheKey]) => cacheKey.startsWith(prefix))
      .map(([, request]) => request);
    if (requests.length) await Promise.allSettled(requests);
  }

  async function settlePlaceRequest(
    paths: PlaceImagePaths
  ): Promise<void> {
    const request = requestsInFlight.get(keyFor(paths));
    if (request) await Promise.allSettled([request]);
  }

  function keyFor(paths: PlaceImagePaths): string {
    return `${paths.countrySlug}:${paths.placeSlug}:${selectionVersion}`;
  }
}
