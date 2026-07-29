import {
  getPlaceImageRecordClaimKey
} from "./placeImageMediaPolicy.ts";
import {
  toPlaceImageHistoryItem
} from "./placeImageHistoryPolicy.ts";
import type {
  PlaceImageCountry,
  PlaceImageHistoryRecord,
  PlaceImageMemoryReset,
  PlaceImagePaths,
  PlaceImageRecord,
  PlaceImageRepository
} from "./placeImageServiceTypes.ts";

type PlaceImageHistoryServiceOptions = {
  clearRuntimeMemory: (
    countrySlug: string,
    place: PlaceImageMemoryReset
  ) => void;
  readStoredRecord: (
    paths: PlaceImagePaths,
    place: string
  ) => Promise<PlaceImageRecord | null>;
  repository: Pick<
    PlaceImageRepository,
    | "deleteActive"
    | "deleteHistoryEntry"
    | "pathsFor"
    | "readHistory"
    | "selectHistoryEntry"
  >;
  reserveClaim: (
    countrySlug: string,
    place: string,
    claimKey: string
  ) => void;
  settlePlaceRequest: (
    paths: PlaceImagePaths
  ) => Promise<void>;
};

export function createPlaceImageHistoryService({
  clearRuntimeMemory,
  readStoredRecord,
  repository,
  reserveClaim,
  settlePlaceRequest
}: PlaceImageHistoryServiceOptions) {
  async function readHistory(
    country: PlaceImageCountry,
    place: string
  ): Promise<PlaceImageHistoryRecord[]> {
    const paths = repository.pathsFor(country.slug, place);
    const saved = await repository.readHistory(paths);
    const active = await readStoredRecord(paths, place);
    if (active?.imageUrl) {
      saved.push({
        ...active,
        active: true,
        id: "current",
        imageUrl: active.imageUrl
      });
    }
    return saved;
  }

  async function selectHistoryEntry(
    country: PlaceImageCountry,
    place: string,
    entryId: string
  ) {
    const paths = repository.pathsFor(country.slug, place);
    await settlePlaceRequest(paths);
    const { record, previousRecord } =
      await repository.selectHistoryEntry(paths, entryId);
    clearRuntimeMemory(country.slug, {
      placeSlug: paths.placeSlug,
      place,
      claimKey: previousRecord
        ? getPlaceImageRecordClaimKey(previousRecord)
        : ""
    });
    reserveClaim(
      paths.countrySlug,
      place,
      getPlaceImageRecordClaimKey(record)
    );
    return {
      selected: true,
      record: toPlaceImageHistoryItem({
        ...record,
        active: true,
        id: "current",
        imageUrl: record.imageUrl ?? ""
      })
    };
  }

  async function deleteHistoryEntry(
    country: PlaceImageCountry,
    place: string,
    entryId: string
  ) {
    if (entryId === "current") {
      return deleteActive(country, place);
    }
    const paths = repository.pathsFor(country.slug, place);
    await settlePlaceRequest(paths);
    await repository.deleteHistoryEntry(paths, entryId);
    return {
      deleted: true,
      entryId,
      items: (await readHistory(country, place)).map(
        toPlaceImageHistoryItem
      ),
      factBoundary:
        "Only a saved reference-photo history entry was deleted. Curated travel data was not changed."
    };
  }

  async function deleteActive(
    country: PlaceImageCountry,
    place: string
  ) {
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
      items: (await readHistory(country, place)).map(
        toPlaceImageHistoryItem
      ),
      factBoundary:
        "Only the active reference photo was deleted. Saved photo history and curated travel data were not changed."
    };
  }

  return {
    deleteHistoryEntry,
    readHistory,
    selectHistoryEntry
  };
}
