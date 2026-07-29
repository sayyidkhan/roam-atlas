export type NormalizedPoint = {
  x: number;
  y: number;
};

export type ImageClick = {
  naturalSize: {
    height: number;
    width: number;
  };
  normalizedImage: NormalizedPoint;
  objectFit: "contain";
  pixel: NormalizedPoint;
};

export type ExplorerClientRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type ExplorerPageClickAdapterDependencies = {
  clamp: (
    value: number,
    minimum: number,
    maximum: number
  ) => number;
  clamp01: (value: number) => number;
  getContainedImageRect: (
    image: HTMLImageElement
  ) => ExplorerClientRect;
  stage: HTMLElement;
  viewport: HTMLElement;
};

const INTERACTIVE_EXPLORER_SELECTOR =
  "button, a, .detail-sheet, .scene-hud, .map-hotspot-hit, .image-target-hotspot";

export function createExplorerPageClickAdapter(
  dependencies: ExplorerPageClickAdapterDependencies
) {
  const {
    clamp,
    clamp01,
    getContainedImageRect,
    stage,
    viewport
  } = dependencies;

  function bindPageClick(
    onPageClick: (event: MouseEvent) => void | Promise<void>
  ): () => void {
    const handlePageClick = (event: MouseEvent): void => {
      if (
        event.target instanceof Element &&
        event.target.closest(INTERACTIVE_EXPLORER_SELECTOR)
      ) {
        return;
      }
      void onPageClick(event);
    };

    viewport.addEventListener("click", handlePageClick);
    return () => {
      viewport.removeEventListener("click", handlePageClick);
    };
  }

  function computeNormalizedSceneClick(
    event: MouseEvent
  ): NormalizedPoint {
    const stageRect = getSceneClickRect();
    return {
      x: clamp01(
        (event.clientX - stageRect.left) / stageRect.width
      ),
      y: clamp01(
        (event.clientY - stageRect.top) / stageRect.height
      )
    };
  }

  function computeImageClick(
    event: MouseEvent
  ): ImageClick | null {
    const image =
      stage.querySelector<HTMLImageElement>(".scene-image");
    if (!image?.naturalWidth || !image?.naturalHeight) {
      return null;
    }

    const imageRect = getContainedImageRect(image);
    const scale = imageRect.width / image.naturalWidth;
    const imageX =
      clamp(event.clientX - imageRect.left, 0, imageRect.width) /
      scale;
    const imageY =
      clamp(event.clientY - imageRect.top, 0, imageRect.height) /
      scale;

    return {
      normalizedImage: {
        x: clamp01(imageX / image.naturalWidth),
        y: clamp01(imageY / image.naturalHeight)
      },
      pixel: {
        x: Math.round(imageX),
        y: Math.round(imageY)
      },
      naturalSize: {
        width: image.naturalWidth,
        height: image.naturalHeight
      },
      objectFit: "contain"
    };
  }

  function getSceneClickRect(): ExplorerClientRect {
    const image =
      stage.querySelector<HTMLImageElement>(".scene-image");
    if (image?.naturalWidth && image.naturalHeight) {
      return getContainedImageRect(image);
    }
    return (
      stage
        .querySelector<HTMLElement>(".scene-canvas")
        ?.getBoundingClientRect() ??
      stage.getBoundingClientRect()
    );
  }

  return {
    bindPageClick,
    computeImageClick,
    computeNormalizedSceneClick
  };
}
