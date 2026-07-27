import { describe, expect, it } from "vitest";

import {
  getArtworkFailureMessage,
  getPageArtworkCacheKey,
  isArtworkJobFailed,
  isArtworkJobPending
} from "../../src/features/artwork/artworkJobPolicy";
import {
  getDraftNodeAtPath,
  removeDraftNodeAtPath,
  reorderArray
} from "../../src/features/countryDraft/draftTree";
import {
  imageQualityLabel,
  normalizeImageQuality
} from "../../src/features/experience/imageQualityPolicy";
import { normalizeEnvironmentPlanBounds } from "../../src/features/explorer/sceneGeometry";
import {
  environmentPlanNeedsTargetRecovery,
  normalizeEnvironmentPlan
} from "../../src/features/explorer/environmentPlanPolicy";

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
          labelBounds: { x: 0.1, y: 0.2, width: 0.4, height: 0.2 }
        }
      ]
    });

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0].visualBounds?.width).toBe(0.48);
    expect(
      environmentPlanNeedsTargetRecovery(
        { targets: [] },
        { nodeId: "singapore" },
        { singapore: { childIds: ["mandai"] } }
      )
    ).toBe(true);
  });
});
