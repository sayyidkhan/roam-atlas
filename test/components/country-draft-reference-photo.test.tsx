// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDraftReferencePhoto } from "../../apps/web/src/features/countryDraft/CountryDraftReferencePhoto";
import { DraftReferencePhotoRegistry } from "../../apps/web/src/features/countryDraft/draftReferencePhotoRegistry";

afterEach(cleanup);

describe("CountryDraftReferencePhoto", () => {
  it("owns image readiness and duplicate handling in React", () => {
    const openPhoto = vi.fn();
    const buildUrl = vi.fn(() => "/reference.jpg");
    const { container } = render(
      <DraftReferencePhotoRegistry>
        <CountryDraftReferencePhoto
          buildUrl={buildUrl}
          kind="region"
          onOpen={openPhoto}
          placeName="Marina Bay"
        />
        <CountryDraftReferencePhoto
          buildUrl={buildUrl}
          kind="region"
          onOpen={openPhoto}
          placeName="Civic District"
        />
      </DraftReferencePhotoRegistry>
    );

    const images = [
      ...container.querySelectorAll<HTMLImageElement>(
        ".draft-item-photo"
      )
    ];
    fireEvent.load(images[0]!);
    fireEvent.load(images[1]!);

    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("Duplicate")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reference photo for Marina Bay: Ready"
      })
    );
    expect(openPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "region",
        placeName: "Marina Bay"
      })
    );
  });
});
