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

    const quality = screen.getByRole("combobox", { name: "Illustration detail" });
    expect(quality).toHaveProperty("value", "high");
    expect(quality).toHaveProperty("disabled", true);
    expect(screen.getByText("Checking existing visuals")).toBeTruthy();
    act(() => artworkQualityLockStore.set("singapore", {
      status: "failed", message: "Quality service unavailable"
    }));
    expect(screen.getByText("Couldn’t verify visuals. Refresh to retry.")).toBeTruthy();
    expect(quality).toHaveProperty("disabled", true);
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
          { value: "low", label: "Low", description: "Fastest" },
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
    const quality = screen.getByRole("combobox", { name: "Illustration detail" });
    expect(quality).toHaveProperty("value", "high");
    expect(quality).toHaveProperty("disabled", false);
    fireEvent.click(quality);
    fireEvent.click(screen.getByRole("option", { name: "Low" }));
    expect(commands.setImageQuality).toHaveBeenCalledWith("low");
    expect(screen.queryByRole("heading", { name: "Inside the atlas" })).toBeNull();
    expect(
      container.querySelector(".country-draft")
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Scrollable atlas contents" }).getAttribute("tabindex")).toBe("0");
    const navigation = screen.getByRole("navigation", { name: "Atlas navigation" });
    expect(navigation.contains(screen.getByRole("button", { name: /Build Singapore map/ }))).toBe(true);
    expect(navigation.contains(screen.getByRole("button", { name: /Reset Generated Visuals/ }))).toBe(true);
    const homeLink = screen.getByRole("link", { name: "RoamAtlas home" });
    expect(homeLink.closest("footer")).toBeTruthy();
    expect(navigation.contains(homeLink)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Reset Generated Visuals/ }));
    expect(commands.resetGeneratedVisuals).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Back to countries/ }));
    expect(commands.backToCountries).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("combobox", { name: "Illustration detail" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reset Generated Visuals/ })).toBeTruthy();
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
    const quality = screen.getByRole("combobox", { name: "Illustration detail" });
    expect(quality).toHaveProperty("value", "medium");
    expect(quality).toHaveProperty("disabled", true);
    expect(screen.getByText("Locked · reset visuals to change")).toBeTruthy();
  });

  it("locks generated maps until curation is confirmed", () => {
    const commands = createCommandMocks();
    const runtimeCacheStore = createCountryRuntimeCacheStore();
    const draftStore = createCountryDraftStore();
    const artworkQualityLockStore =
      createCountryArtworkQualityLockStore();
    artworkQualityLockStore.set("thailand", {
      status: "ready",
      lock: {
        countrySlug: "thailand",
        imageQuality: null,
        locked: false
      }
    });
    draftStore.set("thailand", {
      status: "ready",
      draft: {
        countryName: "Thailand",
        summary: "Source-grounded travel chapters",
        regions: [],
        themes: []
      },
      confirmation: null,
      messages: []
    });
    render(<CountrySetupSurface />);

    act(() => {
      countrySetupStore.getState().setSetup({
        buildDraftPhotoUrl: vi.fn(() => "/reference.jpg"),
        country: {
          code: "TH",
          name: "Thailand",
          slug: "thailand"
        },
        canOpenMap: true,
        draftStore,
        draftCommands: createDraftCommandMocks(),
        imageQuality: "high",
        imageQualityOptions: [
          {
            value: "high",
            label: "High",
            description: "Best detail"
          }
        ],
        isSourceControlled: false,
        artworkQualityLockStore,
        runtimeCacheStore,
        commands
      });
    });

    const lockedButton = screen.getByRole("button", {
      name: /Confirm curation first/
    });
    expect(screen.getByText("Action required")).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Confirm curation before opening the map"
      })
    ).toBeTruthy();
    expect(lockedButton).toHaveProperty("disabled", true);
    fireEvent.click(lockedButton);
    expect(commands.openOrBuildMap).not.toHaveBeenCalled();

    act(() => {
      draftStore.set("thailand", {
        status: "ready",
        draft: {
          countryName: "Thailand",
          summary: "Source-grounded travel chapters",
          regions: [],
          themes: []
        },
        confirmation: {
          paths: {
            confirmationUrl: "/confirmation.json",
            countryPackDraftUrl: "/country.json"
          }
        },
        messages: []
      });
    });

    const openButton = screen.getByRole("button", {
      name: /Open Thailand map/
    });
    expect(openButton).toHaveProperty("disabled", false);
    fireEvent.click(openButton);
    expect(commands.openOrBuildMap).toHaveBeenCalledTimes(1);
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
