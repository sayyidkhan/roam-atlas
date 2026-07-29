// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExplorerEnvironmentLayers } from "../../apps/web/src/features/explorer/ExplorerEnvironmentLayers";
import {
  normalizeEnvironmentKind,
  selectEnvironmentLayers
} from "../../apps/web/src/features/explorer/explorerEnvironmentLayerPolicy";

afterEach(cleanup);

describe("ExplorerEnvironmentLayers", () => {
  it("renders planned ambience as decorative React primitives", () => {
    const { container } = render(
      <ExplorerEnvironmentLayers
        environmentPlan={{
          source: "fixture-plan",
          layers: [
            {
              id: "bay-water",
              kind: "water",
              intensity: "medium",
              coordinateSpace: "normalized",
              bounds: {
                x: 0.1,
                y: 0.5,
                width: 0.4,
                height: 0.3
              }
            },
            {
              id: "garden-foliage",
              kind: "foliage",
              coordinateSpace: "normalized",
              bounds: {
                x: 0.55,
                y: 0.4,
                width: 0.25,
                height: 0.35
              }
            }
          ]
        }}
        scene={{
          ambientLayers: [],
          coordinateSpace: {
            height: 1000,
            width: 1500
          }
        }}
      />
    );

    const root = container.querySelector(
      ".environment-layer-root"
    );
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.getAttribute("data-environment-source")).toBe(
      "fixture-plan"
    );
    expect(
      container.querySelector(".atmosphere-water-zone")
    ).toBeTruthy();
    expect(
      container.querySelector(".atmosphere-foliage-field")
    ).toBeTruthy();
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("keeps fallback ambience safe and normalizes unknown kinds", () => {
    const selection = selectEnvironmentLayers(
      {
        coordinateSpace: { height: 100, width: 100 },
        ambientLayers: [
          { id: "unsafe-water", kind: "water" },
          { id: "safe-cloud", kind: "cloud" }
        ]
      },
      null
    );

    expect(selection.source).toBe("scene-fallback");
    expect(selection.layers).toEqual([
      { id: "safe-cloud", kind: "cloud" }
    ]);
    expect(normalizeEnvironmentKind("unknown-effect")).toBe(
      "light"
    );
  });
});
