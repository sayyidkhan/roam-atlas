import { useEffect, useRef } from "react";
import type { Globe } from "cobe";

import styles from "./CountryCatalog.module.css";

const ATLAS_MARKERS = [
  {
    location: [1.3521, 103.8198] as [number, number],
    size: 0.075,
    color: [0.96, 0.78, 0.4] as [number, number, number],
    id: "singapore"
  },
  {
    location: [4.2105, 101.9758] as [number, number],
    size: 0.055,
    color: [0.56, 0.82, 0.78] as [number, number, number],
    id: "malaysia"
  }
];

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

export function CountryAtlasGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !canRenderGlobe()) return;

    let cancelled = false;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let dragging = false;
    let pointer = { x: 0, y: 0 };
    let phi = 3.46;
    let theta = 0.18;

    const initializeGlobe = async () => {
      try {
        const { default: createGlobe } = await import("cobe");
        if (cancelled) return;

        canvas = document.createElement("canvas");
        canvas.className = styles["atlas-globe-canvas-element"];
        canvas.setAttribute("aria-hidden", "true");
        mount.append(canvas);

        const resize = () => {
          const width = Math.max(mount.clientWidth, 1);
          const height = Math.max(mount.clientHeight, 1);
          canvas?.style.setProperty("width", `${width}px`);
          canvas?.style.setProperty("height", `${height}px`);
          globeRef.current?.update({ width, height });
        };

        globeRef.current = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio, 2),
          width: Math.max(mount.clientWidth, 1),
          height: Math.max(mount.clientHeight, 1),
          phi,
          theta,
          dark: 0,
          diffuse: 1.15,
          mapSamples: 22000,
          mapBrightness: 5.5,
          mapBaseBrightness: 0.18,
          baseColor: [0.12, 0.34, 0.34],
          markerColor: [0.96, 0.78, 0.4],
          glowColor: [0.74, 0.88, 0.85],
          markers: ATLAS_MARKERS,
          markerElevation: 0.045,
          opacity: 0.97
        });

        const onPointerDown = (event: PointerEvent) => {
          dragging = true;
          pointer = { x: event.clientX, y: event.clientY };
          canvas?.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!dragging) return;
          phi += (event.clientX - pointer.x) * 0.008;
          theta = Math.max(-0.52, Math.min(0.52, theta + (event.clientY - pointer.y) * 0.008));
          pointer = { x: event.clientX, y: event.clientY };
        };
        const onPointerUp = (event: PointerEvent) => {
          dragging = false;
          if (canvas?.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
        };

        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);
        canvas.style.touchAction = "none";
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();
        mount.dataset.ready = "true";

        const render = () => {
          if (!dragging) phi += 0.0018;
          globeRef.current?.update({ phi, theta });
          animationFrame = window.requestAnimationFrame(render);
        };
        render();

        return () => {
          canvas?.removeEventListener("pointerdown", onPointerDown);
          canvas?.removeEventListener("pointermove", onPointerMove);
          canvas?.removeEventListener("pointerup", onPointerUp);
          canvas?.removeEventListener("pointercancel", onPointerUp);
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
      mount.replaceChildren();
    };
  }, []);

  return (
    <div className={styles["atlas-globe"]}>
      <div ref={mountRef} className={styles["atlas-globe-canvas"]} />
      <div className={styles["atlas-globe-fallback"]} aria-hidden="true" />
      <div className={styles["atlas-globe-orbit"]} aria-hidden="true" />
      <p className={styles["atlas-globe-hint"]}>Drag to explore · Choose a country to enter</p>
    </div>
  );
}
