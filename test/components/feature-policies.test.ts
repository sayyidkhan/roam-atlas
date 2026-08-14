import { describe, expect, it } from "vitest";

import {
  getArtworkFailureMessage,
  getPageArtworkCacheKey,
  isArtworkJobFailed,
  isArtworkJobPending
} from "../../apps/web/src/features/artwork/artworkJobPolicy";
import {
  getPrefetchDestinationLimit,
  getPrefetchReadinessLabel,
  getPrefetchSceneKey,
  isArtworkTargetReady,
  mergePrefetchedArtwork
} from "../../apps/web/src/features/artwork/artworkPrefetchPolicy";
import {
  getDraftNodeAtPath,
  removeDraftNodeAtPath,
  reorderArray
} from "../../apps/web/src/features/countryDraft/draftTree";
import {
  imageQualityLabel,
  normalizeImageQuality
} from "../../apps/web/src/features/experience/imageQualityPolicy";
import {
  appendPlaceImageHistoryRequest,
  replaceLatestProcessingMessage,
  scopeInstructionToCandidate
} from "../../apps/web/src/features/countrySetup/countryExperiencePolicy";
import {
  createPlaceImageKey
} from "../../apps/web/src/features/placeImages/placeImageSessionStore";
import { normalizeEnvironmentPlanBounds } from "../../apps/web/src/features/explorer/sceneGeometry";
import {
  environmentPlanNeedsTargetRecovery,
  normalizeEnvironmentPlan
} from "../../apps/web/src/features/explorer/environmentPlanPolicy";

describe("stateless frontend feature policies", () => {
  it("classifies artwork jobs without browser state", () => {
    expect(isArtworkJobPending({ status: "processing" })).toBe(true);
    expect(isArtworkJobFailed({ status: "timed_out" })).toBe(true);
    expect(getPageArtworkCacheKey({ id: "page-1", nodeId: "mandai" })).toBe("node:mandai");
    expect(getArtworkFailureMessage("401 invalid API key")).toContain(
      "factual page remains available"
    );
  });

  it("updates nested draft trees immutably", () => {
    const draft = {
      regions: [
        {
          name: "Penang",
          children: [{ name: "George Town" }, { name: "Batu Ferringhi" }]
        }
      ]
    };
    const nextDraft = removeDraftNodeAtPath(draft, "1.1");

    expect(getDraftNodeAtPath(draft, "1.1")?.name).toBe("George Town");
    expect(getDraftNodeAtPath(nextDraft, "1.1")?.name).toBe("Batu Ferringhi");
    expect(draft.regions[0].children).toHaveLength(2);
    expect(reorderArray(["a", "b", "c"], 0, 3)).toEqual(["b", "c", "a"]);
  });

  it("normalizes image quality and bounded target geometry", () => {
    expect(normalizeImageQuality("MEDIUM")).toBe("medium");
    expect(normalizeImageQuality("unsupported")).toBe("high");
    expect(imageQualityLabel("low")).toBe("Low");
    const bounds = normalizeEnvironmentPlanBounds(
      { x: 0.9, y: 0.9, width: 0.8, height: 0.8 },
      { maxWidth: 0.24, maxHeight: 0.12 }
    );
    expect(bounds?.x).toBeCloseTo(0.9);
    expect(bounds?.y).toBeCloseTo(0.9);
    expect(bounds?.width).toBeCloseTo(0.1);
    expect(bounds?.height).toBeCloseTo(0.1);
  });

  it("normalizes environment plans without reading application state", () => {
    const plan = normalizeEnvironmentPlan({
      promptVersion: "environment-plan-v7",
      targets: [
        {
          nodeId: "mandai",
          visualBounds: { x: 0.1, y: 0.2, width: 0.8, height: 0.8 },
          visualOutline: [
            { x: 0.27, y: 0.35 },
            { x: 0.7, y: 0.4 },
            { x: 0.45, y: 0.78 }
          ],
          labelBounds: { x: 0.1, y: 0.2, width: 0.4, height: 0.2 }
        }
      ]
    });

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0].visualBounds?.width).toBe(0.48);
    expect(plan.targets[0].visualOutline).toEqual([
      { x: 0.27, y: 0.35 },
      { x: 0.7, y: 0.4 },
      { x: 0.45, y: 0.78 }
    ]);
    expect(
      environmentPlanNeedsTargetRecovery(
        { targets: [] },
        { nodeId: "singapore" },
        { singapore: { childIds: ["mandai"] } }
      )
    ).toBe(true);
  });

  it("keeps country experience messages and media keys deterministic", () => {
    const messages = [
      { role: "user", text: "More nature", target: "region:Central" },
      {
        role: "assistant",
        status: "processing",
        text: "Working",
        target: "region:Central"
      }
    ];
    const replacement = {
      role: "assistant",
      status: "done",
      text: "Updated",
      target: "region:Central"
    };

    expect(
      replaceLatestProcessingMessage(messages, replacement, "region:Central")
    ).toEqual([messages[0], replacement]);
    expect(
      scopeInstructionToCandidate("theme:Wildlife", "Add wetlands.")
    ).toContain('research theme "Wildlife"');
    expect(createPlaceImageKey("singapore", " Marina Bay ")).toBe(
      "singapore:marina bay"
    );
    expect(
      appendPlaceImageHistoryRequest(
        "/runtime-cache/photo.jpg?size=large",
        "entry 1",
        "session-v1"
      )
    ).toBe(
      "/runtime-cache/photo.jpg?size=large&history=entry%201&view=session-v1"
    );
  });

  it("keeps artwork prefetch identity and cache selection deterministic", () => {
    expect(
      getPrefetchDestinationLimit({
        prefetchDestinationLimit: "3",
        maxParallelImageJobs: 8
      })
    ).toBe(3);
    expect(
      getPrefetchDestinationLimit({
        prefetchDestinationLimit: "invalid",
        maxParallelImageJobs: 2
      })
    ).toBe(2);
    expect(
      getPrefetchSceneKey({
        countrySlug: "singapore",
        sceneId: "overview",
        pageId: "root",
        nodeId: "sg"
      })
    ).toBe("singapore:overview:root:sg");

    const cacheState = {
      scenes: {
        overview: { rootNodeId: "sg" }
      },
      artworkByScene: new Map([
        [
          "overview",
          {
            imageUrl: "/scene.png",
            environmentUrl: "/scene.json"
          }
        ]
      ]),
      artworkByPage: new Map([
        ["node:marina", { imageUrl: "/marina.png" }]
      ])
    };
    expect(
      isArtworkTargetReady(
        {
          key: "scene:overview",
          sceneId: "overview",
          nodeId: "sg"
        },
        cacheState
      )
    ).toBe(true);
    expect(
      mergePrefetchedArtwork(
        { sceneId: "overview", nodeId: "marina" },
        cacheState
      )
    ).toMatchObject({
      imageUrl: "/marina.png",
      artworkDecoded: true,
      status: "ready"
    });
    expect(
      getPrefetchReadinessLabel({
        enabled: true,
        readyCount: 1,
        targetCount: 3
      })
    ).toBe("1 of 3 destinations ready");
  });
});
