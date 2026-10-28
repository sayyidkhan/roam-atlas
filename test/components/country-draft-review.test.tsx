// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftReview } from "../../apps/web/src/features/countryDraft/CountryDraftReview";

afterEach(cleanup);

describe("CountryDraftReview", () => {
  it("keeps source-review guidance separate from confirmation", () => {
    const onConfirm = vi.fn();
    render(
      <CountryDraftReview
        confirmation={null}
        confirmationError={null}
        countryName="Example"
        draft={{
          mode: "ai_generated",
          confidence: "unconfirmed",
          reviewChecklist: [
            "Check official <source>",
            "",
            "Review scope"
          ]
        }}
        isConfirming={false}
        isSourceControlled={false}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Check official <source>")).toBeTruthy();
    expect(screen.getByText("Review scope")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm for curation"
      })
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("exposes artifacts only after explicit confirmation", () => {
    render(
      <CountryDraftReview
        confirmation={{
          paths: {
            confirmationUrl: "/runtime/confirmation.json",
            countryPackDraftUrl: "/runtime/country-pack.json"
          }
        }}
        confirmationError={null}
        countryName="Example"
        draft={{
          mode: "ai_generated",
          confidence: "unconfirmed"
        }}
        isConfirming={false}
        isSourceControlled={false}
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Confirmed for curation"
      })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "country pack draft" })
        .getAttribute("href")
    ).toBe("/runtime/country-pack.json");
  });

  it("identifies a confirmed source-controlled snapshot", () => {
    render(
      <CountryDraftReview
        confirmation={null}
        confirmationError={null}
        countryName="Singapore"
        draft={{
          mode: "curated_pack_snapshot",
          confidence: "confirmed"
        }}
        isConfirming={false}
        isSourceControlled
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Saved travel information"
      })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Confirm for curation"
      })
    ).toBeNull();
  });

  it("uses a plain-language link and separates travel information from AI pictures", () => {
    render(
      <CountryDraftReview
        collapseChecklist
        confirmation={null}
        confirmationError={null}
        countryName="Singapore"
        draft={{
          summary: "Country pack overview",
          mode: "curated_pack_snapshot",
          confidence: "confirmed",
          reviewChecklist: ["Review official sources before adding claims."]
        }}
        isConfirming={false}
        isSourceControlled
        onConfirm={vi.fn()}
      />
    );
    const trigger = screen.getByRole("link", { name: "Where this info comes from" });
    expect(screen.queryByText("Curated data")).toBeNull();
    expect(screen.queryByText("Source reviewed")).toBeNull();
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute("open", ""));
    trigger.focus();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Country pack overview")).toBeTruthy();
    expect(screen.getByText(/These come from travel information saved in RoamAtlas/)).toBeTruthy();
    expect(screen.getByText(/A picture can contain imagined details/)).toBeTruthy();
    expect(screen.getByText(/“Confirmed” means backed by an official source or a RoamAtlas reference/)).toBeTruthy();
    expect(screen.getByText(/It does not mean the details were checked recently/)).toBeTruthy();
    expect(screen.getByText(/Check the venue’s official website for current details/)).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "About the travel info" })).toBeTruthy();
    const maintenance = screen.getByText("Maintaining this atlas").closest("details");
    expect(maintenance?.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByText("Maintaining this atlas"));
    expect(screen.getByText("Review official sources before adding claims.")).toBeTruthy();
    dialog.removeAttribute("open");
    fireEvent(dialog, new Event("close"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("button", { name: "Confirm for curation" })).toBeNull();
  });

  it.each([
    { confidence: "confirmed", isSourceControlled: false },
    { confidence: "unconfirmed", isSourceControlled: true },
    { confidence: "unconfirmed", isSourceControlled: false },
    { confidence: "likely", isSourceControlled: true },
    { confidence: "general", isSourceControlled: true },
    { confidence: undefined, isSourceControlled: true },
    { confidence: "unknown", isSourceControlled: true }
  ])(
    "keeps $confidence snapshots explicit about source review when registered=$isSourceControlled",
    ({ confidence, isSourceControlled }) => {
      render(
        <CountryDraftReview
          confirmation={null}
          confirmationError={null}
          countryName="Example"
          collapseChecklist
          draft={{ mode: "curated_pack_snapshot", confidence }}
          isConfirming={false}
          isSourceControlled={isSourceControlled}
          onConfirm={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", { name: "Needs source review" })
      ).toBeTruthy();
      expect(
        screen.getByText(/Keep its travel claims unconfirmed/)
      ).toBeTruthy();
      expect(
        screen.queryByRole("heading", {
          name: "Saved travel information"
        })
      ).toBeNull();
      expect(screen.queryByRole("link", { name: "Where this info comes from" })).toBeNull();
    }
  );

  it("keeps edits to a source-controlled pack labeled preview only", () => {
    render(
      <CountryDraftReview
        confirmation={null}
        confirmationError={null}
        countryName="Singapore"
        draft={{ mode: "ai_generated", confidence: "confirmed" }}
        isConfirming={false}
        isSourceControlled
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Preview only" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Saved travel information"
      })
    ).toBeNull();
  });
});
