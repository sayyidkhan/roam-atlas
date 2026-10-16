// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CountryArrival } from "../../apps/web/src/features/countryArrival/CountryArrival";
import { installDialogFixture } from "../support/dialog-dom";

const country = { name: "Singapore", slug: "singapore", code: "SG", displayCode: "SG" };
let restore: () => void;
beforeEach(() => { restore = installDialogFixture(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); restore(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shows the selected country and continues once after its arrival sequence", () => {
  const complete = vi.fn();
  const { container } = render(<CountryArrival country={country} onComplete={complete} onDismiss={vi.fn()} />);
  expect(screen.getByRole("dialog", { name: "Singapore." })).toBeTruthy();
  fireEvent.load(container.querySelector("img")!);
  act(() => vi.advanceTimersByTime(3399));
  expect(complete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(complete).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
  expect(complete).toHaveBeenCalledTimes(1);
});

it("supports skipping and cleans up navigation when the user goes back", () => {
  const complete = vi.fn();
  const dismiss = vi.fn();
  const { unmount } = render(<CountryArrival country={country} onComplete={complete} onDismiss={dismiss} />);
  fireEvent.click(screen.getByRole("button", { name: "Back to the world" }));
  expect(dismiss).toHaveBeenCalledTimes(1);
  unmount();
  act(() => vi.runAllTimers());
  expect(complete).not.toHaveBeenCalled();
});

it("does not force animation on reduced-motion users, even if the image fails", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const complete = vi.fn();
  const { container } = render(<CountryArrival country={country} onComplete={complete} onDismiss={vi.fn()} />);
  fireEvent.error(container.querySelector("img")!);
  act(() => vi.advanceTimersByTime(0));
  expect(complete).toHaveBeenCalledTimes(1);
});
