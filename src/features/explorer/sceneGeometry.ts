export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clamp(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function normalizeEnvironmentPlanBounds(
  bounds: Partial<Bounds> | null | undefined,
  { maxWidth = 1, maxHeight = 1 } = {}
) {
  if (!bounds) return null;
  const x = clamp01(Number(bounds.x));
  const y = clamp01(Number(bounds.y));
  const rawWidth = Math.min(clamp(bounds.width, 0.04, 1), 1 - x);
  const rawHeight = Math.min(clamp(bounds.height, 0.04, 1), 1 - y);
  const width = Math.min(rawWidth, maxWidth);
  const height = Math.min(rawHeight, maxHeight);
  if (width < 0.04 || height < 0.04) return null;
  const centerX = x + rawWidth / 2;
  const centerY = y + rawHeight / 2;
  return {
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height
  };
}

export function getContainedImageRect(image: HTMLImageElement) {
  const elementRect = image.getBoundingClientRect();
  const scale = Math.min(
    elementRect.width / image.naturalWidth,
    elementRect.height / image.naturalHeight
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const left = elementRect.left + (elementRect.width - width) / 2;
  const top = elementRect.top + (elementRect.height - height) / 2;
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}
