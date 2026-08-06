import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationState } from "../../apps/web/src/app/applicationRuntimeTypes";
import type { RuntimePack } from "../../apps/web/src/app/browserRuntime";
import { createExplorerChromeController } from "../../apps/web/src/features/explorer/explorerChromeController";
import { explorerChromeStore } from "../../apps/web/src/features/explorer/explorerChromeStore";

const pack = {
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
      parentId: "singapore",
      title: "Marina Bay"
    }
  },
  scenes: {}
} as RuntimePack;

beforeEach(() => explorerChromeStore.getState().clear());

describe("explorer chrome controller", () => {
  it("returns from a country root to the country catalog", () => {
    const enterCountryLanding = vi.fn();
    const controller = createController(
      createState("singapore"),
      enterCountryLanding
    );

    controller.publishState();
    const snapshot = explorerChromeStore.getState().snapshot;
    expect(snapshot?.backDisabled).toBe(false);
    snapshot?.commands.back();

    expect(enterCountryLanding).toHaveBeenCalledTimes(1);
  });

  it("returns a direct deep link to its parent when history is empty", () => {
    const setBrowserPath = vi.fn();
    const controller = createController(
      createState("marina-bay"),
      vi.fn(),
      setBrowserPath
    );

    controller.publishState();
    explorerChromeStore.getState().snapshot?.commands.back();

    expect(setBrowserPath).toHaveBeenCalledWith("/singapore/place/singapore");
  });
});

function createState(nodeId: string): ApplicationState {
  return {
    activeCountrySlug: "singapore",
    activePack: pack,
    currentPage: {
      sceneId: "singapore-overview",
      nodeId
    },
    currentView: "explorer",
    history: [],
    isResolvingClick: false
  } as unknown as ApplicationState;
}

function createController(
  state: ApplicationState,
  enterCountryLanding: () => void,
  setBrowserPath = vi.fn()
) {
  return createExplorerChromeController({
    cancelPendingNavigation: vi.fn(),
    canonicalRouteForNode: (countrySlug, nodeId) =>
      `/${countrySlug}/place/${nodeId}`,
    clearPendingJob: vi.fn(),
    enterCountryLanding,
    render: vi.fn(),
    setBrowserPath,
    state
  });
}
