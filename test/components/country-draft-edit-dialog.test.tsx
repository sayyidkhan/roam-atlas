// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftEditDialog } from "../../apps/web/src/features/countryDraft/CountryDraftEditDialog";

afterEach(cleanup);

const draft = {
  countryName: "Singapore",
  summary: "Candidate map",
  regions: [{ name: "North Coast" }],
  themes: [{ label: "Wildlife" }]
};

describe("CountryDraftEditDialog", () => {
  it("submits a trimmed starter-map instruction through the typed command", () => {
    const onSubmit = vi.fn();
    render(
      <CountryDraftEditDialog
        draft={draft}
        isSending={false}
        messages={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        target="starter-map"
      />
    );

    const input = screen.getByRole("textbox");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, {
      target: { value: "  Focus on food and nature.  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "starter-map",
      "Focus on food and nature."
    );
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("only shows messages scoped to the selected candidate as text", () => {
    render(
      <CountryDraftEditDialog
        draft={draft}
        isSending={false}
        messages={[
          {
            role: "assistant",
            status: "done",
            target: "region:North Coast",
            text: "<Unsafe markup>"
          },
          {
            role: "user",
            target: "theme:Wildlife",
            text: "More habitats"
          }
        ]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        target="region:North Coast"
      />
    );

    expect(screen.getByText("<Unsafe markup>")).toBeTruthy();
    expect(screen.queryByText("More habitats")).toBeNull();
    expect(document.querySelector("unsafe")).toBeNull();
  });

  it("does not open for a target outside the curated draft", () => {
    const { container } = render(
      <CountryDraftEditDialog
        draft={draft}
        isSending={false}
        messages={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        target="region:Unknown"
      />
    );

    expect(container.childElementCount).toBe(0);
  });
});
