// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationShell } from "../../apps/web/src/app/ApplicationShell";

describe("ApplicationShell", () => {
  it("renders the React-owned explorer stage and detail surfaces", () => {
    const { container } = render(<ApplicationShell />);

    expect(screen.getByLabelText("Country overview")).toBeTruthy();
    expect(screen.getByLabelText("RoamAtlas visual explorer")).toBeTruthy();
    expect(container.querySelector("#country-landing")).toBeNull();
    expect(container.querySelector("#country-grid")).toBeNull();
    expect(container.querySelector("#scroll-stage")).toBeTruthy();
    expect(
      container.querySelector("#scene-render-root")
    ).toBeNull();
    expect(
      screen.getByLabelText("Selected detail")
    ).toBeTruthy();
    expect(container.querySelector("#node-detail")).toBeNull();
  });
});
