// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountrySetupSurface } from "../../apps/web/src/features/countrySetup/CountrySetupSurface";
import { countrySetupStore } from "../../apps/web/src/features/countrySetup/countrySetupStore";
import { createCountryRuntimeCacheStore } from "../../apps/web/src/features/runtimeCache/countryRuntimeCacheStore";
import { createCountryDraftStore } from "../../apps/web/src/features/countryDraft/countryDraftStore";
import { createCountryArtworkQualityLockStore } from "../../apps/web/src/features/artwork/countryArtworkQualityLockStore";

afterEach(() => {
  cleanup();
  act(() => countrySetupStore.getState().clear());
});

describe("CountrySetupSurface", () => {
  it("explains why quality controls are disabled while the lock is loading", () => {
    const runtimeCacheStore = createCountryRuntimeCacheStore();
    const draftStore = createCountryDraftStore();
    const artworkQualityLockStore = createCountryArtworkQualityLockStore();
    render(<CountrySetupSurface />);

    act(() => {
      countrySetupStore.getState().setSetup({
        buildDraftPhotoUrl: vi.fn(() => "/reference.jpg"),
        country: { code: "SG", name: "Singapore", slug: "singapore" },
        canOpenMap: true,
        draftStore,
        draftCommands: createDraftCommandMocks(),
        imageQuality: "high",
        imageQualityOptions: [
          { value: "high", label: "High", description: "Best detail" }
        ],
        isSourceControlled: true,
        artworkQualityLockStore,
        runtimeCacheStore,
        commands: createCommandMocks()
      });
    });

    expect(
      screen.getByText("Checking existing visuals")
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: /High/ })
    ).toHaveProperty("disabled", true);
  });

  it("renders the setup shell from feature-owned store state", () => {
    const commands = createCommandMocks();
    const runtimeCacheStore =
      createCountryRuntimeCacheStore();
    const draftStore = createCountryDraftStore();
    const artworkQualityLockStore = createCountryArtworkQualityLockStore();
    artworkQualityLockStore.set("singapore", {
      status: "ready",
      lock: { countrySlug: "singapore", imageQuality: null, locked: false }
    });
    draftStore.set("singapore", {
      status: "ready",
      draft: {
        countryName: "Singapore",
        summary: "Starter direction",
        regions: [],
        themes: []
      },
      messages: []
    });
    const { container } = render(<CountrySetupSurface />);

    act(() => {
      countrySetupStore.getState().setSetup({
        buildDraftPhotoUrl: vi.fn(() => "/reference.jpg"),
        country: {
          code: "SG",
          name: "Singapore",
          slug: "singapore"
        },
        canOpenMap: false,
        draftStore,
        draftCommands: createDraftCommandMocks(),
        imageQuality: "high",
        imageQualityOptions: [
          {
            value: "high",
            label: "High",
            description: "Best detail",
            recommended: true
          }
        ],
        isSourceControlled: true,
        artworkQualityLockStore,
        runtimeCacheStore,
        commands
      });
    });

    expect(
      screen.getByRole("heading", { name: "Singapore", level: 1 })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", {
          name: /Build Singapore map/
        })
        .getAttribute("data-country-action")
    ).toBe("build-starter-map");
    expect(
      screen
        .getByRole("radio", { name: /High/ })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(screen.getByText("AI starter map")).toBeTruthy();
    expect(
      container.querySelector(".country-draft")
    ).toBeTruthy();
    act(() => {
      draftStore.set("singapore", {
        status: "ready",
        draft: {
          countryName: "Singapore",
          summary: "Updated directly from the draft store",
          regions: [],
          themes: []
        },
        messages: []
      });
    });
    expect(
      screen.getByText("Updated directly from the draft store")
    ).toBeTruthy();
    const actionGuide = screen.getByRole("button", {
      name: "Action guide"
    });
    expect(actionGuide.getAttribute("aria-expanded")).toBe(
      "false"
    );
    fireEvent.click(actionGuide);
    expect(actionGuide.getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(
      screen.getByRole("region", {
        name: "Country action legend"
      })
    ).toBeTruthy();
    fireEvent.click(actionGuide);
    expect(
      screen.queryByRole("region", {
        name: "Country action legend"
      })
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Build Singapore map/
      })
    );
    expect(commands.openOrBuildMap).toHaveBeenCalledTimes(1);
  });

  it("keeps cache failures explicit without hiding the draft", () => {
    const runtimeCacheStore =
      createCountryRuntimeCacheStore();
    const draftStore = createCountryDraftStore();
    const artworkQualityLockStore = createCountryArtworkQualityLockStore();
    artworkQualityLockStore.set("malaysia", {
      status: "ready",
      lock: { countrySlug: "malaysia", imageQuality: "medium", locked: true }
    });
    draftStore.set("malaysia", {
      status: "ready",
      draft: {
        countryName: "Malaysia",
        summary: "Reviewed draft remains available",
        regions: [],
        themes: []
      },
      messages: []
    });
    runtimeCacheStore.set("malaysia", {
      status: "failed",
      scope: "visuals",
      message: "Cache service unavailable."
    });
    render(<CountrySetupSurface />);

    act(() => {
      countrySetupStore.getState().setSetup({
        buildDraftPhotoUrl: vi.fn(() => "/reference.jpg"),
        country: {
          code: "MY",
          name: "Malaysia",
          slug: "malaysia"
        },
        canOpenMap: true,
        draftStore,
        draftCommands: createDraftCommandMocks(),
        imageQuality: "medium",
        imageQualityOptions: [
          {
            value: "medium",
            label: "Medium",
            description: "Balanced"
          }
        ],
        isSourceControlled: false,
        artworkQualityLockStore,
        runtimeCacheStore,
        commands: createCommandMocks()
      });
    });

    expect(screen.getByText("Visual reset failed")).toBeTruthy();
    expect(
      screen.getByText("Cache service unavailable.")
    ).toBeTruthy();
    expect(
      screen.getByText("Reviewed draft remains available")
    ).toBeTruthy();
    expect(
      screen.getByText("Locked to medium quality")
    ).toBeTruthy();
    expect(
      screen.getByText(/Generated visuals use one quality/)
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: /Medium/ })
    ).toHaveProperty("disabled", true);
  });
});

function createCommandMocks() {
  return {
    backToCountries: vi.fn(),
    openOrBuildMap: vi.fn(),
    resetGeneratedVisuals: vi.fn(),
    setImageQuality: vi.fn()
  };
}

function createDraftCommandMocks() {
  return {
    approveItem: vi.fn(),
    confirmForCuration: vi.fn(),
    deleteItem: vi.fn(),
    editCandidate: vi.fn(),
    openReferencePhoto: vi.fn(),
    rebuildMetadata: vi.fn(),
    reorderItems: vi.fn(),
    resetReferencePhotos: vi.fn(),
    submitGenAi: vi.fn()
  };
}
