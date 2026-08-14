// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createExplorerPageClickAdapter } from "../../apps/web/src/features/explorer/explorerPageClickAdapter";
import { createExplorerNavigationRequestController } from "../../apps/web/src/features/explorer/explorerNavigationRequestController";
import {
  isRuntimeArtworkPage,
  materializeExplorerRequestPage
} from "../../apps/web/src/features/explorer/explorerNavigationPagePolicy";
import {
  isSameArtworkUrl,
  normalizeArtworkUrl
} from "../../apps/web/src/features/explorer/explorerSceneOrchestrator";

describe("explorer navigation boundaries", () => {
  it("converts browser coordinates without leaking DOM math into navigation orchestration", () => {
    const viewport = document.createElement("main");
    const stage = document.createElement("div");
    const image = document.createElement("img");
    image.className = "scene-image";
    Object.defineProperties(image, {
      naturalHeight: { value: 500 },
      naturalWidth: { value: 1_000 }
    });
    stage.append(image);

    const adapter = createExplorerPageClickAdapter({
      clamp: (value, minimum, maximum) =>
        Math.min(maximum, Math.max(minimum, value)),
      clamp01: (value) => Math.min(1, Math.max(0, value)),
      getRenderedImageRect: () =>
        new DOMRect(10, 20, 200, 100),
      stage,
      viewport
    });
    const event = new MouseEvent("click", {
      clientX: 110,
      clientY: 70
    });

    expect(adapter.computeNormalizedSceneClick(event)).toEqual({
      x: 0.5,
      y: 0.5
    });
    expect(adapter.computeImageClick(event)).toEqual({
      naturalSize: { height: 500, width: 1_000 },
      normalizedImage: { x: 0.5, y: 0.5 },
      objectFit: "contain",
      pixel: { x: 500, y: 250 }
    });
  });

  it("invalidates stale navigation requests before clearing active state", () => {
    const state = {
      activeNavigationRequestId: null as number | null,
      isResolvingClick: false
    };
    const endNavigationFeedback = vi.fn();
    const controller =
      createExplorerNavigationRequestController({
        endNavigationFeedback,
        state
      });

    const first = controller.beginNavigationRequest();
    const second = controller.beginNavigationRequest();

    expect(first.signal.aborted).toBe(true);
    expect(
      controller.isNavigationRequestCurrent(first.id)
    ).toBe(false);
    controller.finishNavigationRequest(first.id);
    expect(state.isResolvingClick).toBe(true);
    controller.finishNavigationRequest(second.id);
    expect(state).toEqual({
      activeNavigationRequestId: null,
      isResolvingClick: false
    });
    expect(endNavigationFeedback).toHaveBeenCalledOnce();
  });

  it("materializes cached artwork without changing factual page identity", () => {
    const currentPage = {
      imageUrl: null,
      nodeId: "singapore",
      sceneId: "singapore-overview",
      status: "pending"
    };
    const page = materializeExplorerRequestPage({
      activePack: {
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
      },
      artworkByPage: new Map(),
      artworkByScene: new Map([
        [
          "singapore-overview",
          {
            decoded: true,
            imageUrl: "/runtime-cache/singapore.png"
          }
        ]
      ]),
      currentPage,
      currentSceneId: "singapore-overview",
      getPageArtworkCacheKey: () => "page:singapore"
    });

    expect(page).toMatchObject({
      artworkDecoded: true,
      imageUrl: "/runtime-cache/singapore.png",
      nodeId: "singapore",
      status: "ready"
    });
    expect(isRuntimeArtworkPage(page)).toBe(true);
    expect(currentPage.imageUrl).toBeNull();
  });

  it("compares artwork identity without query or origin noise", () => {
    expect(
      normalizeArtworkUrl(
        "https://cdn.example/runtime-cache/scene.png?v=2"
      )
    ).toBe("/runtime-cache/scene.png");
    expect(
      isSameArtworkUrl(
        "/runtime-cache/scene.png#preview",
        "https://cdn.example/runtime-cache/scene.png?v=2"
      )
    ).toBe(true);
  });
});
