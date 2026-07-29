import { useSyncExternalStore } from "react";

import { explorerFeedbackBridge } from "./explorerFeedbackBridge";

export function ExplorerNavigationFeedback() {
  const snapshot = useSyncExternalStore(
    explorerFeedbackBridge.subscribe,
    explorerFeedbackBridge.getSnapshot
  );

  return (
    <>
      {snapshot.loadingPanel ? (
        <section
          className="loading-panel"
          role="status"
          aria-live="polite"
        >
          <div className="loading-panel-head">
            <span
              className="scroll-status-dot"
              aria-hidden="true"
            />
            <strong>
              {snapshot.loadingPanel.message}
            </strong>
          </div>
          <p className="loading-panel-detail">
            {snapshot.loadingPanel.detail}
          </p>
          <div
            className={`loading-panel-progress loading-panel-progress--${snapshot.loadingPanel.progressState}`}
            aria-hidden="true"
          >
            <span />
          </div>
          <ol className="loading-panel-steps">
            {snapshot.loadingPanel.steps.map(
              (step, index) => (
                <li
                  className={`loading-panel-step loading-panel-step--${step.state}`}
                  key={`${step.label}:${index}`}
                >
                  {step.label}
                </li>
              )
            )}
          </ol>
        </section>
      ) : null}

      {snapshot.scrollStatus ? (
        <div
          className="scroll-status"
          role="status"
          aria-live="polite"
        >
          <span
            className="scroll-status-dot"
            aria-hidden="true"
          />
          <span className="scroll-status-label">
            {snapshot.scrollStatus}
          </span>
        </div>
      ) : null}
    </>
  );
}
