import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties
} from "react";

import {
  explorerDestinationBridge,
  type ExplorerDestinationItem
} from "./explorerDestinationBridge";

const READY_PROGRESS_STYLE = {
  "--prefetch-progress": "100%"
} as CSSProperties;

export function ExplorerLoadingBoard() {
  const snapshot = useSyncExternalStore(
    explorerDestinationBridge.subscribe,
    explorerDestinationBridge.getSnapshot
  );
  const board = snapshot?.board;
  if (!board) return null;

  return (
    <section
      className="loading-scene-board"
      aria-label={`${board.pageTitle} loading`}
      aria-busy={board.isBusy}
    >
      <div className="loading-scene-board-head">
        <div>
          <span className="loading-scene-eyebrow">
            Illustration layer
          </span>
          <strong>{board.headline}</strong>
          <p aria-live="polite">{board.detail}</p>
        </div>

        {board.isFailed ? (
          <button
            type="button"
            className="artwork-retry-button"
            data-roam-focus-key={`artwork-retry:${board.artworkJobKey}`}
            onClick={() =>
              snapshot.commands.retryArtwork(
                board.artworkJobKey
              )
            }
          >
            Retry illustration
          </button>
        ) : board.isUnmappedStarterCountry ? (
          <button
            type="button"
            className="artwork-retry-button"
            onClick={snapshot.commands.openCountrySetup}
          >
            Set up locations
          </button>
        ) : (
          <span className="loading-scene-count">
            {board.readyCount}/{board.totalCount} ready
          </span>
        )}
      </div>

      <div
        className={[
          "loading-scene-progress",
          board.isBusy
            ? "loading-scene-progress--indeterminate"
            : "",
          board.isFailed
            ? "loading-scene-progress--failed"
            : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        <span />
      </div>

      {board.isUnmappedStarterCountry ? (
        <div
          className="loading-destination-grid loading-destination-grid--empty"
          aria-label="Available destinations"
        >
          <section
            className="loading-destination-empty"
            aria-label="Locations pending review"
          >
            <span
              className="loading-destination-empty-icon"
              aria-hidden="true"
            >
              +
            </span>
            <div>
              <strong>Locations pending review</strong>
              <p>
                Build an AI starter map in setup to create
                clearly labelled, unconfirmed candidate
                regions. Review sources before they become
                verified travel locations.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <div
          className="loading-destination-grid"
          aria-label="Available destinations"
        >
          {board.items.map((item) => (
            <DestinationCard
              item={item}
              key={item.key}
              onOpen={snapshot.commands.openDestination}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ExplorerRegionRail() {
  const snapshot = useSyncExternalStore(
    explorerDestinationBridge.subscribe,
    explorerDestinationBridge.getSnapshot
  );
  const rail = snapshot?.rail;
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] =
    useState(false);

  useEffect(() => {
    syncScrollControls();
  }, [rail]);

  if (!rail) return null;

  function syncScrollControls(): void {
    const list = listRef.current;
    if (!list) return;
    const maxScrollLeft = Math.max(
      0,
      list.scrollWidth - list.clientWidth
    );
    setCanScrollBack(list.scrollLeft > 2);
    setCanScrollForward(
      list.scrollLeft < maxScrollLeft - 2
    );
  }

  function scroll(direction: -1 | 1): void {
    const list = listRef.current;
    if (!list) return;
    const distance = Math.max(
      240,
      list.clientWidth * 0.65
    );
    list.scrollBy?.({
      behavior: "smooth",
      left: distance * direction
    });
  }

  return (
    <nav className="region-rail" aria-label="Explore regions">
      {rail.readiness ? (
        <span className="visually-hidden">
          {rail.readiness}
        </span>
      ) : null}
      <div className="region-rail-controls">
        <button
          type="button"
          className="region-rail-scroll-button"
          aria-label="Show previous destinations"
          disabled={!canScrollBack}
          onClick={() => scroll(-1)}
        >
          ←
        </button>
        <div
          className="region-rail-list"
          role="list"
          ref={listRef}
          onScroll={syncScrollControls}
        >
          {rail.items.map((item) => (
            <DestinationRailItem
              item={item}
              key={item.key}
              onOpen={snapshot.commands.openDestination}
            />
          ))}
        </div>
        <button
          type="button"
          className="region-rail-scroll-button"
          aria-label="Show more destinations"
          disabled={!canScrollForward}
          onClick={() => scroll(1)}
        >
          →
        </button>
      </div>
    </nav>
  );
}

function DestinationCard({
  item,
  onOpen
}: {
  item: ExplorerDestinationItem;
  onOpen: (item: ExplorerDestinationItem) => void;
}) {
  return (
    <button
      type="button"
      className={`loading-destination-card loading-destination-card--${item.phase}`}
      style={
        item.phase === "ready"
          ? READY_PROGRESS_STYLE
          : undefined
      }
      data-roam-focus-key={`loading-destination:${item.key}`}
      aria-label={`${item.label}, ${item.readinessLabel}`}
      onClick={() => onOpen(item)}
    >
      <span
        className="loading-destination-progress"
        aria-hidden="true"
      />
      <span className="loading-destination-index">
        {item.mapNumber}
      </span>
      <span className="loading-destination-copy">
        <strong>{item.label}</strong>
        <span>{item.statusText}</span>
      </span>
      {item.phase === "ready" ? <DestinationCheck /> : null}
    </button>
  );
}

function DestinationRailItem({
  item,
  onOpen
}: {
  item: ExplorerDestinationItem;
  onOpen: (item: ExplorerDestinationItem) => void;
}) {
  return (
    <button
      type="button"
      className={`region-rail-item region-rail-item--${item.phase}`}
      style={
        item.phase === "ready"
          ? READY_PROGRESS_STYLE
          : undefined
      }
      data-roam-focus-key={`region:${item.key}`}
      title={`${item.label} - ${item.readinessLabel}`}
      aria-label={`${item.mapNumber ? `Map ${item.mapNumber}, ` : ""}${item.label}, ${item.readinessLabel}`}
      onClick={() => onOpen(item)}
    >
      <span
        className="region-rail-progress"
        aria-hidden="true"
      />
      {item.mapNumber ? (
        <span
          className="region-rail-number"
          aria-hidden="true"
        >
          {item.mapNumber}
        </span>
      ) : null}
      <span className="region-rail-label">
        {item.label}
      </span>
      {item.phase === "ready" ? <DestinationCheck /> : null}
    </button>
  );
}

function DestinationCheck() {
  return (
    <span className="region-rail-check" aria-hidden="true">
      <svg viewBox="0 0 14 14" focusable="false">
        <path d="M3.1 7.1 5.8 9.8 11 4.2" />
      </svg>
    </span>
  );
}
