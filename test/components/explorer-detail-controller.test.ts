import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createExplorerDetailController } from "../../apps/web/src/features/explorer/explorerDetailController";
import { explorerDetailStore } from "../../apps/web/src/features/explorer/explorerDetailStore";

afterEach(() => {
  act(() => explorerDetailStore.getState().clear());
});

describe("explorer detail controller", () => {
  it("keeps factual details reopenable after the sheet is closed", () => {
    const state = createState({
      currentPage: { nodeId: "marina-bay" },
      detailPanelMode: "expanded"
    });
    const controller = createExplorerDetailController({
      endNavigationFeedback: vi.fn(),
      state
    });

    controller.renderNodeDetail();
    explorerDetailStore.getState().snapshot?.commands.close();

    const compactSnapshot = explorerDetailStore.getState().snapshot;
    expect(compactSnapshot?.mode).toBe("compact");
    expect(compactSnapshot?.node?.title).toBe(
      "Marina Bay and Civic District"
    );

    compactSnapshot?.commands.expand();
    expect(explorerDetailStore.getState().snapshot?.mode).toBe(
      "expanded"
    );
  });

  it("fully closes an unmapped detour", () => {
    const state = createState({
      detailOverride: {
        confidence: "unconfirmed",
        message: "Not mapped yet.",
        title: "Unmapped detail"
      },
      detailPanelMode: "expanded"
    });
    const controller = createExplorerDetailController({
      endNavigationFeedback: vi.fn(),
      state
    });

    controller.renderNodeDetail();
    explorerDetailStore.getState().snapshot?.commands.close();

    const closedSnapshot = explorerDetailStore.getState().snapshot;
    expect(closedSnapshot?.mode).toBe("hidden");
    expect(closedSnapshot?.detailOverride).toBeNull();
  });
});

function createState(overrides: Partial<{
  currentPage: { nodeId?: string | null } | null;
  detailOverride: unknown;
  detailPanelMode: string;
}> = {}) {
  return {
    activePack: {
      countrySlug: "singapore",
      overviewSceneId: "singapore-overview",
      rootNodeId: "singapore",
      title: "Singapore",
      nodes: {
        singapore: {
          childIds: ["marina-bay"],
          id: "singapore",
          title: "Singapore"
        },
        "marina-bay": {
          childIds: [],
          id: "marina-bay",
          title: "Marina Bay and Civic District",
          type: "district"
        }
      },
      scenes: {}
    },
    currentPage: null,
    detailOverride: null,
    detailPanelMode: "hidden",
    selectedNodeId: "marina-bay",
    ...overrides
  };
}
