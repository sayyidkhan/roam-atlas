import { describe, expect, it } from "vitest";

import {
  normalizeSceneOutline,
  sceneOutlinePath
} from "../../apps/web/src/features/explorer/sceneOutlineGeometry";

const bounds = { height: 0.3, width: 0.4, x: 0.2, y: 0.3 };

describe("scene outline geometry", () => {
  it("keeps a valid normalized polygon inside its visual bounds", () => {
    const outline = normalizeSceneOutline(
      [
        { x: 0.22, y: 0.32 },
        { x: 0.56, y: 0.35 },
        { x: 0.41, y: 0.56 }
      ],
      bounds
    );

    expect(outline).toHaveLength(3);
    expect(sceneOutlinePath({ bounds, outline })).toBe(
      "M0.22 0.32 L0.56 0.35 L0.41 0.56 Z"
    );
  });

  it("falls back to a rounded bounds outline for absent geometry", () => {
    expect(normalizeSceneOutline([{ x: 0.1, y: 0.1 }], bounds)).toBeUndefined();
    expect(sceneOutlinePath({ bounds })).toContain("Q");
  });
});
