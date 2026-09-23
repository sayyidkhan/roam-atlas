import { useEffect, useRef, useState } from "react";
import type { Globe } from "cobe";

import styles from "./CountryCatalog.module.css";
import {
  focusAngles,
  nearestVisibleMarker,
  projectGlobeMarker,
  type GlobePlace
} from "./globeMarkerProjection";

export type GlobeDestination = GlobePlace & {
  name: string;
};

const MARKER_COLOR = [0.86, 0.52, 0.1] as [number, number, number];
const ARC_COLOR = [0.78, 0.46, 0.12] as [number, number, number];
const SINGAPORE = [1.35, 103.82] as [number, number];

const ATLAS_MARKERS = [
  { location: [1.35, 103.82] as [number, number], size: 0.03, color: MARKER_COLOR, id: "singapore" },
  { location: [4.21, 101.98] as [number, number], size: 0.028, color: MARKER_COLOR, id: "malaysia" },
  { location: [13.75, 100.5] as [number, number], size: 0.028, color: MARKER_COLOR, id: "thailand" },
  { location: [16.05, 108.2] as [number, number], size: 0.028, color: MARKER_COLOR, id: "vietnam" },
  { location: [-6.2, 106.85] as [number, number], size: 0.028, color: MARKER_COLOR, id: "indonesia" },
  { location: [35.68, 139.69] as [number, number], size: 0.028, color: MARKER_COLOR, id: "japan" },
  { location: [37.57, 126.98] as [number, number], size: 0.028, color: MARKER_COLOR, id: "south-korea" }
];

const ATLAS_ARCS = [
  [4.21, 101.98],
  [13.75, 100.5],
  [16.05, 108.2],
  [-6.2, 106.85],
  [35.68, 139.69],
  [37.57, 126.98]
].map((location) => ({
  from: SINGAPORE,
  to: location as [number, number],
  color: ARC_COLOR
}));

function canRenderGlobe(): boolean {
  if (typeof window === "undefined" || navigator.userAgent.includes("jsdom")) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

const PIN_CLICK_RADIUS = 32;
const MIN_GLOBE_SCALE = 0.92;
const MAX_GLOBE_SCALE = 1.16;
const INITIAL_GLOBE_SCALE = 1.06;

export function CountryAtlasGlobe({
  destinations,
  onSelect
}: {
  destinations: GlobeDestination[];
  onSelect: (slug: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pinsRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const scaleRef = useRef(INITIAL_GLOBE_SCALE);
  const resetViewRef = useRef<() => void>(() => undefined);
  const destinationsRef = useRef(destinations);
  const onSelectRef = useRef(onSelect);
  const [activeSlug, setActiveSlug] = useState(destinations[0]?.slug ?? "");

  useEffect(() => {
    destinationsRef.current = destinations;
    onSelectRef.current = onSelect;
  }, [destinations, onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !canRenderGlobe()) return;

    let cancelled = false;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let dragging = false;
    let pointer = { x: 0, y: 0 };
    let lastPointerTime = 0;
    let angularVelocity = 0;
    let idleOrbitDistance = 0;
    let lastFrameTime = performance.now();
    let resumeOrbitAt = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [focusPhi, focusTheta] = focusAngles(18, 118);
    let phi = focusPhi;
    let theta = focusTheta;
    resetViewRef.current = () => {
      phi = focusPhi;
      theta = focusTheta;
      scaleRef.current = INITIAL_GLOBE_SCALE;
      angularVelocity = 0;
      idleOrbitDistance = 0;
      resumeOrbitAt = performance.now() + 1800;
    };

    const initializeGlobe = async () => {
      try {
        const { default: createGlobe } = await import("cobe");
        if (cancelled) return;

        canvas = document.createElement("canvas");
        canvas.className = styles["atlas-globe-canvas-element"];
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        mount.append(canvas);

        const resize = () => {
          const width = Math.max(mount.clientWidth, 1);
          const height = Math.max(mount.clientHeight, 1);
          globeRef.current?.update({ width, height });
        };

        globeRef.current = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio, 2),
          width: Math.max(mount.clientWidth, 1),
          height: Math.max(mount.clientHeight, 1),
          phi,
          theta,
          dark: 1,
          diffuse: 1.35,
          scale: scaleRef.current,
          offset: [0, 0],
          mapSamples: 52000,
          mapBrightness: 6.4,
          mapBaseBrightness: 0.06,
          baseColor: [0.08, 0.24, 0.27],
          markerColor: MARKER_COLOR,
          glowColor: [0.86, 0.62, 0.22],
          markers: ATLAS_MARKERS,
          markerElevation: 0.1,
          arcs: ATLAS_ARCS,
          arcColor: ARC_COLOR,
          arcWidth: 0.62,
          arcHeight: 0.38,
          opacity: 1
        });

        let moved = false;
        const onPointerDown = (event: PointerEvent) => {
          dragging = true;
          moved = false;
          pointer = { x: event.clientX, y: event.clientY };
          lastPointerTime = event.timeStamp;
          angularVelocity = 0;
          idleOrbitDistance = 0;
          canvas?.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!canvas) return;
          const bounds = canvas.getBoundingClientRect();
          const slug = nearestVisibleMarker(
            destinationsRef.current.map((destination) => ({
              slug: destination.slug,
              ...projectGlobeMarker({
                height: bounds.height,
                latitude: destination.location[0],
                longitude: destination.location[1],
                phi,
                scale: scaleRef.current,
                theta,
                width: bounds.width
              })
            })),
            { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            PIN_CLICK_RADIUS
          );
          if (slug) setActiveSlug(slug);
          canvas.style.cursor = slug ? "pointer" : "grab";
          if (!dragging) return;
          const deltaX = event.clientX - pointer.x;
          const deltaY = event.clientY - pointer.y;
          const elapsed = Math.max(event.timeStamp - lastPointerTime, 8);
          if (Math.hypot(deltaX, deltaY) > 3) moved = true;
          const phiDelta = deltaX * 0.0065;
          phi += phiDelta;
          theta = Math.max(-0.58, Math.min(0.58, theta + deltaY * 0.0065));
          angularVelocity = reduceMotion ? 0 : phiDelta / elapsed;
          pointer = { x: event.clientX, y: event.clientY };
          lastPointerTime = event.timeStamp;
        };
        const onPointerUp = (event: PointerEvent) => {
          dragging = false;
          resumeOrbitAt = performance.now() + 1800;
          if (canvas?.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
          if (moved || !canvas) return;
          const bounds = canvas.getBoundingClientRect();
          const width = bounds.width;
          const height = bounds.height;
          const slug = nearestVisibleMarker(
            destinationsRef.current.map((destination) => ({
              slug: destination.slug,
              ...projectGlobeMarker({
                height,
                latitude: destination.location[0],
                longitude: destination.location[1],
                phi,
                scale: scaleRef.current,
                theta,
                width
              })
            })),
            { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            PIN_CLICK_RADIUS
          );
          if (slug) onSelectRef.current(slug);
        };
        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          const nextScale = scaleRef.current - event.deltaY * 0.00065;
          scaleRef.current = Math.max(MIN_GLOBE_SCALE, Math.min(MAX_GLOBE_SCALE, nextScale));
          resumeOrbitAt = performance.now() + 1200;
        };

        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });
        canvas.style.touchAction = "none";
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();
        mount.dataset.ready = "true";

        const render = (time: number) => {
          const frameDuration = Math.min(time - lastFrameTime, 40);
          lastFrameTime = time;
          if (!dragging) {
            if (Math.abs(angularVelocity) > 0.00001) {
              phi += angularVelocity * frameDuration;
              angularVelocity *= Math.pow(0.92, frameDuration / 16.67);
            } else if (!reduceMotion && time > resumeOrbitAt && idleOrbitDistance < 0.22) {
              const orbitStep = Math.min(frameDuration * 0.000018, 0.22 - idleOrbitDistance);
              phi += orbitStep;
              idleOrbitDistance += orbitStep;
            }
          }
          globeRef.current?.update({ phi, theta, scale: scaleRef.current });
          const width = mount.clientWidth;
          const height = mount.clientHeight;
          const pins = pinsRef.current;
          if (pins && width > 0 && height > 0) {
            pins.dataset.placed = "true";
            for (const destination of destinationsRef.current) {
              const button = pins.querySelector<HTMLButtonElement>(`[data-slug="${destination.slug}"]`);
              if (!button) continue;
              const projected = projectGlobeMarker({
                height,
                latitude: destination.location[0],
                longitude: destination.location[1],
                phi,
                scale: scaleRef.current,
                theta,
                width
              });
              button.hidden = !projected.visible;
              button.style.left = `${projected.x}px`;
              button.style.top = `${projected.y}px`;
            }
          }
          animationFrame = window.requestAnimationFrame(render);
        };
        animationFrame = window.requestAnimationFrame(render);

        return () => {
          canvas?.removeEventListener("pointerdown", onPointerDown);
          canvas?.removeEventListener("pointermove", onPointerMove);
          canvas?.removeEventListener("pointerup", onPointerUp);
          canvas?.removeEventListener("pointercancel", onPointerUp);
          canvas?.removeEventListener("wheel", onWheel);
        };
      } catch {
        mount.dataset.ready = "false";
        return undefined;
      }
    };

    let removeEventListeners: (() => void) | undefined;
    void initializeGlobe().then((cleanup) => {
      removeEventListeners = cleanup;
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      removeEventListeners?.();
      globeRef.current?.destroy();
      globeRef.current = null;
      resetViewRef.current = () => undefined;
      mount.replaceChildren();
    };
  }, []);

  return (
    <div className={styles["atlas-globe"]}>
      <div className={styles["atlas-globe-stage"]}>
        <div className={styles["atlas-globe-aura"]} aria-hidden="true" />
        <div className={styles["atlas-globe-halo"]} aria-hidden="true" />
        <div className={styles["atlas-globe-plinth"]} aria-hidden="true" />
        <div ref={mountRef} className={styles["atlas-globe-canvas"]} />
        <div className={styles["atlas-globe-fallback"]} aria-hidden="true" />
        <div className={styles["atlas-globe-orbit"]} aria-hidden="true" />
        <div ref={pinsRef} className={styles["atlas-globe-pins"]}>
          {destinations.map((destination) => (
            <button
              key={destination.slug}
              type="button"
              data-slug={destination.slug}
              className={`${styles["atlas-globe-pin"]} ${
                destination.slug === activeSlug ? styles["atlas-globe-pin--active"] : ""
              }`}
              aria-label={`Enter ${destination.name}`}
              onFocus={() => setActiveSlug(destination.slug)}
              onPointerEnter={() => setActiveSlug(destination.slug)}
              onClick={() => onSelect(destination.slug)}
            >
              <span className={styles["atlas-globe-pin-name"]}>{destination.name}</span>
            </button>
          ))}
        </div>
        <div className={styles["atlas-globe-controls"]} aria-label="Globe controls">
          <button
            type="button"
            aria-label="Zoom globe out"
            data-tooltip="Zoom out"
            title="Zoom out"
            onClick={() => {
              scaleRef.current = Math.max(MIN_GLOBE_SCALE, scaleRef.current - 0.08);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 12h12" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Reset globe view"
            data-tooltip="Reset view"
            title="Reset view"
            onClick={() => resetViewRef.current()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19 8a7 7 0 1 0 1 6" />
              <path d="M19 3v5h-5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Zoom globe in"
            data-tooltip="Zoom in"
            title="Zoom in"
            onClick={() => {
              scaleRef.current = Math.min(MAX_GLOBE_SCALE, scaleRef.current + 0.08);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </button>
        </div>
      </div>
      <p className={styles["atlas-globe-hint"]}>Drag to orbit · Scroll to zoom · Select a gold pin</p>
    </div>
  );
}
