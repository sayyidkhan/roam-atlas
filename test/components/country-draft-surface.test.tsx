// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftSurface } from "../../apps/web/src/features/countryDraft/CountryDraftSurface";
import type { CountryDraft } from "../../apps/web/src/features/countryDraft/countryDraftTypes";

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

  it("opens confirmed snapshots in the same editable contents with no mode switch", () => {
    render(
      <CountryDraftSurface
        compact
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Singapore"
        countrySlug="singapore"
        draft={readyDraft([{ name: "Central", confidence: "confirmed" }], {
          mode: "curated_pack_snapshot",
          confidence: "confirmed",
          reviewChecklist: ["Check current official sources."]
        })}
        isSourceControlled
      />
    );

    const regions = screen.getByRole("tab", { name: "Candidate regions (1)" });
    expect(regions.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Open starter-map actions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unapprove Central" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit & review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "← Back to contents" })).toBeNull();
    expect(screen.getByRole("link", { name: "Where this info comes from" })).toBeTruthy();
    expect(screen.queryByText("Curated data")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit starter map with GenAI" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close GenAI edit modal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Unapprove Central" })).toBeTruthy();

    const themes = screen.getByRole("tab", { name: "Research themes (0)" });
    fireEvent.keyDown(regions, { key: "End" });
    expect(document.activeElement).toBe(themes);
    expect(themes.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").id).toBe(themes.getAttribute("aria-controls"));
    fireEvent.keyDown(themes, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(regions);
    expect(screen.getByRole("button", { name: "Unapprove Central" })).toBeTruthy();
  });

  it.each([
    { mode: "curated_pack_snapshot", confidence: "unconfirmed" },
    { mode: "ai_generated", confidence: "unconfirmed" }
  ])("keeps review controls visible for compact $mode previews", (metadata) => {
    render(
      <CountryDraftSurface
        compact
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Singapore"
        countrySlug="singapore"
        draft={readyDraft([{ name: "Central" }], metadata)}
        isSourceControlled
      />
    );

    expect(screen.getByRole("button", { name: "Open starter-map actions" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit & review" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Saved travel information" })).toBeNull();
  });

  it("retains curation gates and tools for compact unregistered drafts", () => {
    render(
      <CountryDraftSurface
        compact
        buildPhotoUrl={vi.fn(() => "/reference.jpg")}
        commands={commands}
        countryName="Iceland"
        countrySlug="iceland"
        draft={readyDraft([{ name: "Central" }])}
        isSourceControlled={false}
      />
    );

    expect(screen.getByRole("button", { name: "Confirm for curation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open starter-map actions" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit & review" })).toBeNull();
  });
});

function readyDraft(regions: CountryDraft["regions"], overrides: Partial<CountryDraft> = {}) {
  return {
    status: "ready" as const,
    draft: {
      countryName: "Singapore",
      summary: "Review this starter direction.",
      regions,
      themes: [],
      ...overrides
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
