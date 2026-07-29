// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerViewport } from "../../apps/web/src/features/explorer/ExplorerViewport";
import { explorerChromeBridge } from "../../apps/web/src/features/explorer/explorerChromeBridge";

afterEach(() => {
  cleanup();
  act(() => explorerChromeBridge.clear());
});

describe("ExplorerViewport", () => {
  it("renders typed explorer chrome state and invokes direct commands", () => {
    const commands = {
      back: vi.fn(),
      countries: vi.fn()
    };
    const { container } = render(<ExplorerViewport />);

    act(() => {
      explorerChromeBridge.publish({
        backDisabled: false,
        breadcrumb: "Marina Bay · Ready",
        commands,
        isBusy: true,
        isVisible: true,
        title: "Marina Bay"
      });
    });

    const viewport = screen.getByLabelText(
      "RoamAtlas visual explorer"
    );
    expect(viewport.classList.contains("is-hidden")).toBe(false);
    expect(viewport.classList.contains("is-busy")).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Marina Bay" })
    ).toBeTruthy();
    expect(screen.getByText("Marina Bay · Ready")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Countries" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Back" })
    );

    expect(commands.countries).toHaveBeenCalledTimes(1);
    expect(commands.back).toHaveBeenCalledTimes(1);
    expect(container.querySelector("#scroll-stage")).toBeTruthy();
  });

  it("hides the explorer and disables back from published state", () => {
    render(<ExplorerViewport />);

    act(() => {
      explorerChromeBridge.publish({
        backDisabled: true,
        breadcrumb: "Curated scene",
        commands: {
          back: vi.fn(),
          countries: vi.fn()
        },
        isBusy: false,
        isVisible: false,
        title: "Country Overview Scroll"
      });
    });

    expect(
      screen
        .getByLabelText("RoamAtlas visual explorer")
        .classList.contains("is-hidden")
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Back"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
