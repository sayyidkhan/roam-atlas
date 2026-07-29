import { explorerFeedbackBridge } from "./explorerFeedbackBridge";

export type LoadingJob = {
  status: string;
};

export type LoadingPanelOptions = {
  fallbackMessage?: string;
  job?: LoadingJob | null;
  pageTitle?: string;
};

type LoadingTrail = {
  current: {
    detail: string;
    message: string;
    phase: string;
  };
  steps: Array<{
    label: string;
    state: string;
  }>;
};

type ExplorerFeedbackControllerDependencies = {
  buildLoadingStepTrail: (input: {
    job: LoadingJob;
    pageTitle?: string;
  }) => LoadingTrail;
  state: {
    experienceConfig: {
      showLoadingSteps: boolean;
    };
  };
  transientStatusDurationMs: number;
};

export function createExplorerFeedbackController({
  buildLoadingStepTrail,
  state,
  transientStatusDurationMs
}: ExplorerFeedbackControllerDependencies) {
  let scrollStatusSequence = 0;

  function renderLoadingPanel({
    fallbackMessage,
    job = null,
    pageTitle
  }: LoadingPanelOptions): void {
    if (!state.experienceConfig.showLoadingSteps) {
      renderScrollStatus(
        fallbackMessage ?? pageTitle ?? "Loading…"
      );
      return;
    }
    const trail = buildLoadingStepTrail({
      job:
        job ?? {
          status: "pending_codex_image_generation"
        },
      pageTitle
    });
    explorerFeedbackBridge.publish({
      loadingPanel: {
        detail: trail.current.detail,
        message: trail.current.message,
        progressState:
          trail.current.phase === "ready"
            ? "complete"
            : trail.current.phase === "failed"
              ? "failed"
              : "indeterminate",
        steps: trail.steps
      },
      scrollStatus: null
    });
  }

  function clearLoadingPanel(): void {
    scrollStatusSequence += 1;
    explorerFeedbackBridge.publish({
      loadingPanel: null,
      scrollStatus: null
    });
  }

  function renderScrollStatus(message: string): void {
    scrollStatusSequence += 1;
    explorerFeedbackBridge.publish({
      scrollStatus: message
    });
  }

  function clearScrollStatus(): void {
    scrollStatusSequence += 1;
    explorerFeedbackBridge.publish({
      scrollStatus: null
    });
  }

  function renderTransientScrollStatus(message: string): void {
    const sequence = ++scrollStatusSequence;
    explorerFeedbackBridge.publish({
      scrollStatus: message
    });
    window.setTimeout(() => {
      if (sequence !== scrollStatusSequence) return;
      clearScrollStatus();
    }, transientStatusDurationMs);
  }

  return {
    clearLoadingPanel,
    clearScrollStatus,
    renderLoadingPanel,
    renderScrollStatus,
    renderTransientScrollStatus
  };
}
