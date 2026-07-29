// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { DraftPhotoLightbox } from "../../apps/web/src/features/placeImages/DraftPhotoLightbox";
import { draftPhotoLightboxBridge } from "../../apps/web/src/features/placeImages/draftPhotoLightboxBridge";
import { createDraftPhotoLightboxController } from "../../apps/web/src/features/placeImages/draftPhotoLightboxController";
import { createPlaceImageSessionStore } from "../../apps/web/src/features/placeImages/placeImageSessionStore";

afterEach(() => {
  act(() => draftPhotoLightboxBridge.clear());
  cleanup();
  vi.restoreAllMocks();
});

describe("DraftPhotoLightbox", () => {
  it("keeps the external image explicitly separate from travel facts", () => {
    const { controller } = createFixture();
    controller.openDraftPhotoLightbox({
      context: "waterfront skyline",
      kind: "region",
      placeName: "Marina Bay",
      src: "/reference.jpg"
    });

    render(<DraftPhotoLightbox />);

    expect(
      screen.getByText(
        "Reference photo from external search. Not verified travel data."
      )
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Find a better photo"
      })
    );
    expect(
      screen.getByText(
        /does not change travel facts/
      )
    ).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reviews saved history through typed commands", async () => {
    const { controller, requests } = createFixture({
      history: [
        {
          active: true,
          id: "current",
          imageUrl: "/current.jpg"
        },
        {
          id: "saved",
          imageUrl: "/saved.jpg"
        }
      ]
    });
    controller.openDraftPhotoLightbox({
      placeName: "Marina Bay",
      src: "/reference.jpg"
    });

    render(<DraftPhotoLightbox />);

    await screen.findByText("Current 1 of 2");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show next saved photo"
      })
    );
    expect(screen.getByText("Saved 2 of 2")).toBeTruthy();
    expect(
      document
        .querySelector(".draft-photo-lightbox-image")
        ?.getAttribute("src")
    ).toContain("/saved.jpg?history=saved&view=test-session");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Keep this photo"
      })
    );
    await waitFor(() =>
      expect(requests.selectHistory).toHaveBeenCalledWith(
        { code: "SG", name: "Singapore", slug: "singapore" },
        "Marina Bay",
        "saved"
      )
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull()
    );
  });

  it("renders prompt suggestions as React text, not injected markup", async () => {
    const { controller, requests } = createFixture();
    requests.suggestPrompts.mockResolvedValue({
      source: "llm",
      suggestions: [
        "Show <strong>the real waterfront</strong>"
      ]
    });
    controller.openDraftPhotoLightbox({
      placeName: "Marina Bay",
      src: "/reference.jpg"
    });
    render(<DraftPhotoLightbox />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Find a better photo"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Suggest prompts"
      })
    );

    expect(
      await screen.findByRole("button", {
        name: "Show <strong>the real waterfront</strong>"
      })
    ).toBeTruthy();
    expect(document.querySelector("strong")).toBeNull();
  });
});

function createFixture({
  history = []
}: {
  history?: Array<{
    active?: boolean;
    id: string;
    imageUrl: string;
  }>;
} = {}) {
  const requests = {
    deleteHistory: vi.fn().mockResolvedValue({ items: history }),
    feedback: vi.fn().mockResolvedValue(true),
    reset: vi.fn().mockResolvedValue(true),
    selectHistory: vi.fn().mockResolvedValue(true),
    suggestPrompts: vi.fn().mockResolvedValue({
      source: "curated-fallback" as const,
      suggestions: []
    })
  };
  const controller = createDraftPhotoLightboxController({
    APP_CONFIG: {
      placeImages: { feedbackMaxLength: 400 }
    },
    PLACE_IMAGE_REQUEST_SESSION: "test-session",
    getSelectedCountry: () => ({
      code: "SG",
      name: "Singapore",
      slug: "singapore"
    }),
    placeImageClient: {
      loadHistory: vi.fn().mockResolvedValue({ items: history })
    },
    placeImageSessionStore: createPlaceImageSessionStore(),
    render: vi.fn(),
    requestPlaceImageFeedback: requests.feedback,
    requestPlaceImageHistoryDelete: requests.deleteHistory,
    requestPlaceImageHistorySelection: requests.selectHistory,
    requestPlaceImagePromptSuggestions: requests.suggestPrompts,
    requestPlaceImageReset: requests.reset
  });
  return { controller, requests };
}
