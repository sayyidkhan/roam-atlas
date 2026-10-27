// @vitest-environment jsdom
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftReferencePhoto } from "../../apps/web/src/features/countryDraft/CountryDraftReferencePhoto";
import { DraftReferencePhotoRegistry } from "../../apps/web/src/features/countryDraft/draftReferencePhotoRegistry";
import { APP_CONFIG } from "../../apps/web/src/config/appConfig";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CountryDraftReferencePhoto", () => {
  const lifecycle = APP_CONFIG.placeImages.loadLifecycle;
  const photo = <CountryDraftReferencePhoto buildUrl={() => "/reference.jpg"} kind="region" onOpen={vi.fn()} placeName="Marina Bay" />;

  it("retries a failed image after the failed request is removed", () => {
    vi.useFakeTimers();
    const { container } = render(photo);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    act(() => vi.advanceTimersByTime(lifecycle.retryBaseDelayMs));
    const retry = container.querySelector("img");
    expect(retry).not.toBeNull();
    fireEvent.load(retry!);
    expect(screen.getByRole("button", { name: "Reference photo for Marina Bay: Ready" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(lifecycle.timeoutMs * 4));
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("allows a photo to load again after switching away from its list", () => {
    const { container, rerender } = render(<DraftReferencePhotoRegistry>{photo}</DraftReferencePhotoRegistry>);
    fireEvent.load(container.querySelector("img")!);
    rerender(<DraftReferencePhotoRegistry>{null}</DraftReferencePhotoRegistry>);
    rerender(<DraftReferencePhotoRegistry>{photo}</DraftReferencePhotoRegistry>);
    fireEvent.load(container.querySelector("img")!);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.queryByText("Duplicate")).toBeNull();
  });

  it("stops after bounded failures and lets the user retry", () => {
    vi.useFakeTimers();
    const { container } = render(photo);
    for (let attempt = 0; attempt <= lifecycle.maxRetries; attempt++) {
      fireEvent.error(container.querySelector("img")!);
      if (attempt < lifecycle.maxRetries) {
        act(() => vi.advanceTimersByTime(lifecycle.retryBaseDelayMs * (attempt + 1)));
      }
    }
    const retry = screen.getByRole("button", { name: /Photo unavailable · click to retry/ });
    expect(retry.getAttribute("data-photo-state")).toBe("failed");
    expect(container.querySelector("img")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(retry);
    expect(new URL(container.querySelector("img")!.src).searchParams.get("retryMissing")).toBe("1");
    fireEvent.load(container.querySelector("img")!);
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("ends a hanging request instead of starting another long automatic wait", () => {
    vi.useFakeTimers();
    const { container } = render(photo);
    act(() => vi.advanceTimersByTime(lifecycle.timeoutMs));
    expect(screen.getByRole("button", { name: /Photo unavailable · click to retry/ })).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(lifecycle.timeoutMs * 4));
    expect(container.querySelector("img")).toBeNull();
  });

  it("recognizes a cached image even if its load event was missed", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(320);
    render(photo);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a scheduled retry when the thumbnail unmounts", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(photo);
    fireEvent.error(container.querySelector("img")!);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("owns image readiness and duplicate handling in React", () => {
    const openPhoto = vi.fn();
    const buildUrl = vi.fn(() => "/reference.jpg");
    const { container } = render(
      <DraftReferencePhotoRegistry>
        <CountryDraftReferencePhoto
          buildUrl={buildUrl}
          kind="region"
          onOpen={openPhoto}
          placeName="Marina Bay"
        />
        <CountryDraftReferencePhoto
          buildUrl={buildUrl}
          kind="region"
          onOpen={openPhoto}
          placeName="Civic District"
        />
      </DraftReferencePhotoRegistry>
    );

    const images = [
      ...container.querySelectorAll<HTMLImageElement>(
        ".draft-item-photo"
      )
    ];
    fireEvent.load(images[0]!);
    fireEvent.load(images[1]!);

    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("Duplicate")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reference photo for Marina Bay: Ready"
      })
    );
    expect(openPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "region",
        placeName: "Marina Bay"
      })
    );
  });
});
