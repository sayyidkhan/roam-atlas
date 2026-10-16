// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { worldCountries } from "@roamatlas/data/countries.js";
import { HorizonLanding, HorizonLandingTwo } from "../../apps/web/src/features/landingVariants/horizon/HorizonLanding";
import { countryContinents } from "../../apps/web/src/features/countryCatalog/countryContinents";

vi.mock("../../apps/web/src/features/landingVariants/cinematic/DestinationGlobe", () => ({
  DestinationGlobe: ({ countries, selected, continent, showRegionFilters, onSelect, onContinentChange, onBrowse }: {
    countries: typeof worldCountries;
    selected: typeof worldCountries[number];
    continent: string | null;
    showRegionFilters: boolean;
    onSelect: (country: typeof worldCountries[number]) => void;
    onContinentChange: (continent: string) => void;
    onBrowse: () => void;
  }) => <section aria-label={`Globe selection ${selected.name}`}>
    <output aria-label="Globe continent">{continent ?? "All"}</output>
    <button onClick={() => onSelect(countries.find((country) => country.code === "JP")!)}>Select Japan on globe</button>
    {showRegionFilters ? <button onClick={() => onContinentChange("Europe")}>Filter Europe</button> : null}
    <button onClick={onBrowse}>View continent countries</button>
  </section>
}));

afterEach(cleanup);

function setup() {
  const onOpen = vi.fn();
  render(<HorizonLanding countries={worldCountries} countryPacks={{}} onOpen={onOpen} onConfigure={vi.fn()} />);
  return onOpen;
}

describe("original-based Horizon landing", () => {
  it("previews countries from the original shelf and globe before explicit entry", () => {
    const onOpen = setup();
    expect(screen.getByRole("heading", { name: "Norway." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browse all countries" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview France" }));
    expect(screen.getByRole("heading", { name: "France." })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Globe selection France" })).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select Japan on globe" }));
    expect(screen.getByRole("heading", { name: "Japan." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Explore Japan" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ code: "JP" }));
  });

  it("shows every continent country in the original shelf and restores all 195", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Filter Europe" }));
    fireEvent.click(screen.getByRole("button", { name: "View continent countries" }));
    const grid = screen.getByRole("region", { name: "Country cards" });
    const europe = worldCountries.filter((country) => countryContinents[country.code] === "Europe");
    expect(within(grid).getAllByRole("article")).toHaveLength(europe.length);
    for (const country of europe) expect(within(grid).getByRole("button", { name: `Preview ${country.name}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Filter Europe" })).toBeNull();
    const filters = screen.getByRole("group", { name: "Filter drawer by continent" });
    expect(within(filters).getByRole("button", { name: "Europe 45" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(filters).getByRole("button", { name: "Asia 47" }));
    expect(screen.getByLabelText("Globe continent").textContent).toBe("Asia");
    expect(within(grid).getAllByRole("article")).toHaveLength(47);
    expect(within(grid).queryByRole("button", { name: "Preview France" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search countries" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search countries" }), { target: { value: "Japan" } });
    expect(within(grid).getAllByRole("article")).toHaveLength(1);
    fireEvent.click(within(filters).getByRole("button", { name: "Europe 45" }));
    expect(within(grid).queryAllByRole("article")).toHaveLength(0);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search countries" }), { target: { value: "" } });
    fireEvent.click(within(filters).getByRole("button", { name: "All 195" }));
    expect(screen.getByLabelText("Globe continent").textContent).toBe("All");
    expect(within(grid).getAllByRole("article")).toHaveLength(195);
    fireEvent.click(screen.getByRole("button", { name: "Preview Norway" }));
    expect(screen.getByRole("button", { name: "Filter Europe" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: /Japan, source-reviewed/ })).toBeNull();
  });
});


it("toggles the Horizon 2 country shelf from the same Browse button", () => {
  render(<HorizonLandingTwo countries={worldCountries} countryPacks={{}} onOpen={vi.fn()} onConfigure={vi.fn()} />);
  const browse = screen.getByRole("button", { name: "Browse all countries" });
  expect(browse.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(browse);
  expect(browse.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(browse);
  expect(browse.getAttribute("aria-expanded")).toBe("false");
});


it("surprises with a different catalog country and previews without entering the atlas", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const onOpen = setup();
  fireEvent.click(screen.getByRole("button", { name: "Filter Europe" }));
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  expect(screen.getByRole("heading", { name: "Afghanistan." })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Globe selection Afghanistan" })).toBeTruthy();
  expect(screen.getByLabelText("Globe continent").textContent).toBe("All");
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  expect(screen.getByRole("heading", { name: "Albania." })).toBeTruthy();
  expect(onOpen).not.toHaveBeenCalled();
  random.mockRestore();
});
