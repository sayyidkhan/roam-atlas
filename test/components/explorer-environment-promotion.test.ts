import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { createExplorerEnvironmentPromotionController } from "../../apps/web/src/features/explorer/explorerEnvironmentPromotionController";
import type { ExplorerEnvironmentState } from "../../apps/web/src/features/explorer/explorerEnvironmentTypes";

function createState(): ExplorerEnvironmentState {
  return {
    activeCountrySlug: "singapore",
    activePack: {
      nodes: {
        marina: {
          childIds: ["gardens"]
        }
      },
      scenes: {
        overview: {
          id: "overview",
          rootNodeId: "singapore"
        }
      }
    },
    artworkByPage: new Map([
      [
        "marina-page",
        {
          page: {
            id: "marina-page",
            nodeId: "marina",
            sceneId: "overview"
          }
        }
      ]
    ]),
    artworkByScene: new Map(),
    currentPage: {
      id: "marina-page",
      imageUrl: "/runtime-cache/marina.png",
      nodeId: "marina",
      sceneId: "overview"
    },
    currentView: "explorer",
    environmentPlanPromotions: new Map(),
    environmentPlanRequests: new Map(),
    environmentPlans: new Map(),
    imageQuality: "high"
  };
}

describe("explorer environment promotion", () => {
  it("promotes an exact current-page environment reference into its visual cache", async () => {
    const state = createState();
    const requestEnvironmentPlan = vi.fn(async () => {});
    const render = vi.fn();
    const controller =
      createExplorerEnvironmentPromotionController({
        apiPath: (path) => path,
        fetchArtworkResource: vi.fn(async () =>
          new Response(
            JSON.stringify({
              page: {
                environmentStatus: "ready",
                environmentUrl: "/environment/marina.json"
              }
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          )
        ),
        getCurrentEpoch: () => 3,
        getCurrentRequestPage: () => state.currentPage,
        getPageArtworkCacheKey: () => "marina-page",
        getPageEnvironmentUrl: (page) =>
          page?.environmentUrl ?? null,
        render,
        requestEnvironmentPlan,
        state
      });

    await controller.promoteCurrentPageEnvironmentPlan(
      "/runtime-cache/marina.png"
    );

    expect(state.currentPage?.environmentUrl).toBe(
      "/environment/marina.json"
    );
    expect(
      state.artworkByPage.get("marina-page")
        ?.environmentUrl
    ).toBe("/environment/marina.json");
    expect(requestEnvironmentPlan).toHaveBeenCalledWith(
      "/environment/marina.json"
    );
    expect(render).toHaveBeenCalledOnce();
  });

  it("rejects a promotion response after the active page changes", async () => {
    const state = createState();
    let resolveResponse:
      | ((response: Response) => void)
      | undefined;
    const responsePending = new Promise<Response>(
      (resolve) => {
        resolveResponse = resolve;
      }
    );
    const requestEnvironmentPlan = vi.fn(async () => {});
    const controller =
      createExplorerEnvironmentPromotionController({
        apiPath: (path) => path,
        fetchArtworkResource: vi.fn(
          async () => responsePending
        ),
        getCurrentEpoch: () => 1,
        getCurrentRequestPage: () => state.currentPage,
        getPageArtworkCacheKey: () => "marina-page",
        getPageEnvironmentUrl: (page) =>
          page?.environmentUrl ?? null,
        render: vi.fn(),
        requestEnvironmentPlan,
        state
      });

    const promotion =
      controller.promoteCurrentPageEnvironmentPlan(
        "/runtime-cache/marina.png"
      );
    state.currentPage = {
      id: "gardens-page",
      nodeId: "gardens",
      sceneId: "overview"
    };
    resolveResponse?.(
      new Response(
        JSON.stringify({
          page: {
            environmentUrl: "/environment/stale.json"
          }
        }),
        { status: 200 }
      )
    );
    await promotion;

    expect(state.currentPage.environmentUrl).toBeUndefined();
    expect(requestEnvironmentPlan).not.toHaveBeenCalled();
  });
});
