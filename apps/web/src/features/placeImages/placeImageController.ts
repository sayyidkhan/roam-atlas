import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type { CountryShellScrollSnapshot } from "../countrySetup/countryShellScroll";
import type {
  PlaceImageSessionStore
} from "./placeImageSessionStore";
import type {
  PlaceImageHistoryResult,
  PlaceImagePromptResult,
  PlaceImageSuggestionPayload
} from "./placeImageTypes";

type ToastOptions = {
  durationMs?: number;
  message: string;
  title: string;
  tone?: "error";
};

type PlaceImageClient = {
  deleteHistoryEntry: (input: {
    countrySlug: string;
    entryId: string;
    place: string;
  }) => Promise<PlaceImageHistoryResult>;
  requestSuggestions: (input: {
    context: string;
    countrySlug: string;
    currentFeedback: string;
    kind: string;
    place: string;
  }) => Promise<PlaceImageSuggestionPayload>;
  reset: (input: { countrySlug: string; place?: string }) => Promise<unknown>;
  selectHistoryEntry: (input: {
    countrySlug: string;
    entryId: string;
    place: string;
  }) => Promise<unknown>;
  submitFeedback: (input: {
    countrySlug: string;
    feedback: string;
    place: string;
  }) => Promise<unknown>;
};

type PlaceImageControllerDependencies = {
  APP_CONFIG: {
    notifications: {
      errorToastDurationMs: number;
      promptErrorToastDurationMs: number;
    };
    placeImages: {
      feedbackMaxLength: number;
      promptSuggestionLimit: number;
    };
  };
  PLACE_IMAGE_REQUEST_SESSION: string;
  PLACE_IMAGE_SELECTION_VERSION: string;
  apiPath: (path: string) => string;
  captureCountryShellScroll: () => CountryShellScrollSnapshot;
  explainClickError: (error: unknown) => string;
  placeImageClient: PlaceImageClient;
  placeImageSessionStore: PlaceImageSessionStore;
  render: () => void;
  restoreCountryShellScroll: (
    snapshot: CountryShellScrollSnapshot
  ) => void;
  showAppToast: (options: ToastOptions) => void;
};

type BuildPlaceImageOptions = {
  context?: string;
  kind?: string;
  tags?: string[];
};

type PromptSuggestionOptions = {
  place?: unknown;
  context?: unknown;
  kind?: unknown;
  currentFeedback?: unknown;
};

export function createPlaceImageController(
  dependencies: PlaceImageControllerDependencies
) {
  const {
    APP_CONFIG,
    PLACE_IMAGE_REQUEST_SESSION,
    PLACE_IMAGE_SELECTION_VERSION,
    apiPath,
    captureCountryShellScroll,
    explainClickError,
    placeImageClient,
    placeImageSessionStore,
    render,
    restoreCountryShellScroll,
    showAppToast
  } = dependencies;

  function buildPlaceImageUrl(
    countrySlug: string,
    placeName: string,
    { context = "", kind = "", tags = [] }: BuildPlaceImageOptions = {}
  ): string {
    if (!countrySlug || !placeName) return "";
    const params = new URLSearchParams({
      countrySlug,
      place: placeName,
      v: PLACE_IMAGE_SELECTION_VERSION,
      request: PLACE_IMAGE_REQUEST_SESSION
    });
    if (context) params.set("context", context);
    if (kind) params.set("kind", kind);
    if (tags.length) params.set("tags", tags.join(","));
    const {
      countryRefresh,
      feedback,
      placeRefresh
    } = placeImageSessionStore.getUrlState(
      countrySlug,
      placeName
    );
    if (countryRefresh) {
      params.set("refresh", String(countryRefresh));
    }
    if (placeRefresh) params.set("placeRefresh", String(placeRefresh));
    if (feedback) params.set("feedback", feedback);
    return apiPath(`/api/place-image?${params.toString()}`);
  }

  async function requestPlaceImageReset(
    country: CountrySummary,
    { place = "" }: { place?: unknown } = {}
  ): Promise<boolean> {
    const normalizedPlace = String(place ?? "").trim();
    const isSinglePlace = Boolean(normalizedPlace);
    const scrollSnapshot = captureCountryShellScroll();

    try {
      await placeImageClient.reset({
        countrySlug: country.slug,
        ...(isSinglePlace ? { place: normalizedPlace } : {})
      });
      const refresh = Date.now();
      if (isSinglePlace) {
        placeImageSessionStore.markPlaceRefresh(
          country.slug,
          normalizedPlace,
          refresh
        );
      } else {
        placeImageSessionStore.markCountryRefresh(
          country.slug,
          refresh
        );
      }
      render();
      restoreCountryShellScroll(scrollSnapshot);
      showAppToast({
        title: isSinglePlace
          ? "Reference photo reset"
          : "Reference photos reset",
        message: isSinglePlace
          ? `${normalizedPlace} photo cache was cleared. Searching again now.`
          : `${country.name} starter-map photo cache was cleared. Searching again now.`
      });
      return true;
    } catch (error) {
      const message = explainClickError(error);
      showAppToast({
        title: isSinglePlace
          ? "Reference photo was not reset"
          : "Reference photos were not reset",
        message: `No photo cache was cleared. ${message}`,
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }

  async function requestPlaceImageFeedback(
    country: CountrySummary,
    place: unknown,
    feedback: unknown
  ): Promise<boolean> {
    const normalizedPlace = String(place ?? "").trim();
    const normalizedFeedback = String(feedback ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, APP_CONFIG.placeImages.feedbackMaxLength);
    if (!normalizedPlace || !normalizedFeedback) return false;
    const scrollSnapshot = captureCountryShellScroll();

    try {
      await placeImageClient.submitFeedback({
        countrySlug: country.slug,
        place: normalizedPlace,
        feedback: normalizedFeedback
      });
      placeImageSessionStore.setPlaceFeedback(
        country.slug,
        normalizedPlace,
        normalizedFeedback
      );
      render();
      restoreCountryShellScroll(scrollSnapshot);
      showAppToast({
        title: "Searching for a better photo",
        message: `Exa is searching again for ${normalizedPlace} using your feedback. Curated travel data was not changed.`
      });
      return true;
    } catch (error) {
      showAppToast({
        title: "Photo feedback was not sent",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }

  async function requestPlaceImagePromptSuggestions(
    country: CountrySummary,
    {
      place,
      context = "",
      kind = "region",
      currentFeedback = ""
    }: PromptSuggestionOptions = {}
  ): Promise<PlaceImagePromptResult> {
    try {
      const payload = await placeImageClient.requestSuggestions({
        countrySlug: country.slug,
        place: String(place ?? "").trim(),
        context: String(context ?? "").trim(),
        kind: String(kind ?? "region").trim(),
        currentFeedback: String(currentFeedback ?? "").trim()
      });
      const suggestions = Array.isArray(payload?.suggestions)
        ? payload.suggestions
        : [];
      return {
        source:
          payload?.source === "llm" ? "llm" : "curated-fallback",
        suggestions: suggestions
          .map((suggestion) =>
            String(suggestion ?? "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, APP_CONFIG.placeImages.feedbackMaxLength)
          )
          .filter(Boolean)
          .slice(0, APP_CONFIG.placeImages.promptSuggestionLimit)
      };
    } catch (error) {
      showAppToast({
        title: "Prompt suggestions unavailable",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.promptErrorToastDurationMs
      });
      return { source: "curated-fallback", suggestions: [] };
    }
  }

  async function requestPlaceImageHistorySelection(
    country: CountrySummary,
    place: string,
    entryId: string
  ): Promise<boolean> {
    const scrollSnapshot = captureCountryShellScroll();
    try {
      await placeImageClient.selectHistoryEntry({
        countrySlug: country.slug,
        place,
        entryId
      });
      placeImageSessionStore.markPlaceRefresh(
        country.slug,
        place
      );
      render();
      restoreCountryShellScroll(scrollSnapshot);
      showAppToast({
        title: "Reference photo kept",
        message: `${place} now uses the saved photo you selected. Curated travel data was not changed.`
      });
      return true;
    } catch (error) {
      showAppToast({
        title: "Reference photo was not changed",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }

  async function requestPlaceImageHistoryDelete(
    country: CountrySummary,
    place: string,
    entryId: string
  ): Promise<PlaceImageHistoryResult | null> {
    try {
      const payload = await placeImageClient.deleteHistoryEntry({
        countrySlug: country.slug,
        place,
        entryId
      });
      showAppToast({
        title: payload.activeDeleted
          ? "Current photo deleted"
          : "Saved photo deleted",
        message: payload.activeDeleted
          ? `${place} will search for a fresh reference photo. Saved history and curated travel data were kept.`
          : `${place} history was updated. Curated travel data was not changed.`
      });
      return payload;
    } catch (error) {
      showAppToast({
        title: "Saved photo was not deleted",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return null;
    }
  }

  return {
    buildPlaceImageUrl,
    requestPlaceImageFeedback,
    requestPlaceImageHistoryDelete,
    requestPlaceImageHistorySelection,
    requestPlaceImagePromptSuggestions,
    requestPlaceImageReset
  };
}
