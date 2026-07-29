export const PLACE_IMAGE_HISTORY_LIMIT = 6;

interface PlaceImageHistoryRecord {
  id: unknown;
  imageUrl: unknown;
  active?: unknown;
  feedback?: unknown;
  fetchedAt?: unknown;
  archivedAt?: unknown;
}

export interface PlaceImageHistoryItem {
  id: unknown;
  imageUrl: unknown;
  active: boolean;
  feedback: unknown | null;
  fetchedAt: unknown | null;
  archivedAt: unknown | null;
}

export function toPlaceImageHistoryItem(
  record: PlaceImageHistoryRecord
): PlaceImageHistoryItem {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    active: Boolean(record.active),
    feedback: record.feedback ?? null,
    fetchedAt: record.fetchedAt ?? null,
    archivedAt: record.archivedAt ?? null
  };
}
