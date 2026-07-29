import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { storePrefetchedArtwork } from "../../apps/web/src/features/artwork/artworkPrefetchCache";
import type { ArtworkPrefetchState } from "../../apps/web/src/features/artwork/artworkPrefetchTypes";

function createState(): ArtworkPrefetchState {
  return {
    activeCountrySlug: "singapore",
    activePack: {
      nodes: {},
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
    currentPage: null,
    currentSceneId: "overview",
    currentView: "explorer",
    experienceConfig: {
      loadNextDestinationsEarly: true
    },
    imageQuality: "high",
    prefetchJobs: new Map(),
    prefetchRequests: new Set(),
    prefetchSceneId: null
  };
}

describe("prefetched artwork cache promotion", () => {
  it("decodes visual artwork before promoting a scene-root cache entry", async () => {
    const state = createState();
    const preloadArtworkImage = vi.fn(async () => {});

    const stored = await storePrefetchedArtwork(
      {
        getPageEnvironmentUrl: () => "/environment.json",
        isCurrentRequest: () => true,
        preloadArtworkImage,
        state
      },
      {
        page: {
          imageUrl: "/overview.png",
          status: "ready"
        },
        request: {
          requestEpoch: 2,
          requestSceneId: "overview"
        },
        target: {
          key: "singapore",
          nodeId: "singapore",
          sceneId: "overview",
          title: "Singapore"
        }
      }
    );

    expect(stored).toBe(true);
    expect(preloadArtworkImage).toHaveBeenCalledWith(
      "/overview.png"
    );
    expect(state.artworkByScene.get("overview")).toMatchObject({
      decoded: true,
      environmentUrl: "/environment.json",
      imageUrl: "/overview.png"
    });
    expect(state.artworkByPage.size).toBe(0);
  });

  it("does not promote decoded artwork after its request becomes stale", async () => {
    const state = createState();

    const stored = await storePrefetchedArtwork(
      {
        getPageEnvironmentUrl: () => null,
        isCurrentRequest: () => false,
        preloadArtworkImage: vi.fn(async () => {}),
        state
      },
      {
        page: {
          imageUrl: "/stale.png",
          status: "ready"
        },
        request: {
          requestEpoch: 1,
          requestSceneId: "overview"
        },
        target: {
          key: "stale-page",
          nodeId: "stale-node",
          sceneId: "overview",
          title: "Stale"
        }
      }
    );

    expect(stored).toBe(false);
    expect(state.artworkByScene.size).toBe(0);
    expect(state.artworkByPage.size).toBe(0);
  });
});
