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
        name: "Source-reviewed country pack"
      })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Confirm for curation"
      })
    ).toBeNull();
  });
});
