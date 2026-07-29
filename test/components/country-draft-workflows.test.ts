// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createCountryDraftLifecycleController } from "../../apps/web/src/features/countryDraft/countryDraftLifecycleController";
import { createCountryDraftMutationController } from "../../apps/web/src/features/countryDraft/countryDraftMutationController";
import { createCountryDraftStore } from "../../apps/web/src/features/countryDraft/countryDraftStore";
import type {
  DraftNode
} from "../../apps/web/src/features/countryDraft/countryDraftTypes";

const country = {
  code: "SG",
  name: "Singapore",
  slug: "singapore"
};

function createScrollSnapshot() {
  return {
    panelLeft: 0,
    panelTop: 0,
    shellLeft: 0,
    shellTop: 0,
    windowLeft: 0,
    windowTop: 0
  };
}

describe("country draft workflow boundaries", () => {
  it("reconstructs checked-in facts before merging unconfirmed runtime candidates", async () => {
    const draftStore = createCountryDraftStore();
    const sourceDraft = {
      changeNote: "source",
      regions: [
        {
          confidence: "confirmed",
          name: "Central"
        }
      ]
    };
    const storedDraft = {
      regions: [
        {
          children: [
            {
              confidence: "unconfirmed",
              name: "Candidate"
            }
          ],
          name: "Central"
        }
      ]
    };
    const appendCandidates = vi.fn(
      (target, _regionName, runtimeDraft) => {
        target.regions[0].children =
          runtimeDraft.regions[0].children;
      }
    );
    const render = vi.fn();
    const controller =
      createCountryDraftLifecycleController({
        appendUnconfirmedRegionCandidates:
          appendCandidates,
        captureCountryShellScroll: createScrollSnapshot,
        countryDraftClient: {
          load: vi.fn().mockResolvedValue({
            draft: storedDraft
          })
        },
        createCountryPackStarterMap: () => sourceDraft,
        ensureCountryPack: vi
          .fn()
          .mockResolvedValue({ countrySlug: "singapore" }),
        explainError: String,
        getSelectedCountry: () => country,
        isConfiguredCountryPack: () => true,
        render,
        restoreCountryShellScroll: vi.fn(),
        draftStore
      });

    await controller.loadStoredCountryDraft(country);

    const result =
      draftStore.get("singapore")?.draft;
    expect(result).toBe(sourceDraft);
    expect(result?.regions?.[0]).toMatchObject({
      confidence: "confirmed",
      name: "Central"
    });
    expect(result?.regions?.[0]?.children?.[0]).toMatchObject({
      confidence: "unconfirmed",
      name: "Candidate"
    });
    expect(appendCandidates).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("blocks local editing of approved source records", () => {
    const draftStore = createCountryDraftStore();
    const approvedNode: DraftNode = {
      confidence: "confirmed",
      name: "Marina Bay",
      reviewStatus: "approved"
    };
    draftStore.set("singapore", {
      status: "ready",
      draft: { regions: [approvedNode] }
    });
    const showToast = vi.fn();
    const prompt = vi.spyOn(window, "prompt");
    const reorder = vi.fn();
    const controller =
      createCountryDraftMutationController({
        candidateNameMaxLength: 80,
        captureCountryShellScroll: createScrollSnapshot,
        countryDraftClient: { reorder },
        explainError: String,
        getDraftNodeAtPath: () => approvedNode,
        isDraftItemApproved: () => true,
        removeDraftNodeAtPath: () => null,
        render: vi.fn(),
        reorderArray: () => null,
        restoreCountryShellScroll: vi.fn(),
        showToast,
        draftStore
      });

    controller.editUnconfirmedDraftCandidate(
      country,
      ["regions", 0]
    );

    expect(prompt).not.toHaveBeenCalled();
    expect(reorder).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Candidate cannot be edited"
      })
    );
  });
});
