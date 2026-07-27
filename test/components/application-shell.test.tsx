// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationShell } from "../../src/app/ApplicationShell";

describe("ApplicationShell", () => {
  it("provides accessible mount points for each migrating frontend feature", () => {
    const { container } = render(<ApplicationShell />);

    expect(screen.getByRole("heading", { name: "Choose a country" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search countries" })).toBeTruthy();
    expect(screen.getByLabelText("Country cards")).toBeTruthy();
    expect(screen.getByLabelText("Country overview")).toBeTruthy();
    expect(screen.getByLabelText("RoamAtlas visual explorer")).toBeTruthy();
    expect(container.querySelector("#scroll-stage")).toBeTruthy();
    expect(container.querySelector("#node-detail")).toBeTruthy();
  });
});
