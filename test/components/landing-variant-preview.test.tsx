// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { LandingVariantPreview } from "../../apps/web/src/features/landingVariants/LandingVariantPreview";
import { resolveLandingVariant, type LandingVariantProps } from "../../apps/web/src/features/landingVariants/landingVariantTypes";

vi.mock("../../apps/web/src/features/landingVariants/playful/PlayfulLanding", () => ({
  PlayfulLanding: ({ countries, onOpen }: LandingVariantProps) => <section aria-label="Postcard preview"><button onClick={() => onOpen(countries[0])}>Open chosen country</button></section>
}));
vi.mock("../../apps/web/src/features/landingVariants/atlas/AtlasLanding", () => ({
  AtlasLanding: () => <section aria-label="Atlas preview" />
}));
vi.mock("../../apps/web/src/features/landingVariants/cinematic/CinematicLanding", () => ({
  CinematicLanding: () => <section aria-label="Cinema preview" />
}));

vi.mock("../../apps/web/src/features/landingVariants/horizon/HorizonLanding", () => ({
  HorizonLanding: () => <section aria-label="Horizon preview" />,
  HorizonLandingTwo: () => <section aria-label="Horizon 2 preview" />
}));

const countries = [{ code: "JP", displayCode: "JP", name: "Japan", slug: "japan" }];

function setup(path = "/") {
  const onOpen = vi.fn();
  render(<MemoryRouter initialEntries={[path]}><LandingVariantPreview countries={countries} countryPacks={{}} onOpen={onOpen} onConfigure={vi.fn()} /></MemoryRouter>);
  return { onOpen };
}

describe("landing design comparison", () => {
  afterEach(cleanup);

  it("opens the selected Horizon 2 design on the homepage without comparison tabs", async () => {
    setup();
    expect(await screen.findByRole("region", { name: "Horizon 2 preview" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Compare landing designs" })).toBeNull();
  });

  it("loads a directly linked direction and switches between independent previews", async () => {
    setup("/?landing=cinematic");
    expect(await screen.findByRole("region", { name: "Cinema preview" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Cinematic Travel/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Immersive Atlas/ }));
    expect(await screen.findByRole("region", { name: "Atlas preview" })).not.toBeNull();
    expect(screen.queryByRole("region", { name: "Cinema preview" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Postcard Desk/ }));
    expect(await screen.findByRole("region", { name: "Postcard preview" })).not.toBeNull();
  });

  it("falls back safely for an unknown direction and passes explicit country selection through", async () => {
    const { onOpen } = setup("/?landing=unknown");
    expect(await screen.findByRole("region", { name: "Horizon 2 preview" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Postcard Desk/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Open chosen country" }));
    expect(onOpen).toHaveBeenCalledWith(countries[0]);
    expect(resolveLandingVariant(null)).toBe("horizon2");
    expect(resolveLandingVariant("unknown")).toBe("horizon2");
  });
});
