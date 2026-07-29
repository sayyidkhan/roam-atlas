export type PlaceImageUrlState = {
  countryRefresh: number | null;
  feedback: string;
  placeRefresh: number | null;
};

export type PlaceImageSessionStore = {
  clearCountryRefresh: (countrySlug: string) => void;
  getUrlState: (
    countrySlug: string,
    placeName: string
  ) => PlaceImageUrlState;
  markCountryRefresh: (
    countrySlug: string,
    refreshedAt?: number
  ) => void;
  markPlaceRefresh: (
    countrySlug: string,
    placeName: string,
    refreshedAt?: number
  ) => void;
  setPlaceFeedback: (
    countrySlug: string,
    placeName: string,
    feedback: string,
    refreshedAt?: number
  ) => void;
};

/**
 * Owns browser-session cache-busting parameters for reference photos.
 *
 * These values only influence which decorative photo is requested. They do
 * not modify, verify, or provide evidence for curated travel facts.
 */
export function createPlaceImageSessionStore():
  PlaceImageSessionStore {
  const feedbacks = new Map<string, string>();
  const refreshes = new Map<string, number>();

  function clearCountryRefresh(countrySlug: string): void {
    refreshes.delete(normalizeCountrySlug(countrySlug));
  }

  function getUrlState(
    countrySlug: string,
    placeName: string
  ): PlaceImageUrlState {
    const normalizedCountrySlug =
      normalizeCountrySlug(countrySlug);
    const placeKey = createPlaceImageKey(
      normalizedCountrySlug,
      placeName
    );
    return {
      countryRefresh:
        refreshes.get(normalizedCountrySlug) ?? null,
      feedback: feedbacks.get(placeKey) ?? "",
      placeRefresh: refreshes.get(placeKey) ?? null
    };
  }

  function markCountryRefresh(
    countrySlug: string,
    refreshedAt = Date.now()
  ): void {
    refreshes.set(
      normalizeCountrySlug(countrySlug),
      refreshedAt
    );
  }

  function markPlaceRefresh(
    countrySlug: string,
    placeName: string,
    refreshedAt = Date.now()
  ): void {
    const placeKey = createPlaceImageKey(
      countrySlug,
      placeName
    );
    feedbacks.delete(placeKey);
    refreshes.set(placeKey, refreshedAt);
  }

  function setPlaceFeedback(
    countrySlug: string,
    placeName: string,
    feedback: string,
    refreshedAt = Date.now()
  ): void {
    const placeKey = createPlaceImageKey(
      countrySlug,
      placeName
    );
    feedbacks.set(placeKey, feedback);
    refreshes.set(placeKey, refreshedAt);
  }

  return {
    clearCountryRefresh,
    getUrlState,
    markCountryRefresh,
    markPlaceRefresh,
    setPlaceFeedback
  };
}

export function createPlaceImageKey(
  countrySlug: string,
  placeName: unknown
): string {
  return `${normalizeCountrySlug(countrySlug)}:${String(placeName ?? "").trim().toLowerCase()}`;
}

function normalizeCountrySlug(countrySlug: string): string {
  return String(countrySlug ?? "").trim().toLowerCase();
}
