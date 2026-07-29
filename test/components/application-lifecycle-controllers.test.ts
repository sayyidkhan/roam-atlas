import { describe, expect, it, vi } from "vitest";

import { createApplicationGeneratedStateController } from "../../apps/web/src/app/applicationGeneratedStateController";
import { createApplicationNavigationController } from "../../apps/web/src/app/applicationNavigationController";
import { createApplicationState } from "../../apps/web/src/app/applicationState";
import type { RuntimePack } from "../../apps/web/src/app/browserRuntime";

const pack: RuntimePack = {
  countrySlug: "singapore",
  nodes: {
    singapore: {
      childIds: [],
      id: "singapore",
      title: "Singapore"
    }
  },
  overviewSceneId: "singapore-overview",
  rootNodeId: "singapore",
  scenes: {
    "singapore-overview": {
      coordinateSpace: { height: 100, width: 100 },
      id: "singapore-overview",
      rootNodeId: "singapore",
      tiles: [],
      title: "Singapore"
    }
  },
  title: "Singapore"
};

function createState() {
  return createApplicationState({
    defaultCountrySlug: "singapore",
    defaultImageQuality: "high",
    experienceConfig: {
      maxParallelImageJobs: 1,
      showLoadingSteps: true
    }
  });
}

describe("application lifecycle collaborators", () => {
  it("keeps unknown curated nodes explicitly unconfirmed", () => {
    const state = createState();
    const render = vi.fn();
    const navigation =
      createApplicationNavigationController({
        cancelPendingNavigation: vi.fn(),
        clearPendingJob: vi.fn(),
        invalidatePrefetchState: vi.fn(),
        loadStoredCountryDraft: vi.fn(),
        render,
        setBrowserPath: vi.fn(),
        state
      });

    navigation.enterCuratedPlace(
      {
        countrySlug: "singapore",
        nodeId: "invented-attraction",
        pack
      },
      { updateUrl: false }
    );

    expect(state.currentView).toBe("explorer");
    expect(state.routeNotice).toMatchObject({
      confidence: "unconfirmed",
      title: "Unknown RoamAtlas node"
    });
    expect(state.routeNotice?.message).toContain(
      "not mapped in RoamAtlas' verified Singapore graph"
    );
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("clears only generated visual state", () => {
    const state = createState();
    state.artworkJobs.set("scene:overview", {
      status: "processing"
    });
    state.artworkByScene.set("overview", {});
    state.artworkByPage.set("node:marina", {});
    state.artworkImageLoads.set(
      "/artwork.png",
      Promise.resolve({ height: 100, width: 100 })
    );
    state.currentPage = {
      artworkDecoded: true,
      countrySlug: "singapore",
      environmentUrl: "/environment.json",
      imageUrl: "/artwork.png",
      nodeId: "singapore",
      sceneId: "singapore-overview"
    };
    const stopArtworkPoller = vi.fn();
    const clearEnvironmentState = vi.fn();
    const generatedState =
      createApplicationGeneratedStateController({
        cancelPendingNavigation: vi.fn(),
        clearEnvironmentState,
        clearPendingJob: vi.fn(),
        invalidatePrefetchState: vi.fn(),
        state,
        stopArtworkPoller
      });

    generatedState.clearCountryGeneratedState("singapore");

    expect(stopArtworkPoller).toHaveBeenCalledWith(
      "scene:overview"
    );
    expect(state.artworkJobs.size).toBe(0);
    expect(state.artworkByScene.size).toBe(0);
    expect(state.artworkByPage.size).toBe(0);
    expect(state.artworkImageLoads.size).toBe(0);
    expect(state.currentPage).toMatchObject({
      artworkDecoded: false,
      environmentUrl: null,
      imageUrl: null
    });
    expect(clearEnvironmentState).toHaveBeenCalledWith(
      "singapore"
    );
  });
});
