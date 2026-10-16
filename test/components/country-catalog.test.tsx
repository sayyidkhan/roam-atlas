// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayfulLanding } from "../../apps/web/src/features/landingVariants/playful/PlayfulLanding";

const countries = [
  { code: "JP", displayCode: "JP", name: "Japan", slug: "japan" },
  { code: "MY", displayCode: "MY", name: "Malaysia", slug: "malaysia" },
  { code: "SG", displayCode: "SG", name: "Singapore", slug: "singapore" },
  { code: "IT", displayCode: "IT", name: "Italy", slug: "italy" },
  { code: "FR", displayCode: "FR", name: "France", slug: "france" },
  { code: "ID", displayCode: "ID", name: "Indonesia", slug: "indonesia" },
  { code: "AL", displayCode: "AL", name: "Albania", slug: "albania" }
];

function setup() {
  const onOpen = vi.fn();
  const onConfigure = vi.fn();
  render(<PlayfulLanding countries={countries} countryPacks={{
    singapore: { confidence: "confirmed", registration: "source_controlled" },
    malaysia: { confidence: "unconfirmed", registration: "runtime_draft" },
    japan: { confidence: "confirmed", registration: "unregistered" },
    italy: { registration: "source_controlled" }
  }} onOpen={onOpen} onConfigure={onConfigure} />);
  return { onOpen, onConfigure };
}

describe("PlayfulLanding", () => {
  afterEach(cleanup);

  it("offers immediate country search without a Singapore-first action or globe controls", () => {
    setup();
    expect(screen.getByRole("searchbox", { name: "Search countries" })).not.toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.queryByRole("button", { name: "Explore Singapore" })).toBeNull();
    expect(screen.queryByRole("button", { name: /globe/i })).toBeNull();
  });

  it("distinguishes missing, unregistered and unverified packs from reviewed data", () => {
    setup();
    expect(screen.getByRole("article", { name: "Singapore, Source-reviewed atlas" })).not.toBeNull();
    expect(screen.getByRole("article", { name: "Malaysia, Starter atlas · unverified" })).not.toBeNull();
    expect(screen.getByRole("article", { name: "Italy, Starter atlas · unverified" })).not.toBeNull();
    expect(screen.getByRole("article", { name: "France, Create a starter atlas" })).not.toBeNull();
    expect(screen.getByRole("article", { name: "Japan, Create a starter atlas" })).not.toBeNull();
  });

  it("searches the entire catalog by name and code, and opens the chosen country", () => {
    const { onOpen, onConfigure } = setup();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " albania " } });
    expect(screen.getByRole("status").textContent).toBe("1 country found");
    fireEvent.submit(screen.getByRole("search"));
    expect(onOpen).toHaveBeenCalledWith(countries[6]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "MY" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Malaysia" }));
    expect(onOpen).toHaveBeenLastCalledWith(countries[1]);
    fireEvent.click(screen.getByRole("button", { name: "Configure Malaysia" }));
    expect(onConfigure).toHaveBeenCalledWith(countries[1]);
  });

  it("recovers from an empty search and never selects an arbitrary match", () => {
    const { onOpen } = setup();
    const scrollIntoView = vi.fn();
    document.getElementById("playful-destinations")!.scrollIntoView = scrollIntoView;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Atlantis" } });
    expect(screen.getByRole("heading", { name: /No countries found/ })).not.toBeNull();
    fireEvent.submit(screen.getByRole("search"));
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[0]);
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    expect(screen.getAllByRole("article")).toHaveLength(6);
    fireEvent.submit(screen.getByRole("search"));
    expect(onOpen).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("browses the complete catalog and returns to the compact selection", () => {
    setup();
    document.getElementById("playful-destinations")!.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: /Browse all 7 countries/ }));
    expect(screen.getAllByRole("article")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: /Show fewer countries/ }));
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });

  it("offers direct suggestions while focused and clears them with Escape", () => {
    const { onOpen } = setup();
    const search = screen.getByRole("searchbox");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "japan" } });
    expect(screen.getByRole("region", { name: "Matching destinations" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose Japan" }));
    expect(onOpen).toHaveBeenCalledWith(countries[0]);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Matching destinations" })).toBeNull();
    expect((search as HTMLInputElement).value).toBe("");
    fireEvent.change(search, { target: { value: "japan" } });
    fireEvent.blur(search, { relatedTarget: document.body });
    expect(screen.queryByRole("region", { name: "Matching destinations" })).toBeNull();
  });
});
