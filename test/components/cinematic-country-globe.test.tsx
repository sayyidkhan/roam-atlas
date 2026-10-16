// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { worldCountries } from "../../libs/data/src/countries";
import { CONTINENTS, countryContinents } from "../../apps/web/src/features/countryCatalog/countryContinents";
import { countriesInView, shortestGlobeTurn } from "../../apps/web/src/features/landingVariants/cinematic/globeNavigation";
import { focusAngles, projectGlobeMarker } from "../../apps/web/src/features/countryCatalog/globeMarkerProjection";
import { countryCoordinates } from "../../apps/web/src/features/countryCatalog/countryGeography";
import { DestinationGlobe } from "../../apps/web/src/features/landingVariants/cinematic/DestinationGlobe";
import { CinematicLanding } from "../../apps/web/src/features/landingVariants/cinematic/CinematicLanding";

import { installDialogFixture } from "../support/dialog-dom";

let restoreDialog: () => void;
const globe = vi.hoisted(() => ({ update: vi.fn(), destroy: vi.fn(), create: vi.fn() }));
vi.mock("cobe", () => ({ default: globe.create }));

beforeEach(() => {
  restoreDialog = installDialogFixture();
  vi.useFakeTimers();
  globe.create.mockReturnValue(globe);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGLRenderingContext);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); restoreDialog(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("cinematic worldwide browsing", () => {
  it("keeps all 195 countries in a drawer and closes it after an explicit preview selection", () => {
    const onOpen = vi.fn();
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={onOpen} onConfigure={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview Zimbabwe" })).toBeNull();
    const trigger = screen.getByRole("button", { name: "Open country drawer" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(195);
    expect(screen.getByRole("status").textContent).toBe("195 countries to explore");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    fireEvent.click(screen.getByRole("button", { name: "Preview Zimbabwe" }));
    expect(screen.getByRole("heading", { name: "Zimbabwe." })).not.toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Next country" }));
    expect(screen.getByRole("heading", { name: "Afghanistan." })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Explore Afghanistan" }));
    expect(onOpen).toHaveBeenCalledWith(worldCountries[0]);
  });

  it("dismisses without changing the country and restores focus to its trigger", () => {
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Open country drawer" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Norway." })).not.toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("synchronizes a globe pick with the hero, selected drawer card, and drawer scroll", () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
      if (this.tagName === "CANVAS") return { left: 0, top: 0, width: 500, height: 500 } as DOMRect;
      if (this.id === "country-drawer-results") return { top: 200 } as DOMRect;
      if (this.getAttribute("aria-pressed") === "true") return { top: 1200 } as DOMRect;
      return originalRect.call(this);
    });
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    const canvas = screen.getByRole("img");
    Object.assign(canvas, { setPointerCapture: vi.fn(), hasPointerCapture: () => false });
    const [phi, theta] = focusAngles(...countryCoordinates.NO);
    const [latitude, longitude] = countryCoordinates.PT;
    const point = projectGlobeMarker({ latitude, longitude, width: 500, height: 500, phi, theta });
    expect(point.visible).toBe(true);
    const pointer = { pointerId: 1, button: 0, clientX: point.x, clientY: point.y };
    fireEvent.pointerMove(canvas, pointer);
    expect(screen.getByText("Portugal")).not.toBeNull();
    fireEvent.pointerDown(canvas, pointer);
    fireEvent.pointerUp(canvas, pointer);
    expect(screen.getByRole("heading", { name: "Portugal." })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Explore Portugal" })).not.toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Portugal highlighted");
    fireEvent.click(screen.getByRole("button", { name: "Find Portugal in country drawer" }));
    expect(screen.getByRole("button", { name: "Preview Portugal" }).getAttribute("aria-pressed")).toBe("true");
    const pane = document.getElementById("country-drawer-results")!;
    expect(pane.scrollTop).toBe(996);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Japan" } });
    expect(pane.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Preview Japan" }));
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Japan highlighted");
    expect(globe.update.mock.lastCall![0].markers.find((marker: { size: number }) => marker.size === 0.065).location).toEqual(countryCoordinates.JP);
    fireEvent.click(screen.getByRole("button", { name: "Open country drawer" }));
    expect(screen.getByRole("searchbox").getAttribute("value")).toBe("");
    expect(screen.getByRole("button", { name: "Preview Japan" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("country-drawer-results")!.scrollTop).toBe(996);
  });

  it("has valid approximate coordinates for every catalog country", () => {
    expect(worldCountries).toHaveLength(195);
    for (const country of worldCountries) {
      const [lat, lng] = countryCoordinates[country.code];
      expect(Number.isFinite(lat) && Math.abs(lat) <= 90).toBe(true);
      expect(Number.isFinite(lng) && Math.abs(lng) <= 180).toBe(true);
    }
  });

  it("updates selected pins without recreating the globe or introducing zoom", () => {
    const norway = worldCountries.find((country) => country.slug === "norway")!;
    const japan = worldCountries.find((country) => country.slug === "japan")!;
    const { rerender, unmount } = render(<DestinationGlobe countries={worldCountries} selected={norway} onSelect={vi.fn()} />);
    expect(globe.create).toHaveBeenCalledTimes(1);
    expect(globe.create.mock.calls[0][1].scale).toBe(1);
    rerender(<DestinationGlobe countries={worldCountries} selected={japan} onSelect={vi.fn()} />);
    const update = globe.update.mock.lastCall![0];
    expect(update.markers).toHaveLength(195);
    expect(update.markers.find((marker: { size: number }) => marker.size === 0.065).location).toEqual(countryCoordinates.JP);
    fireEvent.click(screen.getByRole("button", { name: "Turn globe right" }));
    expect(globe.update.mock.lastCall![0]).not.toHaveProperty("scale");
    expect(globe.create).toHaveBeenCalledTimes(1);
    unmount();
    const calls = globe.update.mock.calls.length;
    vi.runAllTimers();
    expect(globe.update).toHaveBeenCalledTimes(calls);
    expect(globe.destroy).toHaveBeenCalledTimes(1);
  });

  it("animates region navigation, exposes named choices, and restores focus on close", () => {
    let nextFrame: FrameRequestCallback | undefined;
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { nextFrame = callback; return 1; });
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse globe" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close globe explorer" }));
    expect(screen.getAllByRole("button", { name: /^Globe preview / })).toHaveLength(6);
    const [startPhi, startTheta] = focusAngles(...countryCoordinates.NO);
    fireEvent.click(screen.getByRole("button", { name: "Asia" }));
    act(() => nextFrame!(425));
    const halfway = globe.update.mock.lastCall![0];
    const movingLabels = screen.getAllByRole("button", { name: /^Globe preview / });
    expect(movingLabels.every((label) => label.getAttribute("aria-disabled") === "true")).toBe(true);
    fireEvent.click(movingLabels[0]);
    expect(screen.getByRole("heading", { name: "Norway." })).not.toBeNull();
    const [targetPhi, targetTheta] = focusAngles(30, 100);
    expect(halfway.phi).not.toBe(startPhi);
    expect(halfway.theta).toBeGreaterThan(targetTheta);
    expect(halfway.theta).toBeLessThan(startTheta);
    expect(halfway).not.toHaveProperty("scale");
    act(() => nextFrame!(850));
    expect(shortestGlobeTurn(globe.update.mock.lastCall![0].phi, targetPhi)).toBeCloseTo(0);
    expect(globe.update.mock.lastCall![0].theta).toBeCloseTo(targetTheta);
    expect(screen.getAllByRole("button", { name: /^Globe preview / }).every((label) => label.getAttribute("aria-disabled") === "false")).toBe(true);
    const target = countriesInView(worldCountries, { phi: targetPhi, theta: targetTheta })[0];
    fireEvent.click(screen.getByRole("button", { name: `Globe preview ${target.name}` }));
    expect(screen.getByRole("heading", { name: `${target.name}.` })).not.toBeNull();
    const canvas = screen.getByRole("img");
    Object.assign(canvas, { setPointerCapture: vi.fn() });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    expect(cancel).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Close globe explorer" }), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Close globe explorer" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Browse globe" }));
  });

  it("takes the short rotation and skips motion when reduced motion is requested", () => {
    expect(shortestGlobeTurn(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const raf = vi.spyOn(window, "requestAnimationFrame");
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse globe" }));
    fireEvent.click(screen.getByRole("button", { name: "Oceania" }));
    expect(raf).not.toHaveBeenCalled();
    expect(globe.update.mock.lastCall![0].theta).toBeCloseTo(-20 * Math.PI / 180);
    expect(screen.getAllByRole("button", { name: /^Globe preview / })).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Search all 195 countries" }));
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(195);
  });

  it("shows selected-country context and requires explicit entry from the globe", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const onOpen = vi.fn();
    const countryPacks = { sweden: { registration: "runtime_draft", confidence: "confirmed" } };
    render(<CinematicLanding countries={worldCountries} countryPacks={countryPacks} onOpen={onOpen} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse globe" }));
    const label = screen.getByRole("button", { name: "Globe preview Sweden" });
    label.focus();
    fireEvent.click(label);
    expect(onOpen).not.toHaveBeenCalled();
    const preview = within(screen.getByRole("article", { name: "Selected country preview" }));
    expect(preview.getByRole("heading", { name: "Sweden" })).not.toBeNull();
    expect(preview.getByText("Starter atlas · unverified")).not.toBeNull();
    expect(preview.queryByText("Source-reviewed atlas")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Globe preview Sweden" }));
    fireEvent.click(preview.getByRole("button", { name: "Open Sweden atlas" }));
    expect(onOpen).toHaveBeenCalledWith(worldCountries.find((country) => country.slug === "sweden"));
  });

  it("filters globe markers, labels, search and the complete drawer for every continent", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse globe" }));
    expect(worldCountries.every((country) => CONTINENTS.includes(countryContinents[country.code]))).toBe(true);
    let total = 0;
    for (const continent of CONTINENTS) {
      const expected = worldCountries.filter((country) => countryContinents[country.code] === continent);
      total += expected.length;
      const name = continent.replace("North", "N.").replace("South", "S.");
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
      const markerUpdate = [...globe.update.mock.calls].reverse().find(([value]) => value.markers)?.[0];
      expect(markerUpdate.markers.map((marker: { location: number[] }) => marker.location)).toEqual(expected.map((country) => countryCoordinates[country.code]));
      for (const label of screen.getAllByRole("button", { name: /^Globe preview / })) {
        expect(expected.some((country) => label.getAttribute("aria-label") === `Globe preview ${country.name}`)).toBe(true);
      }
      fireEvent.click(screen.getByRole("button", { name: `View all ${expected.length} countries in ${continent}` }));
      expect(screen.getAllByRole("button", { name: /^Preview / }).map((button) => button.getAttribute("aria-label"))).toEqual(expected.map((country) => `Preview ${country.name}`));
      expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(continent);
      const excluded = worldCountries.find((country) => countryContinents[country.code] !== continent)!;
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: excluded.name } });
      expect(screen.queryByRole("button", { name: `Preview ${excluded.name}` })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Close country drawer" }));
    }
    expect(total).toBe(195);
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    const update = [...globe.update.mock.calls].reverse().find(([value]) => value.markers)?.[0];
    expect(update.markers).toHaveLength(195);
    fireEvent.click(screen.getByRole("button", { name: "Search all 195 countries" }));
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(195);
  });

  it("tilts vertically with buttons and keyboard while clamping both poles", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse globe" }));
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: "Tilt globe up" }));
    expect(globe.update.mock.lastCall![0].theta).toBe(1.4);
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: "Tilt globe down" }));
    expect(globe.update.mock.lastCall![0].theta).toBe(-1.4);
    fireEvent.keyDown(screen.getByRole("img"), { key: "ArrowUp" });
    expect(globe.update.mock.lastCall![0].theta).toBeCloseTo(-1.05);
    expect(globe.update.mock.lastCall![0]).not.toHaveProperty("scale");
  });

  it("keeps country browsing usable when WebGL is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<CinematicLanding countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
    expect(screen.getByText("The world is still yours.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open country drawer" }));
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(195);
    fireEvent.click(screen.getByRole("button", { name: "Preview Japan" }));
    expect(screen.getByRole("heading", { name: "Japan." })).not.toBeNull();
  });
});

it("navigates east with the right arrow and returns west with the left arrow", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const norway = worldCountries.find((country) => country.code === "NO")!;
  render(<DestinationGlobe countries={worldCountries} selected={norway} onSelect={vi.fn()} />);
  const [latitude, longitude] = countryCoordinates.NO;
  const [phi] = focusAngles(latitude, longitude);
  fireEvent.click(screen.getByRole("button", { name: "Turn globe right" }));
  const next = globe.update.mock.lastCall![0];
  const eastLongitude = longitude + 0.45 * 180 / Math.PI;
  const eastPoint = projectGlobeMarker({ latitude, longitude: eastLongitude, ...next, width: 500, height: 500 });
  expect(eastPoint.x).toBeCloseTo(250);
  fireEvent.click(screen.getByRole("button", { name: "Turn globe left" }));
  expect(shortestGlobeTurn(globe.update.mock.lastCall![0].phi, phi)).toBeCloseTo(0);
});
