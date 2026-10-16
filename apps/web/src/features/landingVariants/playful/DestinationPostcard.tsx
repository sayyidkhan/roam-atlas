import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { APP_CONFIG } from "../../../config/appConfig";
import type { CountryCatalogCountry } from "../../countryCatalog/CountryCardMedia";
import styles from "./PlayfulLanding.module.css";

const MAX_DRIFT_X = 100;
const MAX_DRIFT_Y = 65;

export function DestinationPostcard({
  country,
  index,
  status,
  onOpen,
  onConfigure
}: {
  country: CountryCatalogCountry;
  index: number;
  status: string;
  onOpen: () => void;
  onConfigure?: () => void;
}) {
  const media = APP_CONFIG.countryCatalog;
  const extension = media.localAssetExtensionOverrides[country.slug as keyof typeof media.localAssetExtensionOverrides] ?? media.localAssetExtension;
  const photoUrl = `${media.localAssetBasePath}/${country.slug}.${extension}`;
  const [photoFailed, setPhotoFailed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (origin.current?.pointerId !== event.pointerId) return;
    origin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const moveWithKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10]
    };
    if (event.key === "Escape") {
      event.preventDefault();
      setOffset({ x: 0, y: 0 });
    } else if (direction[event.key]) {
      event.preventDefault();
      const [x, y] = direction[event.key];
      setOffset((current) => ({ x: clamp(current.x + x, MAX_DRIFT_X), y: clamp(current.y + y, MAX_DRIFT_Y) }));
    }
  };

  return (
    <article
      className={`${styles.postcard} ${dragging ? styles["postcard--dragging"] : ""}`}
      aria-label={`${country.name}, ${status}`}
      style={{ "--card-index": index, "--drag-x": `${offset.x}px`, "--drag-y": `${offset.y}px` } as CSSProperties}
    >
      <div className={styles["postcard-top"]}>
        <span className={styles["postcard-code"]}>{country.displayCode} / {String(index + 1).padStart(2, "0")}</span>
        <button
          type="button"
          className={styles["postcard-handle"]}
          aria-label={`Move ${country.name} postcard`}
          aria-describedby="playful-postcard-move-help"
          onKeyDown={moveWithKeys}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            origin.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const start = origin.current;
            if (!start || start.pointerId !== event.pointerId) return;
            setOffset({
              x: clamp(start.offsetX + event.clientX - start.x, MAX_DRIFT_X),
              y: clamp(start.offsetY + event.clientY - start.y, MAX_DRIFT_Y)
            });
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={() => {
            origin.current = null;
            setDragging(false);
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h1m6 0h1M6 10h1m6 0h1M6 16h1m6 0h1" /></svg>
        </button>
      </div>
      <button type="button" className={styles["postcard-open"]} aria-label={`Open ${country.name}`} onClick={onOpen}>
        <div className={styles["postcard-image"]}>
          <span className={styles["photo-fallback"]} aria-hidden="true">{country.displayCode}<small>YOUR NEXT CHAPTER</small></span>
          {!photoFailed ? <img src={photoUrl} alt="" loading="lazy" decoding="async" onError={() => setPhotoFailed(true)} /> : null}
          <span className={styles["postcard-arrow"]} aria-hidden="true">↗</span>
        </div>
        <span className={styles["postcard-name"]}>{country.name}</span>
        <span className={styles["postcard-status"]}>{status}</span>
      </button>
      {onConfigure ? <button type="button" className={styles.configure} aria-label={`Configure ${country.name}`} onClick={onConfigure}>Customize atlas ↗</button> : null}
    </article>
  );
}
