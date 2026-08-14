// @vitest-environment jsdom
import { createElement } from "react";
import {
  act,
  cleanup,
  render
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createImageQualityPreference } from "../../apps/web/src/features/experience/imageQualityPreference";
import { AppToast } from "../../apps/web/src/features/notifications/AppToast";
import { appToastBridge } from "../../apps/web/src/features/notifications/appToastBridge";
import { createAppToastController } from "../../apps/web/src/features/notifications/appToastController";
import { createCountryRuntimeCacheController } from "../../apps/web/src/features/runtimeCache/countryRuntimeCacheController";
import { createCountryRuntimeCacheStore } from "../../apps/web/src/features/runtimeCache/countryRuntimeCacheStore";
import { createCountryDraftStore } from "../../apps/web/src/features/countryDraft/countryDraftStore";
import { createPlaceImageSessionStore } from "../../apps/web/src/features/placeImages/placeImageSessionStore";
import { setBrowserPath } from "../../apps/web/src/app/browserRuntime";
import { createExplorerPageClickAdapter } from "../../apps/web/src/features/explorer/explorerPageClickAdapter";

afterEach(() => {
  act(() => appToastBridge.clear());
  cleanup();
  document.body.innerHTML = "";
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("browser feature adapters", () => {
  it("notifies React Router after internal path changes", () => {
    let receivedEvent: PopStateEvent | null = null;
    const captureEvent = (event: PopStateEvent) => {
      receivedEvent = event;
    };
    window.addEventListener("popstate", captureEvent, {
      once: true
    });

    setBrowserPath("/singapore/place/marina-bay-scroll");

    expect(window.location.pathname).toBe(
      "/singapore/place/marina-bay-scroll"
    );
    expect(receivedEvent).not.toBeNull();
  });

  it("unbinds explorer canvas clicks during React teardown", () => {
    const viewport = document.createElement("div");
    const stage = document.createElement("div");
    viewport.append(stage);
    document.body.append(viewport);
    const onPageClick = vi.fn();
    const adapter = createExplorerPageClickAdapter({
      clamp: (value, minimum, maximum) =>
        Math.min(maximum, Math.max(minimum, value)),
      clamp01: (value) => Math.min(1, Math.max(0, value)),
      getRenderedImageRect: () => ({
        height: 100,
        left: 0,
        top: 0,
        width: 100
      }),
      stage,
      viewport
    });
    const stopListening = adapter.bindPageClick(onPageClick);

    stage.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(onPageClick).toHaveBeenCalledTimes(1);

    stopListening();
    stage.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(onPageClick).toHaveBeenCalledTimes(1);
  });

  it("persists normalized image quality behind a storage adapter", () => {
    const preference = createImageQualityPreference({
      fallbackValue: "high",
      normalizeImageQuality: (value) =>
        String(value).toLowerCase() === "medium" ? "medium" : "high",
      storageKey: "roamatlas:image-quality"
    });

    expect(preference.hasStoredValue()).toBe(false);
    preference.store("medium");
    expect(preference.hasStoredValue()).toBe(true);
    expect(preference.load()).toBe("medium");
  });

  it("renders one toast message and removes the shared region", () => {
    vi.useFakeTimers();
    const toast = createAppToastController({
      defaultDurationMs: 4_000
    });
    render(createElement(AppToast));

    act(() => {
      toast.show({
        title: "Generated visuals reset",
        message: "Cached illustrations were cleared."
      });
    });

    expect(document.querySelectorAll(".app-toast-region")).toHaveLength(1);
    expect(document.querySelectorAll(".app-toast p")).toHaveLength(1);
    expect(document.querySelector(".app-toast")?.textContent).toContain(
      "Cached illustrations were cleared."
    );
    act(() => toast.dismiss());
    expect(document.querySelector(".app-toast-region")).toBeNull();
    vi.useRealTimers();
  });

  it("keeps reviewed draft state when only generated visuals are reset", async () => {
    const draftStore = createCountryDraftStore();
    draftStore.set("singapore", {
      status: "ready",
      draft: { regions: [] }
    });
    draftStore.markStoredDraftChecked("singapore");
    const placeImageSessionStore =
      createPlaceImageSessionStore();
    placeImageSessionStore.markCountryRefresh(
      "singapore",
      1
    );
    const runtimeCacheStore =
      createCountryRuntimeCacheStore();
    const render = vi.fn();
    const showToast = vi.fn();
    const controller = createCountryRuntimeCacheController({
      apiPath: (path) => path,
      clearCountryGeneratedState: vi.fn(),
      draftStore,
      errorToastDurationMs: 8_000,
      explainError: (error) => String(error),
      flushCountryRuntimeCache: vi.fn().mockResolvedValue({ ok: true }),
      placeImageSessionStore,
      refreshArtworkQualityLock: vi.fn().mockResolvedValue(undefined),
      runtimeCacheStore,
      render,
      showToast
    });

    await expect(
      controller.flush(
        { code: "SG", name: "Singapore", slug: "singapore" },
        { confirm: false, scope: "visuals" }
      )
    ).resolves.toBe(true);

    expect(draftStore.has("singapore")).toBe(true);
    expect(
      draftStore.hasCheckedStoredDraft("singapore")
    ).toBe(true);
    expect(
      placeImageSessionStore.getUrlState(
        "singapore",
        "Marina Bay"
      ).countryRefresh
    ).toBeNull();
    expect(
      runtimeCacheStore.getSnapshot("singapore")
    ).toEqual(
      expect.objectContaining({
        scope: "visuals",
        status: "ready"
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Generated visuals reset" })
    );
    expect(render).toHaveBeenCalledTimes(2);
  });
});
