import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent
} from "react";

import { APP_CONFIG } from "../../config/appConfig";
import type { DraftNode } from "./countryDraftTypes";
import type { DraftReferencePhotoInput } from "./countryDraftViewModel";
import { useDraftReferencePhotoRegistry } from "./draftReferencePhotoRegistry";

type CountryDraftReferencePhotoProps = {
  buildUrl: (
    placeName: string,
    context: string,
    kind: string
  ) => string;
  children?: DraftNode[];
  kind: string;
  onOpen: (input: DraftReferencePhotoInput) => void;
  placeName: string;
};

type PhotoViewState = {
  label: string;
  progress: number;
  state:
    | "caching"
    | "duplicate"
    | "failed"
    | "queued"
    | "ready"
    | "searching"
    | "selecting";
};

const INITIAL_PHOTO_STATE: PhotoViewState = {
  label: "Searching",
  progress: 0.18,
  state: "searching"
};

export function CountryDraftReferencePhoto({
  buildUrl,
  children,
  kind,
  onOpen,
  placeName
}: CountryDraftReferencePhotoProps) {
  const context = (children ?? [])
    .slice(0, 3)
    .map((child) => child.name)
    .filter(Boolean)
    .join(" ");
  const src = buildUrl(placeName, context, kind);

  return (
    <DraftReferencePhotoLoader
      key={src}
      context={context}
      kind={kind}
      onOpen={onOpen}
      placeName={placeName}
      src={src}
    />
  );
}

function DraftReferencePhotoLoader({
  context,
  kind,
  onOpen,
  placeName,
  src
}: {
  context: string;
  kind: string;
  onOpen: (input: DraftReferencePhotoInput) => void;
  placeName: string;
  src: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const timersRef = useRef<number[]>([]);
  const attemptSettledRef = useRef(false);
  const registerLoadedPhoto = useDraftReferencePhotoRegistry();
  const [attempt, setAttempt] = useState(0);
  const [isImageEnabled, setIsImageEnabled] = useState(true);
  const [view, setView] =
    useState<PhotoViewState>(INITIAL_PHOTO_STATE);
  const lifecycle = APP_CONFIG.placeImages.loadLifecycle;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    timersRef.current = [];
  }, []);

  const retryPhoto = useCallback((label: string) => {
    if (attemptSettledRef.current) return;
    attemptSettledRef.current = true;
    clearTimers();
    if (attempt >= lifecycle.maxRetries) {
      setView({
        label: "No photo",
        progress: 1,
        state: "failed"
      });
      setIsImageEnabled(false);
      return;
    }

    setView({
      label,
      progress: 0.22,
      state: "searching"
    });
    setIsImageEnabled(false);
    const retryTimer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      setIsImageEnabled(true);
    }, lifecycle.retryBaseDelayMs * (attempt + 1));
    timersRef.current = [retryTimer];
  }, [
    attempt,
    clearTimers,
    lifecycle.maxRetries,
    lifecycle.retryBaseDelayMs
  ]);

  useEffect(() => {
    if (!isImageEnabled || !src) return;
    attemptSettledRef.current = false;
    timersRef.current = [
      window.setTimeout(
        () =>
          setView({
            label: "Selecting",
            progress: 0.52,
            state: "selecting"
          }),
        lifecycle.selectingDelayMs
      ),
      window.setTimeout(
        () =>
          setView({
            label: "Caching",
            progress: 0.78,
            state: "caching"
          }),
        lifecycle.cachingDelayMs
      ),
      window.setTimeout(
        () =>
          setView({
            label: "Still searching",
            progress: 0.82,
            state: "searching"
          }),
        lifecycle.slowSearchDelayMs
      ),
      window.setTimeout(
        () => retryPhoto("Retrying search"),
        lifecycle.timeoutMs
      )
    ];
    return clearTimers;
  }, [
    clearTimers,
    isImageEnabled,
    lifecycle.cachingDelayMs,
    lifecycle.selectingDelayMs,
    lifecycle.slowSearchDelayMs,
    lifecycle.timeoutMs,
    retryPhoto,
    src
  ]);

  function handleLoad(
    event: SyntheticEvent<HTMLImageElement>
  ) {
    if (attemptSettledRef.current) return;
    attemptSettledRef.current = true;
    clearTimers();
    const imageUrl =
      event.currentTarget.currentSrc || event.currentTarget.src;
    if (!registerLoadedPhoto(imageUrl)) {
      setView({
        label: "Duplicate",
        progress: 1,
        state: "duplicate"
      });
      setIsImageEnabled(false);
      return;
    }
    setView({ label: "Ready", progress: 1, state: "ready" });
  }

  function openPhoto() {
    const loadedSrc =
      imageRef.current?.currentSrc || imageRef.current?.src;
    if (!loadedSrc || view.state !== "ready") return;
    onOpen({
      src: loadedSrc,
      placeName,
      context,
      kind
    });
  }

  const style = {
    "--draft-photo-progress": `${Math.round(
      Math.max(0, Math.min(view.progress, 1)) * 100
    )}%`
  } as CSSProperties;

  return (
    <button
      type="button"
      className="draft-item-photo-button"
      data-draft-place-photo
      data-photo-state={view.state}
      data-place-name={placeName}
      data-place-context={context}
      data-place-kind={kind}
      aria-label={`Reference photo for ${placeName}: ${view.label}`}
      style={style}
      onClick={openPhoto}
    >
      <span className="draft-item-photo-frame">
        {isImageEnabled && src ? (
          <img
            ref={imageRef}
            key={attempt}
            className="draft-item-photo"
            src={src}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
            onError={() => retryPhoto("Retrying")}
          />
        ) : null}
        <span className="draft-photo-progress" aria-hidden="true">
          <span />
        </span>
        <span className="draft-photo-spinner" aria-hidden="true" />
        <span className="draft-photo-fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <circle cx="9" cy="9.5" r="1.5" />
            <path d="m5.5 17 4.25-4.25 2.75 2.75 2-2 3.5 3.5" />
            <path d="M4 3 20 21" />
          </svg>
        </span>
        <span className="draft-photo-status">{view.label}</span>
        <span className="draft-photo-ready" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            <path d="m3.4 8.2 2.8 2.8 6.4-6.4" />
          </svg>
        </span>
      </span>
    </button>
  );
}
