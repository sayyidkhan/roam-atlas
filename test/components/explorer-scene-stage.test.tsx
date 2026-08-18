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
import { explorerSceneStore } from "../../apps/web/src/features/explorer/explorerSceneStore";

afterEach(() => {
  cleanup();
  act(() => explorerSceneStore.getState().clear());
});

describe("ExplorerSceneStage", () => {
  it("renders artwork, tiles, and direct curated target commands", () => {
    const openTarget = vi.fn();
    const { container } = render(<ExplorerSceneStage />);

    act(() => {
      explorerSceneStore.getState().setSnapshot({
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
          },
          {
            ariaLabel: "Explore the Heritage Belt area",
            bounds: {
              height: 0.2,
              width: 0.2,
              x: 0.5,
              y: 0.2
            },
            isActive: false,
            mode: "visual",
            nodeId: "heritage-belt",
            normalizedClick: { x: 0.6, y: 0.3 },
            visualOutline: [
              { x: 0.52, y: 0.22 },
              { x: 0.68, y: 0.22 },
              { x: 0.66, y: 0.38 },
              { x: 0.52, y: 0.36 }
            ]
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
    expect(
      container.querySelector(
        ".scene-target-ripple.is-active"
      )
    ).toBeTruthy();
    expect(
      container.querySelectorAll(".scene-target-ripple")
    ).toHaveLength(2);

    const marinaBayTarget = screen.getByRole("button", {
      name: "Explore the Marina Bay area"
    });
    fireEvent.pointerEnter(marinaBayTarget);
    expect(
      container.querySelector(
        ".scene-target-ripple.is-highlighted"
      )
    ).toBeTruthy();

    fireEvent.click(marinaBayTarget);
    expect(openTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "marina-bay",
        normalizedClick: { x: 0.4, y: 0.5 }
      })
    );
  });
});
