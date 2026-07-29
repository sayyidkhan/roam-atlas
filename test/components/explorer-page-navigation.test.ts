import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { createExplorerPageNavigationController } from "../../apps/web/src/features/explorer/explorerPageNavigationController";
import type { ExplorerNavigationState } from "../../apps/web/src/features/explorer/explorerNavigationTypes";

function createState(): ExplorerNavigationState {
  return {
    activeCountrySlug: "singapore",
    activeNavigationRequestId: null,
    activePack: {
      countrySlug: "singapore",
      overviewSceneId: "overview",
      rootNodeId: "singapore",
      title: "Singapore",
      nodes: {
        marina: {
          childIds: [],
          id: "marina",
          title: "Marina Bay"
        }
      },
      scenes: {
        overview: {
          coordinateSpace: { height: 100, width: 100 },
          id: "overview",
          rootNodeId: "singapore",
          tiles: [],
          title: "Overview"
        }
      }
    },
    artworkByPage: new Map(),
    artworkByScene: new Map(),
    currentPage: {
      id: "root",
      imageUrl: "/runtime-cache/overview.png",
      nodeId: "singapore",
      sceneId: "overview",
      status: "ready"
    },
    currentSceneId: "overview",
    environmentPlans: new Map(),
    imageQuality: "high",
    isResolvingClick: false,
    pendingJob: null
  };
}

function createDependencies() {
  const state = createState();
  return {
    canonicalRouteForNode: vi.fn(
      (countrySlug: string, nodeId: string) =>
        `/${countrySlug}/${nodeId}`
    ),
    endNavigationFeedback: vi.fn(),
    enterReadyPage: vi.fn(),
    explorerClient: {
      resolveFlipbookClick: vi.fn()
    },
    getPageArtworkCacheKey: vi.fn(() => "root"),
    mergePrefetchedArtwork: vi.fn((page) => page),
    renderDetour: vi.fn(),
    renderImageGenerationPending: vi.fn(),
    resolveFlipbookClick: vi.fn(),
    setBrowserPath: vi.fn(),
    state
  };
}

describe("explorer page navigation", () => {
  it("keeps a VLM-guarded click unresolved instead of navigating", () => {
    const dependencies = createDependencies();
    const controller =
      createExplorerPageNavigationController(
        dependencies
      );

    controller.runFlipbookResult({
      click: {
        resolver: "vlm_guard",
        status: "unmapped"
      },
      page: {
        nodeId: "marina",
        sceneId: "overview"
      }
    });

    expect(
      dependencies.endNavigationFeedback
    ).toHaveBeenCalledOnce();
    expect(dependencies.renderDetour).toHaveBeenCalledWith(
      expect.objectContaining({
        confidence: "unresolved"
      })
    );
    expect(dependencies.setBrowserPath).not.toHaveBeenCalled();
    expect(dependencies.enterReadyPage).not.toHaveBeenCalled();
  });

  it("routes a curated ready result through its canonical node path", () => {
    const dependencies = createDependencies();
    const controller =
      createExplorerPageNavigationController(
        dependencies
      );
    const page = {
      artworkDecoded: true,
      imageUrl: "/runtime-cache/marina.png",
      nodeId: "marina",
      sceneId: "overview",
      status: "ready"
    };

    controller.runFlipbookResult({ page });

    expect(
      dependencies.canonicalRouteForNode
    ).toHaveBeenCalledWith(
      "singapore",
      "marina",
      dependencies.state.activePack
    );
    expect(dependencies.setBrowserPath).toHaveBeenCalledWith(
      "/singapore/marina"
    );
    expect(dependencies.enterReadyPage).toHaveBeenCalledWith(
      page
    );
    expect(
      dependencies.renderImageGenerationPending
    ).not.toHaveBeenCalled();
  });
});
