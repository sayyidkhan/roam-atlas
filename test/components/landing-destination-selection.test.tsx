// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasLanding } from "../../apps/web/src/features/landingVariants/atlas/AtlasLanding";
import { CinematicLanding } from "../../apps/web/src/features/landingVariants/cinematic/CinematicLanding";

import { installDialogFixture } from "../support/dialog-dom";

let restoreDialog: () => void;
beforeEach(() => { restoreDialog = installDialogFixture(); });

vi.mock("../../apps/web/src/features/landingVariants/cinematic/DestinationGlobe", () => ({
  DestinationGlobe: () => <div aria-label="World destination globe" />
}));

const countries = [
  { code: "JP", displayCode: "JP", name: "Japan", slug: "japan" },
  { code: "MY", displayCode: "MY", name: "Malaysia", slug: "malaysia" },
  { code: "SG", displayCode: "SG", name: "Singapore", slug: "singapore" },
  { code: "IT", displayCode: "IT", name: "Italy", slug: "italy" }
];
const countryPacks = {
  japan: { confidence: "confirmed", registration: "unregistered" },
  malaysia: { confidence: "unconfirmed", registration: "runtime_draft" },
  singapore: { confidence: "confirmed", registration: "source_controlled" },
  italy: { registration: "source_controlled" }
};

describe("destination preview guardrails", () => {
  afterEach(() => { cleanup(); restoreDialog(); vi.unstubAllGlobals(); });

  it("requires explicit entry after selecting an atlas preview and preserves confidence labels", () => {
    const onOpen = vi.fn();
    const onConfigure = vi.fn();
    render(<AtlasLanding {...{ countries, countryPacks, onOpen, onConfigure }} />);
    expect(screen.getByText("Create a starter atlas")).not.toBeNull();
    const search = screen.getByRole("searchbox", { name: "Search countries" });
    fireEvent.change(search, { target: { value: "MY" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByText("Starter atlas · unverified")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enter Malaysia" }));
    expect(onOpen).toHaveBeenCalledWith(countries[1]);
    fireEvent.click(screen.getByRole("button", { name: "Customize Malaysia atlas" }));
    expect(onConfigure).toHaveBeenCalledWith(countries[1]);
    fireEvent.change(search, { target: { value: "Singapore" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByText("Source-reviewed atlas")).not.toBeNull();
    fireEvent.change(search, { target: { value: "Italy" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByText("Starter atlas · unverified")).not.toBeNull();
    fireEvent.change(search, { target: { value: "Atlantis" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("status").textContent).toContain("No countries found");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps cinematic preview changes separate from entry and never opens an unknown search", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const onOpen = vi.fn();
    render(<CinematicLanding {...{ countries, countryPacks, onOpen }} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open country drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Italy" }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(within(screen.getByRole("region", { name: "Italy." })).getByText("Starter atlas · unverified")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Explore Italy" }));
    expect(onOpen).toHaveBeenCalledWith(countries[3]);
    fireEvent.click(screen.getByRole("button", { name: "Open country drawer" }));
    const search = screen.getByRole("searchbox", { name: "Search countries" });
    fireEvent.change(search, { target: { value: "SG" } });
    expect(within(screen.getByRole("dialog")).getByText("Source-reviewed atlas")).not.toBeNull();
    fireEvent.submit(screen.getByRole("search"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Explore Singapore" }));
    expect(onOpen).toHaveBeenLastCalledWith(countries[2]);
    fireEvent.click(screen.getByRole("button", { name: "Open country drawer" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Atlantis" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain("0 countries");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("status").textContent).toBe("4 countries to explore");
  });
});
