import { inferPlaceImageProfile } from "../../domain/placeImageSelection.js";
import {
  createMediaDownloadOptions,
  mediaImageExtension
} from "../../platform/media/mediaFetch.js";
import {
  PLACE_IMAGE_FACT_BOUNDARY,
  getMappedPlaceImageSuggestionContext,
  getPlaceImageCandidateClaimKey,
  getPlaceImageRecordClaimKey,
  hasUsablePlaceImageDimensions,
  normalizePlaceImageClaimPlace,
  normalizePlaceImageFeedback,
  toPlaceImageHistoryItem
} from "./placeImagePolicy.js";

export function createPlaceImageService({
  repository,
  exaProvider,
  wikipediaProvider,
  suggestionProvider,
  getCountryPack,
  selectionVersion,
  fetchFn = fetch
}) {
  const cache = new Map();
  const requestsInFlight = new Map();
  const claimsByCountry = new Map();

  async function resolveImage(
    country,
    place,
    { context = "", kind = "", tags = [], feedback = "" } = {}
  ) {
    const paths = repository.pathsFor(country.slug, place);
    const cacheKey = keyFor(paths);
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    if (requestsInFlight.has(cacheKey)) return requestsInFlight.get(cacheKey);

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
    country,
    place,
    { context, kind, tags, feedback },
    paths
  ) {
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
    paths,
    country,
    place,
    candidate,
    profile,
    feedback
  ) {
    const claimKey = getPlaceImageCandidateClaimKey(candidate);
    if (await isClaimedByAnotherPlace(paths, place, claimKey)) return null;

    reserveClaim(paths.countrySlug, place, claimKey);
    const record = await persistImage(
      paths,
      { country, place, candidate, profile, feedback }
    );
    if (record) return record;
    releaseClaim(paths.countrySlug, place, claimKey);
    return null;
  }

  async function persistImage(
    paths,
    { country, place, candidate, profile, feedback }
  ) {
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

  async function resetCountryImages(country) {
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

  async function resetPlaceImage(country, place, { preserveHistory = false } = {}) {
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

  async function readHistory(country, place) {
    const paths = repository.pathsFor(country.slug, place);
    const saved = await repository.readHistory(paths);
    const active = await readStoredRecord(paths, place);
    if (active?.imageUrl) {
      saved.push({ ...active, id: "current", active: true });
    }
    return saved;
  }

  async function selectHistoryEntry(country, place, entryId) {
    const paths = repository.pathsFor(country.slug, place);
    await settlePlaceRequest(paths);
    const { record, previousRecord } = await repository.selectHistoryEntry(
      paths,
      entryId
    );
    clearRuntimeMemory(country.slug, {
      placeSlug: paths.placeSlug,
      place,
      claimKey: previousRecord ? getPlaceImageRecordClaimKey(previousRecord) : ""
    });
    reserveClaim(paths.countrySlug, place, getPlaceImageRecordClaimKey(record));
    return {
      selected: true,
      record: toPlaceImageHistoryItem({ ...record, id: "current", active: true })
    };
  }

  async function deleteHistoryEntry(country, place, entryId) {
    if (entryId === "current") return deleteActive(country, place);
    const paths = repository.pathsFor(country.slug, place);
    await settlePlaceRequest(paths);
    await repository.deleteHistoryEntry(paths, entryId);
    return {
      deleted: true,
      entryId,
      items: (await readHistory(country, place)).map(toPlaceImageHistoryItem),
      factBoundary: "Only a saved reference-photo history entry was deleted. Curated travel data was not changed."
    };
  }

  async function deleteActive(country, place) {
    const paths = repository.pathsFor(country.slug, place);
    await settlePlaceRequest(paths);
    const record = await repository.deleteActive(paths);
    clearRuntimeMemory(country.slug, {
      placeSlug: paths.placeSlug,
      place,
      claimKey: getPlaceImageRecordClaimKey(record)
    });
    return {
      deleted: true,
      activeDeleted: true,
      entryId: "current",
      items: (await readHistory(country, place)).map(toPlaceImageHistoryItem),
      factBoundary: "Only the active reference photo was deleted. Saved photo history and curated travel data were not changed."
    };
  }

  function clearRuntimeMemory(countrySlug, place = null) {
    const cachePrefix = `${countrySlug}:`;
    if (!place?.placeSlug) {
      for (const cacheKey of cache.keys()) {
        if (cacheKey.startsWith(cachePrefix)) cache.delete(cacheKey);
      }
      for (const cacheKey of requestsInFlight.keys()) {
        if (cacheKey.startsWith(cachePrefix)) requestsInFlight.delete(cacheKey);
      }
      claimsByCountry.delete(countrySlug);
      return;
    }

    const cacheKey = `${countrySlug}:${place.placeSlug}:${selectionVersion}`;
    cache.delete(cacheKey);
    requestsInFlight.delete(cacheKey);
    if (place.claimKey) {
      releaseClaim(countrySlug, place.place ?? "", place.claimKey);
    }
    const normalizedPlace = normalizePlaceImageClaimPlace(place.place);
    const claims = claimsByCountry.get(countrySlug);
    if (claims && normalizedPlace) {
      for (const [claimKey, claimedPlace] of claims.entries()) {
        if (claimedPlace === normalizedPlace) claims.delete(claimKey);
      }
    }
  }

  return {
    resolveImage,
    resetCountryImages,
    resetPlaceImage,
    readHistory,
    selectHistoryEntry,
    deleteHistoryEntry,
    clearRuntimeMemory,
    normalizeFeedback: normalizePlaceImageFeedback,
    getSuggestionContext: (country, place) =>
      getMappedPlaceImageSuggestionContext(country, place, getCountryPack),
    suggestPrompts: suggestionProvider.suggest,
    toHistoryItem: toPlaceImageHistoryItem
  };

  async function readStoredRecord(paths, place) {
    const record = await repository.readStoredRecord(paths);
    if (!record?.imageUrl) return record;
    const claimKey = getPlaceImageRecordClaimKey(record);
    if (await isClaimedByAnotherPlace(paths, place ?? record.place, claimKey)) {
      return null;
    }
    reserveClaim(paths.countrySlug, place ?? record.place, claimKey);
    return record;
  }

  async function isClaimedByAnotherPlace(paths, place, claimKey) {
    if (!claimKey) return false;
    const normalizedPlace = normalizePlaceImageClaimPlace(place);
    const memoryClaim = claimsByCountry.get(paths.countrySlug)?.get(claimKey);
    if (memoryClaim && memoryClaim !== normalizedPlace) return true;

    const records = await repository.listStoredRecords(paths.countryCacheRoot);
    return records.some((record) => {
      if (record.selectionVersion !== selectionVersion) return false;
      if (normalizePlaceImageClaimPlace(record.place) === normalizedPlace) {
        return false;
      }
      return getPlaceImageRecordClaimKey(record) === claimKey;
    });
  }

  function reserveClaim(countrySlug, place, claimKey) {
    if (!claimKey) return;
    let claims = claimsByCountry.get(countrySlug);
    if (!claims) {
      claims = new Map();
      claimsByCountry.set(countrySlug, claims);
    }
    claims.set(claimKey, normalizePlaceImageClaimPlace(place));
  }

  function releaseClaim(countrySlug, place, claimKey) {
    if (!claimKey) return;
    const claims = claimsByCountry.get(countrySlug);
    if (claims?.get(claimKey) === normalizePlaceImageClaimPlace(place)) {
      claims.delete(claimKey);
    }
  }

  async function settleCountryRequests(countrySlug) {
    const prefix = `${countrySlug}:`;
    const requests = [...requestsInFlight.entries()]
      .filter(([cacheKey]) => cacheKey.startsWith(prefix))
      .map(([, request]) => request);
    if (requests.length) await Promise.allSettled(requests);
  }

  async function settlePlaceRequest(paths) {
    const request = requestsInFlight.get(keyFor(paths));
    if (request) await Promise.allSettled([request]);
  }

  function keyFor(paths) {
    return `${paths.countrySlug}:${paths.placeSlug}:${selectionVersion}`;
  }
}
