// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ExplorerLoadingBoard,
  ExplorerRegionRail
} from "../../apps/web/src/features/explorer/ExplorerDestinationNavigation";
import { explorerDestinationStore } from "../../apps/web/src/features/explorer/explorerDestinationStore";

afterEach(() => {
  cleanup();
  act(() => explorerDestinationStore.getState().clear());
});

describe("ExplorerDestinationNavigation", () => {
  it("renders loading progress and invokes direct destination commands", () => {
    const commands = {
      openCountrySetup: vi.fn(),
      openDestination: vi.fn(),
      retryArtwork: vi.fn()
    };
    const destination = {
      key: "scene:marina-bay",
      label: "Marina Bay",
      mapNumber: "1",
      nodeId: "marina-bay",
      normalizedClick: { x: 0.4, y: 0.6 },
      phase: "ready" as const,
      readinessLabel: "illustration ready",
      statusText: "Ready"
    };
    render(
      <>
        <ExplorerLoadingBoard />
        <ExplorerRegionRail />
      </>
    );

    act(() => {
      explorerDestinationStore.getState().setSnapshot({
        board: {
          artworkJobKey: "page:overview",
          detail: "The factual page remains available.",
          headline: "Could not open Singapore",
          isBusy: false,
          isFailed: true,
          isUnmappedStarterCountry: false,
          items: [destination],
          pageTitle: "Singapore",
          readyCount: 1,
          totalCount: 1
        },
        commands,
        rail: null
      });
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry illustration"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Marina Bay, illustration ready"
      })
    );

    expect(commands.retryArtwork).toHaveBeenCalledWith(
      "page:overview"
    );
    expect(commands.openDestination).toHaveBeenCalledWith(
      destination
    );
  });

  it("renders the React-owned region rail", () => {
    const openDestination = vi.fn();
    render(<ExplorerRegionRail />);

    act(() => {
      explorerDestinationStore.getState().setSnapshot({
        board: null,
        commands: {
          openCountrySetup: vi.fn(),
          openDestination,
          retryArtwork: vi.fn()
        },
        rail: {
          items: [
            {
              key: "node:zoo",
              label: "Singapore Zoo",
              mapNumber: "4",
              nodeId: "zoo",
              normalizedClick: { x: 0.8, y: 0.2 },
              phase: "queued",
              readinessLabel: "illustration queued",
              statusText: "Queued"
            }
          ],
          readiness: "1 destination queued"
        }
      });
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Map 4, Singapore Zoo, illustration queued"
      })
    );

    expect(
      screen.getByText("1 destination queued")
    ).toBeTruthy();
    expect(openDestination).toHaveBeenCalledTimes(1);
  });
});
