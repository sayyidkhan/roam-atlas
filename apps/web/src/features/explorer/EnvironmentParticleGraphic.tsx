import type { ReactNode } from "react";

import type { EnvironmentKind } from "./explorerEnvironmentLayerPolicy";

export function EnvironmentParticleGraphic({
  kind
}: {
  kind: EnvironmentKind;
}): ReactNode {
  if (kind === "birds") {
    return (
      <svg
        className="ambient-svg ambient-bird-svg"
        viewBox="0 0 64 32"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="ambient-bird-wing ambient-bird-wing--left"
          d="M31 17 C22 6 12 4 3 15"
        />
        <path
          className="ambient-bird-wing ambient-bird-wing--right"
          d="M33 17 C43 5 53 4 61 15"
        />
      </svg>
    );
  }

  if (kind === "water") {
    return (
      <svg
        className="ambient-svg ambient-water-svg"
        viewBox="0 0 160 36"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="ambient-water-line ambient-water-line--wide"
          d="M3 18 C24 7 42 29 65 18 S108 8 132 18 S151 28 157 18"
        />
        <path
          className="ambient-water-line ambient-water-line--thin"
          d="M24 27 C43 19 58 31 77 27 S116 19 138 27"
        />
      </svg>
    );
  }

  if (kind === "marine_life") {
    return (
      <svg
        className="ambient-svg ambient-marine-svg"
        viewBox="0 0 96 56"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="ambient-marine-body"
          d="M23 32 C36 12 59 8 75 22 C61 22 49 30 38 42 C33 38 28 35 23 32 Z"
        />
        <path
          className="ambient-marine-fin"
          d="M51 22 C48 13 53 8 61 5 C60 14 58 21 51 22 Z"
        />
        <path
          className="ambient-marine-splash"
          d="M10 43 C23 36 35 48 49 42 S76 37 88 44"
        />
      </svg>
    );
  }

  if (kind === "foliage") {
    return (
      <svg
        className="ambient-svg ambient-leaf-svg"
        viewBox="0 0 40 52"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="ambient-leaf-body"
          d="M20 3 C34 14 35 33 20 49 C5 33 6 14 20 3 Z"
        />
        <path
          className="ambient-leaf-vein"
          d="M20 9 L20 45"
        />
      </svg>
    );
  }

  if (kind === "cloud") {
    return (
      <svg
        className="ambient-svg ambient-cloud-svg"
        viewBox="0 0 180 70"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="ambient-cloud-fill"
          d="M23 45 C28 25 47 20 62 29 C72 10 104 10 114 31 C130 24 153 32 158 47 C128 56 59 58 23 45 Z"
        />
        <path
          className="ambient-cloud-line"
          d="M29 45 C45 50 65 49 81 44 C100 51 131 52 153 47"
        />
      </svg>
    );
  }

  return null;
}
