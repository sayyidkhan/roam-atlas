import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import { appendPlaceImageHistoryRequest } from "../countrySetup/countryExperiencePolicy";
import {
  draftPhotoLightboxBridge,
  type DraftPhotoLightboxInput
} from "./draftPhotoLightboxBridge";
import type {
  PlaceImageHistoryEntry,
  PlaceImageHistoryResult,
  PlaceImagePromptResult
} from "./placeImageTypes";
import type {
  PlaceImageSessionStore
} from "./placeImageSessionStore";

type LightboxDependencies = {
  APP_CONFIG: {
    placeImages: {
      feedbackMaxLength: number;
    };
  };
  PLACE_IMAGE_REQUEST_SESSION: string;
  getSelectedCountry: () => CountrySummary | null;
  placeImageClient: {
    loadHistory: (input: {
      countrySlug: string;
      place: string;
    }) => Promise<{ items?: PlaceImageHistoryEntry[] }>;
  };
  placeImageSessionStore: PlaceImageSessionStore;
  render: () => void;
  requestPlaceImageFeedback: (
    country: CountrySummary,
    place: string,
    feedback: string
  ) => Promise<boolean>;
  requestPlaceImageHistoryDelete: (
    country: CountrySummary,
    place: string,
    entryId: string
  ) => Promise<PlaceImageHistoryResult | null>;
  requestPlaceImageHistorySelection: (
    country: CountrySummary,
    place: string,
    entryId: string
  ) => Promise<boolean>;
  requestPlaceImagePromptSuggestions: (
    country: CountrySummary,
    options: {
      place: string;
      context: string;
      kind: string;
      currentFeedback: string;
    }
  ) => Promise<PlaceImagePromptResult>;
  requestPlaceImageReset: (
    country: CountrySummary,
    options: { place: string }
  ) => Promise<boolean>;
};

type ActiveLightbox = {
  busyAction: "delete" | "keep" | "reset" | null;
  country: CountrySummary | null;
  history: PlaceImageHistoryEntry[];
  historyIndex: number;
  input: Required<DraftPhotoLightboxInput>;
};

export function createDraftPhotoLightboxController(
  dependencies: LightboxDependencies
) {
  const {
    APP_CONFIG,
    PLACE_IMAGE_REQUEST_SESSION,
    getSelectedCountry,
    placeImageClient,
    placeImageSessionStore,
    render,
    requestPlaceImageFeedback,
    requestPlaceImageHistoryDelete,
    requestPlaceImageHistorySelection,
    requestPlaceImagePromptSuggestions,
    requestPlaceImageReset
  } = dependencies;
  let activeLightbox: ActiveLightbox | null = null;
  let requestVersion = 0;

  const commands = {
    close: closeDraftPhotoLightbox,
    deleteHistoryEntry,
    keepHistoryEntry,
    moveHistory,
    reset: resetReferencePhoto,
    submitFeedback,
    suggestPrompts
  };

  function openDraftPhotoLightbox(
    input: DraftPhotoLightboxInput
  ): void {
    const normalizedInput = normalizeLightboxInput(input);
    requestVersion += 1;
    activeLightbox = {
      busyAction: null,
      country: getSelectedCountry(),
      history: [],
      historyIndex: 0,
      input: normalizedInput
    };
    publish();

    if (activeLightbox.country && normalizedInput.placeName) {
      void loadDraftPhotoHistory(
        activeLightbox,
        requestVersion
      );
    }
  }

  function closeDraftPhotoLightbox(): void {
    requestVersion += 1;
    activeLightbox = null;
    draftPhotoLightboxBridge.clear();
  }

  function moveHistory(offset: number): void {
    if (!activeLightbox?.history.length) return;
    activeLightbox.historyIndex = clampHistoryIndex(
      activeLightbox.historyIndex + offset,
      activeLightbox.history
    );
    publish();
  }

  async function resetReferencePhoto(): Promise<void> {
    const lightbox = activeLightbox;
    if (!lightbox?.country || !lightbox.input.placeName) return;
    lightbox.busyAction = "reset";
    publish();
    const didReset = await requestPlaceImageReset(
      lightbox.country,
      { place: lightbox.input.placeName }
    );
    if (!isActive(lightbox)) return;
    if (didReset) {
      closeDraftPhotoLightbox();
      return;
    }
    lightbox.busyAction = null;
    publish();
  }

  async function submitFeedback(
    feedback: string
  ): Promise<boolean> {
    const lightbox = activeLightbox;
    if (!lightbox?.country || !lightbox.input.placeName) {
      return false;
    }
    const didSubmit = await requestPlaceImageFeedback(
      lightbox.country,
      lightbox.input.placeName,
      feedback
    );
    if (didSubmit && isActive(lightbox)) {
      closeDraftPhotoLightbox();
    }
    return didSubmit;
  }

  async function suggestPrompts(
    currentFeedback: string
  ): Promise<PlaceImagePromptResult> {
    const lightbox = activeLightbox;
    if (!lightbox?.country || !lightbox.input.placeName) {
      return { source: "curated-fallback", suggestions: [] };
    }
    return requestPlaceImagePromptSuggestions(lightbox.country, {
      place: lightbox.input.placeName,
      context: lightbox.input.context,
      kind: lightbox.input.kind,
      currentFeedback
    });
  }

  async function keepHistoryEntry(): Promise<void> {
    const lightbox = activeLightbox;
    const item = currentHistoryEntry(lightbox);
    if (
      !lightbox?.country ||
      !lightbox.input.placeName ||
      !item ||
      item.active
    ) {
      return;
    }
    lightbox.busyAction = "keep";
    publish();
    const didKeep = await requestPlaceImageHistorySelection(
      lightbox.country,
      lightbox.input.placeName,
      item.id
    );
    if (!isActive(lightbox)) return;
    if (didKeep) {
      closeDraftPhotoLightbox();
      return;
    }
    lightbox.busyAction = null;
    publish();
  }

  async function deleteHistoryEntry(): Promise<void> {
    const lightbox = activeLightbox;
    const item = currentHistoryEntry(lightbox);
    if (
      !lightbox?.country ||
      !lightbox.input.placeName ||
      !item
    ) {
      return;
    }
    lightbox.busyAction = "delete";
    publish();
    const result = await requestPlaceImageHistoryDelete(
      lightbox.country,
      lightbox.input.placeName,
      item.id
    );
    if (!isActive(lightbox)) return;
    if (!result) {
      lightbox.busyAction = null;
      publish();
      return;
    }
    if (result.activeDeleted) {
      markReferencePhotoForRefresh(
        lightbox.country,
        lightbox.input.placeName
      );
      closeDraftPhotoLightbox();
      return;
    }

    lightbox.history = normalizeHistoryEntries(result.items);
    if (lightbox.history.length < 2) {
      closeDraftPhotoLightbox();
      return;
    }
    lightbox.historyIndex = clampHistoryIndex(
      lightbox.historyIndex,
      lightbox.history
    );
    lightbox.busyAction = null;
    publish();
  }

  async function loadDraftPhotoHistory(
    lightbox: ActiveLightbox,
    version: number
  ): Promise<void> {
    const country = lightbox.country;
    const place = lightbox.input.placeName;
    if (!country || !place) return;
    try {
      const payload = await placeImageClient.loadHistory({
        countrySlug: country.slug,
        place
      });
      if (!isActive(lightbox) || version !== requestVersion) return;
      const history = normalizeHistoryEntries(payload.items);
      if (history.length < 2) return;
      lightbox.history = history;
      lightbox.historyIndex = Math.max(
        0,
        history.findIndex((item) => item.active)
      );
      publish();
    } catch {
      // History is an optional review aid. The current photo remains usable.
    }
  }

  function markReferencePhotoForRefresh(
    country: CountrySummary,
    place: string
  ): void {
    placeImageSessionStore.markPlaceRefresh(
      country.slug,
      place
    );
    render();
  }

  function publish(): void {
    const lightbox = activeLightbox;
    if (!lightbox) {
      draftPhotoLightboxBridge.clear();
      return;
    }
    const historyItem = currentHistoryEntry(lightbox);
    const historyCount = lightbox.history.length;
    const isBusy = lightbox.busyAction !== null;
    draftPhotoLightboxBridge.publish({
      busyAction: lightbox.busyAction,
      commands,
      feedbackMaxLength:
        APP_CONFIG.placeImages.feedbackMaxLength,
      history:
        historyItem && historyCount >= 2
          ? {
              canDelete: !isBusy,
              canKeep: !isBusy && !historyItem.active,
              canMoveNext:
                !isBusy &&
                lightbox.historyIndex < historyCount - 1,
              canMovePrevious:
                !isBusy && lightbox.historyIndex > 0,
              deleteLabel:
                lightbox.busyAction === "delete"
                  ? "Deleting photo"
                  : "Delete photo",
              keepLabel:
                lightbox.busyAction === "keep"
                  ? "Keeping photo"
                  : historyItem.active
                    ? "Current photo"
                    : "Keep this photo",
              label: `${historyItem.active ? "Current" : "Saved"} ${lightbox.historyIndex + 1} of ${historyCount}`
            }
          : null,
      imageUrl: historyItem
        ? appendPlaceImageHistoryRequest(
            historyItem.imageUrl,
            historyItem.id,
            PLACE_IMAGE_REQUEST_SESSION
          )
        : lightbox.input.src,
      input: lightbox.input
    });
  }

  function isActive(lightbox: ActiveLightbox): boolean {
    return activeLightbox === lightbox;
  }

  return {
    closeDraftPhotoLightbox,
    openDraftPhotoLightbox
  };
}

function normalizeLightboxInput(
  input: DraftPhotoLightboxInput
): Required<DraftPhotoLightboxInput> {
  return {
    context: String(input.context ?? "").trim(),
    kind: String(input.kind ?? "region").trim() || "region",
    placeName: String(input.placeName ?? "").trim(),
    src: String(input.src ?? "").trim()
  };
}

function normalizeHistoryEntries(
  entries: PlaceImageHistoryEntry[] | undefined
): PlaceImageHistoryEntry[] {
  return Array.isArray(entries)
    ? entries.filter((entry) => Boolean(entry?.id && entry?.imageUrl))
    : [];
}

function currentHistoryEntry(
  lightbox: ActiveLightbox | null
): PlaceImageHistoryEntry | null {
  if (!lightbox) return null;
  return lightbox.history[lightbox.historyIndex] ?? null;
}

function clampHistoryIndex(
  index: number,
  history: PlaceImageHistoryEntry[]
): number {
  return Math.max(0, Math.min(index, history.length - 1));
}
