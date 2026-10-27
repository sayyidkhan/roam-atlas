import {
  useEffect,
  useCallback,
  useId,
  useRef,
  useState,
  type CSSProperties
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
  const retryTimerRef = useRef<number | null>(null);
  const attemptSettledRef = useRef(false);
  const owner = useId();
  const { register, release } = useDraftReferencePhotoRegistry();
  const [attempt, setAttempt] = useState(0);
  const [manualRetry, setManualRetry] = useState(0);
  const [isImageEnabled, setIsImageEnabled] = useState(true);
  const [view, setView] =
    useState<PhotoViewState>(INITIAL_PHOTO_STATE);
  const lifecycle = APP_CONFIG.placeImages.loadLifecycle;
  const imageSrc = manualRetry > 0 ? retryImageUrl(src, manualRetry) : src;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    timersRef.current = [];
  }, []);

  useEffect(() => () => {
    clearTimers();
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    release(owner);
  }, [clearTimers, owner, release]);

  const failPhoto = useCallback(() => {
    if (attemptSettledRef.current) return;
    attemptSettledRef.current = true;
    clearTimers();
    setView({ label: "Photo unavailable · click to retry", progress: 1, state: "failed" });
    setIsImageEnabled(false);
  }, [clearTimers]);

  const retryPhoto = useCallback((label: string) => {
    if (attemptSettledRef.current) return;
    if (attempt >= lifecycle.maxRetries) {
      failPhoto();
      return;
    }
    attemptSettledRef.current = true;
    clearTimers();

    setView({
      label,
      progress: 0.22,
      state: "searching"
    });
    setIsImageEnabled(false);
    // The failed image's effect cleans up load timers. Keep the backoff separate
    // so that cleanup cannot cancel the next request and strand the spinner.
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setAttempt((current) => current + 1);
      setIsImageEnabled(true);
    }, lifecycle.retryBaseDelayMs * (attempt + 1));
  }, [
    attempt,
    clearTimers,
    failPhoto,
    lifecycle.maxRetries,
    lifecycle.retryBaseDelayMs
  ]);

  const handleLoad = useCallback(() => {
    const image = imageRef.current;
    if (attemptSettledRef.current || !image) return;
    attemptSettledRef.current = true;
    clearTimers();
    const imageUrl = image.currentSrc || image.src;
    if (!register(imageUrl, owner)) {
      setView({ label: "Duplicate", progress: 1, state: "duplicate" });
      setIsImageEnabled(false);
      return;
    }
    setView({ label: "Ready", progress: 1, state: "ready" });
  }, [clearTimers, owner, register]);

  useEffect(() => {
    if (!src) {
      failPhoto();
      return;
    }
    if (!isImageEnabled) return;
    attemptSettledRef.current = false;
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      handleLoad();
      return clearTimers;
    }
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
        failPhoto,
        lifecycle.timeoutMs
      )
    ];
    return clearTimers;
  }, [
    clearTimers,
    failPhoto,
    handleLoad,
    isImageEnabled,
    lifecycle.cachingDelayMs,
    lifecycle.selectingDelayMs,
    lifecycle.slowSearchDelayMs,
    lifecycle.timeoutMs,
    attempt,
    src
  ]);

  function openPhoto() {
    if (view.state === "failed") {
      setView(INITIAL_PHOTO_STATE);
      setManualRetry((current) => current + 1);
      setAttempt(0);
      setIsImageEnabled(true);
      return;
    }
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
      title={view.state === "failed" ? "Photo unavailable. Click to retry." : undefined}
      style={style}
      onClick={openPhoto}
    >
      <span className="draft-item-photo-frame">
        {isImageEnabled && src ? (
          <img
            ref={imageRef}
            key={attempt}
            className="draft-item-photo"
            src={imageSrc}
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
          {view.state === "failed" ? <span>Retry</span> : <svg viewBox="0 0 24 24" focusable="false">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <circle cx="9" cy="9.5" r="1.5" />
            <path d="m5.5 17 4.25-4.25 2.75 2.75 2-2 3.5 3.5" />
            <path d="M4 3 20 21" />
          </svg>}
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

function retryImageUrl(src: string, attempt: number): string {
  const url = new URL(src, window.location.origin);
  url.searchParams.set("retryMissing", "1");
  url.searchParams.set("retryAttempt", String(attempt));
  return url.href;
}
