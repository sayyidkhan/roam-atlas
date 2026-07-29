// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftTree } from "../../apps/web/src/features/countryDraft/CountryDraftTree";

afterEach(cleanup);

describe("CountryDraftTree", () => {
  it("renders factual boundaries and invokes typed nested-node commands", () => {
    const commands = createCommands();
    const onToggleGenAi = vi.fn();
    const { container } = render(
      <CountryDraftTree
        activeSection="regions"
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countrySlug="singapore"
        draft={{
          countryName: "Singapore",
          regions: [
            {
              name: "North Coast",
              kind: "region",
              confidence: "unconfirmed",
              why: "Candidate coastal chapter",
              sourceUrl: "javascript:alert(1)",
              children: [
                {
                  name: "<Unsafe candidate>",
                  kind: "attraction",
                  confidence: "unconfirmed"
                }
              ]
            }
          ],
          themes: []
        }}
        onToggleGenAi={onToggleGenAi}
        openGenAiTarget={null}
      />
    );

    expect(screen.getByText("<Unsafe candidate>")).toBeTruthy();
    expect(container.querySelector("unsafe")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(
      container.querySelector("[data-draft-place-photo]")
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Approve North Coast"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit unconfirmed candidate <Unsafe candidate>"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete <Unsafe candidate> from starter map"
      })
    );

    expect(commands.approveItem).toHaveBeenCalledWith(
      "region:North Coast",
      true
    );
    expect(commands.editCandidate).toHaveBeenCalledWith("1.1");
    expect(commands.deleteItem).toHaveBeenCalledWith({
      list: "node",
      path: "1.1",
      label: "<Unsafe candidate>"
    });
  });

  it("opens candidate GenAI editing through the direct React command", () => {
    const commands = createCommands();
    const onToggleGenAi = vi.fn();
    render(
      <CountryDraftTree
        activeSection="regions"
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countrySlug="singapore"
        draft={{
          countryName: "Singapore",
          regions: [{ name: "Central", children: [] }],
          themes: []
        }}
        onToggleGenAi={onToggleGenAi}
        openGenAiTarget="region:Central"
      />
    );

    const button = screen.getByRole("button", {
      name: "Edit Central with GenAI"
    });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(button);
    expect(onToggleGenAi).toHaveBeenCalledWith(
      "region:Central"
    );
  });

  it("renders themes as a separate typed tree", () => {
    const onToggleGenAi = vi.fn();
    render(
      <CountryDraftTree
        activeSection="themes"
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={createCommands()}
        countrySlug="singapore"
        draft={{
          countryName: "Singapore",
          regions: [],
          themes: [
            {
              label: "Wildlife",
              note: "Research lens only",
              confidence: "unconfirmed",
              sourceUrl: "https://example.com/source"
            }
          ]
        }}
        onToggleGenAi={onToggleGenAi}
        openGenAiTarget={null}
      />
    );

    expect(screen.getAllByText("Wildlife").length).toBeGreaterThan(0);
    expect(screen.getByText("Research lens only")).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "https://example.com/source"
      })
    ).toBeTruthy();
  });

  it("delegates top-level reorder gestures through the drag hook", () => {
    const commands = createCommands();
    const onToggleGenAi = vi.fn();
    render(
      <CountryDraftTree
        activeSection="regions"
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countrySlug="singapore"
        draft={{
          countryName: "Singapore",
          regions: [
            { name: "Central" },
            { name: "North" }
          ],
          themes: []
        }}
        onToggleGenAi={onToggleGenAi}
        openGenAiTarget={null}
      />
    );
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn()
    };
    const firstHandle = screen.getByRole("button", {
      name: "Drag to reorder Central"
    });
    const northRow = screen
      .getByText("North")
      .closest<HTMLLIElement>(".draft-item");
    expect(northRow).toBeTruthy();
    vi.spyOn(northRow!, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    fireEvent.dragStart(firstHandle, {
      dataTransfer: transfer
    });
    fireEvent.dragOver(northRow!, {
      clientY: 75,
      dataTransfer: transfer
    });
    fireEvent.drop(northRow!, {
      clientY: 75,
      dataTransfer: transfer
    });

    expect(commands.reorderItems).toHaveBeenCalledWith({
      list: "regions",
      fromIndex: 0,
      targetIndex: 1,
      insertAfter: false
    });
  });
});

function createCommands() {
  return {
    approveItem: vi.fn(),
    confirmForCuration: vi.fn(),
    deleteItem: vi.fn(),
    editCandidate: vi.fn(),
    openReferencePhoto: vi.fn(),
    rebuildMetadata: vi.fn(),
    reorderItems: vi.fn(),
    resetReferencePhotos: vi.fn(),
    submitGenAi: vi.fn()
  };
}
