import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { useStore } from "zustand";

import { getContainedImageRect } from "./sceneGeometry";
import { ExplorerEnvironmentLayers } from "./ExplorerEnvironmentLayers";
import {
  explorerSceneStore,
  type ExplorerSceneSnapshot,
  type ExplorerSceneTarget
} from "./explorerSceneStore";
import { toScenePercent } from "./explorerScenePolicy";
import { ExplorerLoadingBoard } from "./ExplorerDestinationNavigation";

export function ExplorerSceneStage() {
  const snapshot = useStore(
    explorerSceneStore,
    (state) => state.snapshot
  );
  const [imageAspect, setImageAspect] = useState<
    number | null
  >(null);

  if (!snapshot) {
    return (
      <div className="scroll-stage" id="scroll-stage">
        <ExplorerLoadingBoard />
      </div>
    );
  }

  const spaceAspect =
    snapshot.scene.coordinateSpace.width /
    snapshot.scene.coordinateSpace.height;
  const displayAspect = snapshot.displayImage
    ? imageAspect ?? 3 / 2
    : spaceAspect;
  const stageStyle = {
    "--scene-display-aspect": String(displayAspect),
    "--scene-space-aspect": String(spaceAspect),
    "--scene-space-height": String(
      snapshot.scene.coordinateSpace.height
    ),
    "--scene-space-width": String(
      snapshot.scene.coordinateSpace.width
    )
  } as CSSProperties;

  return (
    <div
      className={[
        "scroll-stage",
        snapshot.hasFinalArtwork ? "has-local-art" : "",
        snapshot.displayImage?.isPreview
          ? "has-artwork-preview"
          : "",
        snapshot.isArtworkPending
          ? "is-artwork-pending"
          : "",
        snapshot.hasFinalArtwork
          ? ""
          : "scroll-stage--placeholder"
      ]
        .filter(Boolean)
        .join(" ")}
      id="scroll-stage"
      data-scene={snapshot.scene.id}
      aria-busy={snapshot.isArtworkPending}
      style={stageStyle}
    >
      <SceneCanvas
        snapshot={snapshot}
        onImageAspectChange={setImageAspect}
      />
      <ExplorerLoadingBoard />
      {snapshot.isArtworkPending ? (
        <div
          className="artwork-pending"
          role="status"
          aria-live="polite"
        >
          <span
            className="scroll-status-dot"
            aria-hidden="true"
          />
          <span>{snapshot.pageTitle}</span>
        </div>
      ) : null}
    </div>
  );
}

function SceneCanvas({
  onImageAspectChange,
  snapshot
}: {
  onImageAspectChange: (aspect: number) => void;
  snapshot: ExplorerSceneSnapshot;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [overlayStyle, setOverlayStyle] =
    useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!snapshot.showImageOverlays) {
      return;
    }
    const sync = () => {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (
        !canvas ||
        !image ||
        !image.naturalWidth ||
        !image.naturalHeight
      ) {
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      const imageRect = getContainedImageRect(image);
      if (
        !canvasRect.width ||
        !canvasRect.height ||
        !imageRect.width ||
        !imageRect.height
      ) {
        return;
      }
      setOverlayStyle({
        height: `${(imageRect.height / canvasRect.height) * 100}%`,
        left: `${((imageRect.left - canvasRect.left) / canvasRect.width) * 100}%`,
        top: `${((imageRect.top - canvasRect.top) / canvasRect.height) * 100}%`,
        width: `${(imageRect.width / canvasRect.width) * 100}%`
      });
    };
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(sync)
        : null;
    if (canvasRef.current) {
      observer?.observe(canvasRef.current);
    }
    window.addEventListener("resize", sync);
    const frame = window.requestAnimationFrame(sync);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", sync);
      window.cancelAnimationFrame(frame);
    };
  }, [
    snapshot.displayImage?.url,
    snapshot.showImageOverlays
  ]);

  return (
    <div
      className={
        snapshot.displayImage
          ? "scene-canvas scene-canvas--artwork"
          : "scene-canvas"
      }
      data-scene-id={snapshot.scene.id}
      role="img"
      aria-label={snapshot.scene.title}
      aria-busy={snapshot.isArtworkPending}
      ref={canvasRef}
    >
      {snapshot.displayImage ? (
        <img
          className={[
            "scene-image",
            snapshot.displayImage.isPreview
              ? "scene-image--preview"
              : ""
          ]
            .filter(Boolean)
            .join(" ")}
          src={snapshot.displayImage.url}
          alt={
            snapshot.displayImage.isPreview
              ? `${snapshot.scene.title} illustration preview`
              : `${snapshot.scene.title} illustration`
          }
          decoding="async"
          draggable={false}
          ref={imageRef}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) {
              onImageAspectChange(
                image.naturalWidth / image.naturalHeight
              );
            }
          }}
        />
      ) : null}

      {snapshot.tiles.map((tile) => (
        <SceneTile
          coordinateSpace={snapshot.scene.coordinateSpace}
          key={tile.id}
          tile={tile}
        />
      ))}

      {snapshot.showImageOverlays ? (
        <div
          className="scene-image-overlay-frame"
          data-coordinate-space="rendered-artwork"
          style={overlayStyle}
        >
          <ExplorerEnvironmentLayers
            environmentPlan={snapshot.environmentPlan}
            scene={snapshot.scene}
          />
          {snapshot.targets.map((target) => (
            <SceneTarget
              key={`${target.nodeId}:${target.mode}`}
              onOpen={snapshot.commands.openTarget}
              target={target}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SceneTile({
  coordinateSpace,
  tile
}: {
  coordinateSpace: {
    height: number;
    width: number;
  };
  tile: ExplorerSceneSnapshot["tiles"][number];
}) {
  const style = {
    backgroundImage: tile.imageUrl
      ? `url("${tile.imageUrl}")`
      : undefined,
    height: toScenePercent(
      tile.bounds.height,
      coordinateSpace.height
    ),
    left: toScenePercent(
      tile.bounds.x,
      coordinateSpace.width
    ),
    top: toScenePercent(
      tile.bounds.y,
      coordinateSpace.height
    ),
    width: toScenePercent(
      tile.bounds.width,
      coordinateSpace.width
    )
  };

  return (
    <div
      className={[
        "tile",
        `tile--${tile.column % 4}`,
        tile.imageUrl ? "tile--image" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {!tile.imageUrl ? (
        <div
          className="tile-art"
          data-column={tile.column}
        >
          <span className="wash wash-a" />
          <span className="wash wash-b" />
          <span className="ink-line line-a" />
          <span className="ink-line line-b" />
          <span className="motif motif-a" />
          <span className="motif motif-b" />
          <span className="motif motif-c" />
          <span className="path path-a" />
          <span className="path path-b" />
        </div>
      ) : null}
    </div>
  );
}

function SceneTarget({
  onOpen,
  target
}: {
  onOpen: (target: ExplorerSceneTarget) => void;
  target: ExplorerSceneTarget;
}) {
  return (
    <button
      type="button"
      className={[
        "image-target-hotspot",
        `image-target-hotspot--${target.mode}`,
        target.isActive ? "is-active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-target-mode={target.mode}
      aria-current={
        target.isActive ? "location" : undefined
      }
      aria-label={target.ariaLabel}
      style={{
        height: `${target.bounds.height * 100}%`,
        left: `${target.bounds.x * 100}%`,
        top: `${target.bounds.y * 100}%`,
        width: `${target.bounds.width * 100}%`
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(target);
      }}
    />
  );
}
