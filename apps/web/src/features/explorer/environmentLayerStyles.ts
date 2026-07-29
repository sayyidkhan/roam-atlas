import type { CSSProperties } from "react";

import type { EnvironmentBounds } from "./explorerEnvironmentLayerPolicy";

type AmbientStyle = CSSProperties &
  Record<`--${string}`, string>;

export function environmentBoundsStyle(
  bounds: EnvironmentBounds
): CSSProperties {
  return {
    height: `${bounds.height * 100}%`,
    left: `${bounds.x * 100}%`,
    top: `${bounds.y * 100}%`,
    width: `${bounds.width * 100}%`
  };
}

export function environmentAmbientStyle(
  properties: Record<`--${string}`, string>
): AmbientStyle {
  return properties as AmbientStyle;
}

export function environmentRange(
  length: number
): number[] {
  return Array.from({ length }, (_, index) => index);
}
