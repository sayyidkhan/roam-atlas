// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerSceneStage } from "../../apps/web/src/features/explorer/ExplorerSceneStage";
import { explorerSceneBridge } from "../../apps/web/src/features/explorer/explorerSceneBridge";

afterEach(() => {
  cleanup();
  act(() => explorerSceneBridge.clear());
});

describe("ExplorerSceneStage", () => {
  it("renders artwork, tiles, and direct curated target commands", () => {
    const openTarget = vi.fn();
    const { container } = render(<ExplorerSceneStage />);

    act(() => {
      explorerSceneBridge.publish({
        commands: { openTarget },
        displayImage: {
          isPreview: false,
          url: "/fixtures/singapore-overview.png"
        },
        environmentPlan: { layers: [] },
        hasFinalArtwork: true,
        isArtworkPending: false,
        pageTitle: "Singapore",
        scene: {
          ambientLayers: [],
          coordinateSpace: {
            height: 1000,
            width: 1500
          },
          id: "singapore-overview",
          title: "Singapore Overview Scroll"
        },
        showImageOverlays: true,
        targets: [
          {
            ariaLabel: "Explore the Marina Bay area",
            bounds: {
              height: 0.2,
              width: 0.2,
              x: 0.3,
              y: 0.4
            },
            isActive: true,
            mode: "visual",
            nodeId: "marina-bay",
            normalizedClick: { x: 0.4, y: 0.5 }
          }
        ],
        tiles: [
          {
            bounds: {
              height: 1000,
              width: 750,
              x: 0,
              y: 0
            },
            column: 0,
            id: "tile-0",
            imageUrl: null
          }
        ]
      });
    });

    expect(
      screen.getByRole("img", {
        name: "Singapore Overview Scroll"
      })
    ).toBeTruthy();
    expect(
      container
        .querySelector("#scroll-stage")
        ?.classList.contains("has-local-art")
    ).toBe(true);
    expect(container.querySelector(".tile-art")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Explore the Marina Bay area"
      })
    );
    expect(openTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "marina-bay",
        normalizedClick: { x: 0.4, y: 0.5 }
      })
    );
  });
});
