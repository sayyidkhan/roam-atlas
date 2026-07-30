// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerDetailSheet } from "../../apps/web/src/features/explorer/ExplorerDetailSheet";
import { explorerDetailStore } from "../../apps/web/src/features/explorer/explorerDetailStore";

afterEach(() => {
  cleanup();
  act(() => explorerDetailStore.getState().clear());
});

describe("ExplorerDetailSheet", () => {
  it("renders structured facts and direct detail commands", () => {
    const commands = {
      close: vi.fn(),
      collapse: vi.fn(),
      expand: vi.fn()
    };
    render(<ExplorerDetailSheet />);

    act(() => {
      explorerDetailStore.getState().setSnapshot({
        commands,
        detailOverride: null,
        mode: "expanded",
        node: {
          title: "Gardens by the Bay",
          type: "attraction",
          facts: [
            {
              confidence: "confirmed",
              text: "A curated fact.",
              sourceUrl: "https://example.com/source"
            }
          ]
        }
      });
    });

    expect(screen.getByText("A curated fact.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Source" })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse detail" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close detail" })
    );
    expect(commands.collapse).toHaveBeenCalledTimes(1);
    expect(commands.close).toHaveBeenCalledTimes(1);
  });

  it("renders detours as text and rejects unsafe source links", () => {
    render(<ExplorerDetailSheet />);

    act(() => {
      explorerDetailStore.getState().setSnapshot({
        commands: {
          close: vi.fn(),
          collapse: vi.fn(),
          expand: vi.fn()
        },
        detailOverride: {
          confidence: "unconfirmed",
          title: "<Unmapped>",
          message: "AI-imagined detour"
        },
        mode: "expanded",
        node: {
          title: "Ignored",
          facts: [
            {
              text: "Ignored",
              sourceUrl: "javascript:alert(1)"
            }
          ]
        }
      });
    });

    expect(screen.getByText("<Unmapped>")).toBeTruthy();
    expect(document.querySelector("unmapped")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
