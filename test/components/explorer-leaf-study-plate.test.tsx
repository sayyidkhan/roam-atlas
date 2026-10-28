// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerLeafStudyPlate } from "../../apps/web/src/features/explorer/ExplorerLeafStudyPlate";
import { explorerDetailStore } from "../../apps/web/src/features/explorer/explorerDetailStore";
import { requestLeafStudyNotes } from "../../apps/web/src/features/explorer/leafStudyClient";

vi.mock("../../apps/web/src/features/explorer/leafStudyClient", () => ({
  readExplorerCountrySlug: () => "singapore",
  requestLeafStudyNotes: vi.fn()
}));

afterEach(() => {
  cleanup();
  explorerDetailStore.getState().clear();
  vi.clearAllMocks();
});

function showPlace(id: string, text: string) {
  act(() => explorerDetailStore.getState().setSnapshot({
    commands: { close: vi.fn(), collapse: vi.fn(), expand: vi.fn() },
    detailOverride: null, mode: "hidden",
    node: {
      id, title: "Merlion Park", childIds: [],
      facts: [{ id, text, confidence: "confirmed", sourceUrl: "https://example.test/merlion" }]
    }
  }));
}

describe("visitor-facing study captions", () => {
  it("falls back to the place description when a stale response contains internal copy", async () => {
    vi.mocked(requestLeafStudyNotes).mockResolvedValue([{
      id: "stale-note", text: "Merlion Park appears in the Marina Bay demo path. Its waterfront setting is illustrated here."
    }]);
    showPlace("stale-note", "Merlion Park is a photo stop in the Marina Bay chapter.");
    await act(async () => { render(<ExplorerLeafStudyPlate />); });
    await waitFor(() => expect(requestLeafStudyNotes).toHaveBeenCalledOnce());
    expect(screen.getByText("Merlion Park is a photo stop in the Marina Bay chapter.")).toBeTruthy();
    expect(screen.queryByText(/demo path/)).toBeNull();
    expect(screen.getByRole("link", { name: "Source" })).toBeTruthy();
  });

  it("invalidates a note when its source description changes, preserving AI attribution", async () => {
    vi.mocked(requestLeafStudyNotes)
      .mockResolvedValueOnce([{ id: "updated-note", text: "An earlier illustrated note about Merlion Park." }])
      .mockResolvedValueOnce([{ id: "updated-note", text: "A revised illustrated note about Merlion Park." }]);
    showPlace("updated-note", "The earlier place description.");
    render(<ExplorerLeafStudyPlate />);
    await screen.findByText("An earlier illustrated note about Merlion Park.");
    showPlace("updated-note", "The updated place description.");
    await screen.findByText("A revised illustrated note about Merlion Park.");
    expect(requestLeafStudyNotes).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("An earlier illustrated note about Merlion Park.")).toBeNull();
    expect(screen.getByText("AI note")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Source" })).toBeTruthy();
  });
});
