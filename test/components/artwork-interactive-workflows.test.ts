// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { createArtworkJobQueryPolling } from "../../apps/web/src/features/artwork/artworkJobQueryPolling";
import { createArtworkPendingController } from "../../apps/web/src/features/artwork/artworkPendingController";
import { createArtworkPollStateController } from "../../apps/web/src/features/artwork/artworkPollStateController";
import { createArtworkRequestController } from "../../apps/web/src/features/artwork/artworkRequestController";
import type { ArtworkState } from "../../apps/web/src/features/artwork/artworkRuntimeTypes";

function createState(): ArtworkState {
  return {
    activeCountrySlug: "singapore",
    activePack: {
      scenes: {
        overview: {
          id: "overview",
          rootNodeId: "singapore"
        }
      }
    },
    artworkByPage: new Map(),
    artworkByScene: new Map(),
    artworkJobs: new Map(),
    currentPage: {
      id: "root",
      imageUrl: null,
      nodeId: "singapore",
      sceneId: "overview",
      status: "generation_required"
    },
    currentSceneId: "overview",
    currentView: "explorer",
    imageQuality: "high"
  };
}

function createRuntimeController() {
  return {
    completeCurrentPageArtwork: vi.fn(async () => {}),
    completeSceneArtwork: vi.fn(async () => {}),
    getArtworkJobKeyForPage: vi.fn(() => "root"),
    isArtworkJobVisible: vi.fn(() => true),
    isCurrentArtworkAttempt: vi.fn(() => true),
    markArtworkJobFailed: vi.fn(),
    pollArtworkJob: vi.fn(async () => {}),
    pollCurrentPageArtworkJob: vi.fn(async () => {}),
    startArtworkPoller: vi.fn(),
    stopArtworkPoller: vi.fn()
  };
}

describe("interactive artwork workflows", () => {
  it("rejects a scene request response after its attempt becomes stale", async () => {
    const state = createState();
    const runtime = createRuntimeController();
    runtime.isCurrentArtworkAttempt.mockReturnValue(false);
    const controller = createArtworkRequestController({
      apiPath: (path) => path,
      artworkRuntimeController: runtime,
      explainClickError: (error) => String(error),
      fetchArtworkResource: vi.fn(async () =>
        new Response(
          JSON.stringify({
            page: {
              imageUrl: "/runtime-cache/stale.png",
              nodeId: "singapore",
              sceneId: "overview",
              status: "ready"
            }
          }),
          { status: 200 }
        )
      ),
      getPageArtworkJobKey: () => "root",
      nextAttemptId: () => 7,
      render: vi.fn(),
      state
    });

    await controller.requestSceneArtwork("overview");

    expect(
      runtime.isCurrentArtworkAttempt
    ).toHaveBeenCalledWith("overview", 7);
    expect(
      runtime.completeSceneArtwork
    ).not.toHaveBeenCalled();
    expect(runtime.startArtworkPoller).not.toHaveBeenCalled();
  });

  it("enters a pending page before starting its background poller", () => {
    const state = createState();
    const runtime = createRuntimeController();
    const requestController = {
      requestCurrentPageArtwork: vi.fn(async () => {}),
      requestSceneArtwork: vi.fn(async () => {})
    };
    const enterReadyPage = vi.fn();
    const controller = createArtworkPendingController({
      artworkRequestController: requestController,
      artworkRuntimeController: runtime,
      enterReadyPage,
      nextAttemptId: () => 3,
      state
    });

    controller.renderImageGenerationPending(
      {
        generated: {
          jobUrl: "/api/artwork/jobs/overview"
        },
        imageUrl: null,
        nodeId: "singapore",
        sceneId: "overview",
        status: "pending_codex_image_generation"
      },
      {}
    );

    expect(enterReadyPage).toHaveBeenCalledOnce();
    expect(runtime.startArtworkPoller).toHaveBeenCalledOnce();
    expect(
      enterReadyPage.mock.invocationCallOrder[0]
    ).toBeLessThan(
      runtime.startArtworkPoller.mock.invocationCallOrder[0] ??
        Infinity
    );
  });
});

describe("artwork poll state", () => {
  it("marks an expired attempt as timed out", () => {
    const state = createState();
    const runtime = createRuntimeController();
    state.artworkJobs.set("overview", {
      attemptId: 4,
      attempts: 1,
      startedAt: Date.now() - 1_000,
      status: "processing"
    });
    const controller = createArtworkPollStateController({
      artworkPollMaxAttempts: 10,
      artworkPollTimeoutMs: 500,
      artworkLifecycleController: runtime,
      isArtworkJobFailed: () => false,
      state
    });

    expect(
      controller.shouldStopArtworkPolling("overview", 4)
    ).toBe(true);
    expect(runtime.markArtworkJobFailed).toHaveBeenCalledWith(
      "overview",
      expect.stringContaining(
        "taking longer than expected"
      ),
      { status: "timed_out" }
    );
  });

  it("copies provider status without replacing local attempt accounting", () => {
    const state = createState();
    const runtime = createRuntimeController();
    state.artworkJobs.set("overview", {
      attemptId: 8,
      attempts: 3,
      startedAt: 100,
      status: "processing"
    });
    const controller = createArtworkPollStateController({
      artworkPollMaxAttempts: 10,
      artworkPollTimeoutMs: 10_000,
      artworkLifecycleController: runtime,
      isArtworkJobFailed: () => false,
      state
    });

    expect(
      controller.copyArtworkJobStatus(
        "overview",
        {
          attempts: 99,
          imageUrl: "/partial.png",
          startedAt: 999,
          status: "partial"
        },
        {
          nodeId: "singapore",
          sceneId: "overview"
        }
      )
    ).toBe(true);
    expect(state.artworkJobs.get("overview")).toMatchObject({
      attempts: 3,
      imageUrl: "/partial.png",
      startedAt: 100,
      status: "partial"
    });
  });
});

describe("artwork job query polling", () => {
  it("uses the query scheduler and stops a keyed poll cleanly", async () => {
    vi.useFakeTimers();
    try {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false }
        }
      });
      const polling = createArtworkJobQueryPolling({
        intervalMs: 100,
        queryClient
      });
      const poll = vi.fn(async () => {});

      polling.start({
        identity: 4,
        jobUrl: "/api/artwork/jobs/overview",
        poll,
        pollKey: "overview"
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(poll).toHaveBeenCalledTimes(2);

      polling.stop("overview", 4);
      await vi.advanceTimersByTimeAsync(300);
      expect(poll).toHaveBeenCalledTimes(2);
      queryClient.clear();
    } finally {
      vi.useRealTimers();
    }
  });
});
