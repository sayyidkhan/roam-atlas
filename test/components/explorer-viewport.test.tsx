// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerViewport } from "../../apps/web/src/features/explorer/ExplorerViewport";
import { explorerChromeStore } from "../../apps/web/src/features/explorer/explorerChromeStore";
import { explorerDetailStore } from "../../apps/web/src/features/explorer/explorerDetailStore";

afterEach(() => {
  cleanup();
  act(() => explorerChromeStore.getState().clear());
  act(() => explorerDetailStore.getState().clear());
});

describe("ExplorerViewport", () => {
  it("renders typed explorer chrome state and invokes direct commands", () => {
    const openBreadcrumb = vi.fn();
    const commands = {
      back: vi.fn(),
      countries: vi.fn()
    };
    const { container } = render(<ExplorerViewport />);

    act(() => {
      explorerChromeStore.getState().setSnapshot({
        backDisabled: false,
        breadcrumbs: [
          { label: "Singapore", nodeId: "singapore" }
        ],
        commands: {
          ...commands,
          openBreadcrumb
        },
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
    expect(
      screen.getByRole("navigation", {
        name: "Explorer breadcrumb"
      })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("heading", { name: "Marina Bay" })
        .closest("[aria-current='page']")
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Go to Singapore"
      })
    );
    expect(openBreadcrumb).toHaveBeenCalledWith("singapore");
    const navigation = screen.getByRole("navigation", {
      name: "Explorer navigation"
    });
    expect(
      within(navigation)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Back", "Countries"]);
    expect(
      screen.getByLabelText("Current explorer location")
    ).toBeTruthy();

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

  it("hides the explorer and reflects disabled back state", () => {
    render(<ExplorerViewport />);

    act(() => {
      explorerChromeStore.getState().setSnapshot({
        backDisabled: true,
        breadcrumbs: [],
        commands: {
          back: vi.fn(),
          countries: vi.fn(),
          openBreadcrumb: vi.fn()
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

  it("shows the brand above a clean root breadcrumb", () => {
    render(<ExplorerViewport />);

    act(() => {
      explorerChromeStore.getState().setSnapshot({
        backDisabled: false,
        breadcrumbs: [],
        commands: {
          back: vi.fn(),
          countries: vi.fn(),
          openBreadcrumb: vi.fn()
        },
        isBusy: false,
        isVisible: true,
        title: "Singapore"
      });
    });

    const location = screen.getByLabelText(
      "Current explorer location"
    );
    expect(within(location).getByRole("heading").textContent).toBe(
      "Singapore"
    );
    expect(within(location).getByText("RoamAtlas")).toBeTruthy();
    expect(
      within(location)
        .getByRole("navigation", { name: "Explorer breadcrumb" })
        .textContent
    ).toBe("Singapore");
    expect(
      (screen.getByRole("button", { name: "Back" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it("keeps a persistent facts toggle inside the location header", () => {
    const detailCommands = {
      close: vi.fn(),
      collapse: vi.fn(),
      expand: vi.fn()
    };
    render(<ExplorerViewport />);

    act(() => {
      explorerDetailStore.getState().setSnapshot({
        commands: detailCommands,
        detailOverride: null,
        mode: "compact",
        node: {
          title: "Marina Bay and Civic District",
          type: "district"
        }
      });
    });

    const locationHeader = screen.getByLabelText(
      "Current explorer location"
    );
    const actions = within(locationHeader).getByLabelText(
      "Actions for Marina Bay and Civic District"
    );

    fireEvent.click(
      within(actions).getByRole("button", {
        name: "Show facts for Marina Bay and Civic District"
      })
    );

    expect(detailCommands.expand).toHaveBeenCalledTimes(1);
    act(() => {
      explorerDetailStore.getState().setSnapshot({
        commands: detailCommands,
        detailOverride: null,
        mode: "expanded",
        node: {
          title: "Marina Bay and Civic District",
          type: "district"
        }
      });
    });
    const hideFacts = within(locationHeader).getByRole("button", {
      name: "Hide facts for Marina Bay and Civic District"
    });
    expect(hideFacts.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(hideFacts);
    expect(detailCommands.collapse).toHaveBeenCalledTimes(1);
    act(() => {
      explorerDetailStore.getState().setSnapshot({
        commands: detailCommands,
        detailOverride: null,
        mode: "compact",
        node: {
          title: "Marina Bay and Civic District",
          type: "district"
        }
      });
    });
    expect(
      within(locationHeader)
        .getByRole("button", {
          name: "Show facts for Marina Bay and Civic District"
        })
        .getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      document.querySelector(".detail-sheet.is-open")
    ).toBeNull();
  });
});
