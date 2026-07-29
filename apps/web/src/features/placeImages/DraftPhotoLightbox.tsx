import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent
} from "react";

import { DraftPhotoFeedbackForm } from "./DraftPhotoFeedbackForm";
import {
  draftPhotoLightboxBridge,
  type DraftPhotoHistorySnapshot,
  type DraftPhotoLightboxSnapshot
} from "./draftPhotoLightboxBridge";

export function DraftPhotoLightbox() {
  const snapshot = useSyncExternalStore(
    draftPhotoLightboxBridge.subscribe,
    draftPhotoLightboxBridge.getSnapshot,
    draftPhotoLightboxBridge.getSnapshot
  );
  if (!snapshot) return null;
  const identity = [
    snapshot.input.placeName,
    snapshot.input.src
  ].join(":");
  return (
    <DraftPhotoLightboxDialog
      key={identity}
      snapshot={snapshot}
    />
  );
}

function DraftPhotoLightboxDialog({
  snapshot
}: {
  snapshot: DraftPhotoLightboxSnapshot;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { commands, history, input } = snapshot;

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") commands.close();
    };
    document.addEventListener("keydown", handleKeydown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener(
      "keydown",
      handleKeydown
    );
  }, [commands]);

  function handleBackdropClick(
    event: MouseEvent<HTMLElement>
  ) {
    if (event.currentTarget === event.target) commands.close();
  }

  return (
    <section
      className="draft-photo-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={
        input.placeName
          ? `Reference photo for ${input.placeName}`
          : "Reference photo"
      }
      onClick={handleBackdropClick}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="sheet-close draft-photo-lightbox-close"
        data-close-draft-photo
        aria-label="Close enlarged photo"
        onClick={commands.close}
      >
        <CloseIcon />
      </button>
      {input.placeName ? (
        <section
          className="draft-photo-lightbox-controls"
          aria-label="Reference photo controls"
        >
          <DraftPhotoActions
            isFeedbackOpen={isFeedbackOpen}
            snapshot={snapshot}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
          />
          {history ? (
            <DraftPhotoHistoryControls
              history={history}
              commands={commands}
            />
          ) : null}
          {isFeedbackOpen ? (
            <DraftPhotoFeedbackForm
              feedbackMaxLength={snapshot.feedbackMaxLength}
              submitFeedback={commands.submitFeedback}
              suggestPrompts={commands.suggestPrompts}
              onCancel={() => setIsFeedbackOpen(false)}
            />
          ) : null}
        </section>
      ) : null}
      <figure className="draft-photo-lightbox">
        <div className="draft-photo-lightbox-image-frame">
          <img
            className="draft-photo-lightbox-image"
            src={snapshot.imageUrl}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
        <figcaption className="draft-photo-lightbox-caption">
          Reference photo from external search. Not verified travel
          data.
        </figcaption>
      </figure>
    </section>
  );
}

function DraftPhotoActions({
  isFeedbackOpen,
  snapshot,
  onOpenFeedback
}: {
  isFeedbackOpen: boolean;
  snapshot: DraftPhotoLightboxSnapshot;
  onOpenFeedback: () => void;
}) {
  const isResetting = snapshot.busyAction === "reset";
  return (
    <div className="draft-photo-lightbox-actions">
      <button
        type="button"
        className="draft-photo-lightbox-reset"
        data-reset-draft-photo
        aria-label={`Reset reference photo for ${snapshot.input.placeName}`}
        disabled={snapshot.busyAction !== null}
        onClick={() => void snapshot.commands.reset()}
      >
        <ResetIcon />
        <span>
          {isResetting ? "Resetting image" : "Reset image"}
        </span>
      </button>
      <button
        type="button"
        className="draft-photo-lightbox-refine"
        data-open-draft-photo-feedback
        aria-expanded={isFeedbackOpen}
        disabled={snapshot.busyAction !== null}
        onClick={onOpenFeedback}
      >
        Find a better photo
      </button>
    </div>
  );
}

function DraftPhotoHistoryControls({
  history,
  commands
}: {
  history: DraftPhotoHistorySnapshot;
  commands: DraftPhotoLightboxSnapshot["commands"];
}) {
  return (
    <nav
      className="draft-photo-lightbox-history"
      data-draft-photo-history
      aria-label="Saved reference photos"
    >
      <button
        type="button"
        data-draft-photo-previous
        aria-label="Show previous saved photo"
        disabled={!history.canMovePrevious}
        onClick={() => commands.moveHistory(-1)}
      >
        ←
      </button>
      <span data-draft-photo-history-label>{history.label}</span>
      <button
        type="button"
        data-draft-photo-next
        aria-label="Show next saved photo"
        disabled={!history.canMoveNext}
        onClick={() => commands.moveHistory(1)}
      >
        →
      </button>
      <button
        type="button"
        data-draft-photo-keep
        disabled={!history.canKeep}
        onClick={() => void commands.keepHistoryEntry()}
      >
        {history.keepLabel}
      </button>
      <button
        type="button"
        data-draft-photo-delete
        disabled={!history.canDelete}
        onClick={() => void commands.deleteHistoryEntry()}
      >
        {history.deleteLabel}
      </button>
    </nav>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path d="M17.7 6.3A7.7 7.7 0 1 0 20 12h-2a5.7 5.7 0 1 1-1.7-4.1L13.5 10.7H21V3.2l-3.3 3.1Z" />
    </svg>
  );
}
