// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftSurface } from "../../apps/web/src/features/countryDraft/CountryDraftSurface";

afterEach(cleanup);

describe("CountryDraftSurface", () => {
  const commands = {
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

  it("labels an unconfigured country outline as unconfirmed", () => {
    render(
      <CountryDraftSurface
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Iceland"
        countrySlug="iceland"
        draft={{ status: "empty" }}
        isSourceControlled={false}
      />
    );

    expect(
      screen.getByText(
        /It will not be treated as a verified country pack/
      )
    ).toBeTruthy();
  });

  it("keeps a failed generation state factual and actionable", () => {
    render(
      <CountryDraftSurface
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Singapore"
        countrySlug="singapore"
        draft={{
          status: "failed",
          error: "Draft provider unavailable."
        }}
        isSourceControlled
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Could not build a starter map"
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Draft provider unavailable.")
    ).toBeTruthy();
  });

  it("owns ready-state tabs and starter-map tools as React controls", () => {
    render(
      <CountryDraftSurface
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Singapore"
        countrySlug="singapore"
        draft={{
          status: "ready",
          draft: {
            countryName: "Singapore",
            summary: "Review this grounded starter direction.",
            regions: [{ name: "Central" }],
            themes: [{ label: "Culture" }]
          },
          isBusy: false,
          editor: {
            isSending: false,
            messages: []
          },
          review: {
            confirmation: null,
            error: null,
            isConfirming: false
          }
        }}
        isSourceControlled
      />
    );

    fireEvent.click(
      screen.getByRole("tab", {
        name: "Research themes (1)"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open starter-map actions"
      })
    );
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: /Rebuild starter info/
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit starter map with GenAI"
      })
    );

    expect(
      screen
        .getByRole("tab", {
          name: "Research themes (1)"
        })
        .getAttribute("aria-selected")
    ).toBe("true");
    expect(commands.rebuildMetadata).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("menu", {
        name: "Starter-map actions"
      })
    ).toBeNull();
    expect(
      screen.getByRole("dialog", {
        name: "Edit starter map with GenAI"
      })
    ).toBeTruthy();
    expect(screen.getAllByText("Culture").length).toBeGreaterThan(
      0
    );
  });

  it("closes a candidate dialog when that target leaves the current draft", () => {
    const { rerender } = render(
      <CountryDraftSurface
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Singapore"
        countrySlug="singapore"
        draft={readyDraft([{ name: "Central" }])}
        isSourceControlled
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit Central with GenAI"
      })
    );
    expect(
      screen.getByRole("dialog", {
        name: "Edit Central with GenAI"
      })
    ).toBeTruthy();

    rerender(
      <CountryDraftSurface
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Singapore"
        countrySlug="singapore"
        draft={readyDraft([])}
        isSourceControlled
      />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function readyDraft(regions: Array<{ name: string }>) {
  return {
    status: "ready" as const,
    draft: {
      countryName: "Singapore",
      summary: "Review this starter direction.",
      regions,
      themes: []
    },
    isBusy: false,
    editor: {
      isSending: false,
      messages: []
    },
    review: {
      confirmation: null,
      error: null,
      isConfirming: false
    }
  };
}
