// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExplorerNavigationFeedback } from "../../apps/web/src/features/explorer/ExplorerNavigationFeedback";
import { explorerFeedbackStore } from "../../apps/web/src/features/explorer/explorerFeedbackStore";
import { createExplorerFeedbackController } from "../../apps/web/src/features/explorer/explorerFeedbackController";

afterEach(() => {
  cleanup();
  act(() => explorerFeedbackStore.getState().clear());
});

describe("ExplorerNavigationFeedback", () => {
  it("renders structured loading progress published by its controller", () => {
    const controller = createExplorerFeedbackController({
      buildLoadingStepTrail: () => ({
        current: {
          detail: "Using curated visual direction.",
          message: "Drawing Marina Bay",
          phase: "generating"
        },
        steps: [
          { label: "Queued", state: "done" },
          { label: "Drawing illustration", state: "active" }
        ]
      }),
      state: {
        experienceConfig: {
          showLoadingSteps: true
        }
      },
      transientStatusDurationMs: 4_000
    });
    render(<ExplorerNavigationFeedback />);

    act(() => {
      controller.renderLoadingPanel({
        pageTitle: "Marina Bay"
      });
    });

    expect(
      screen.getByText("Drawing Marina Bay")
    ).toBeTruthy();
    expect(
      screen.getByText("Using curated visual direction.")
    ).toBeTruthy();
    expect(
      document.querySelector(
        ".loading-panel-progress--indeterminate"
      )
    ).toBeTruthy();
  });

  it("renders transient status as text without HTML injection", () => {
    const controller = createExplorerFeedbackController({
      buildLoadingStepTrail: () => ({
        current: {
          detail: "",
          message: "",
          phase: "starting"
        },
        steps: []
      }),
      state: {
        experienceConfig: {
          showLoadingSteps: false
        }
      },
      transientStatusDurationMs: 4_000
    });
    render(<ExplorerNavigationFeedback />);

    act(() => {
      controller.renderLoadingPanel({
        fallbackMessage: "<strong>Exploring</strong>"
      });
    });

    expect(
      screen.getByText("<strong>Exploring</strong>")
    ).toBeTruthy();
    expect(document.querySelector("strong")).toBeNull();
  });
});
