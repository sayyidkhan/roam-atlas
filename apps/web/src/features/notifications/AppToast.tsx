import { useSyncExternalStore } from "react";

import { appToastBridge } from "./appToastBridge";

export function AppToast() {
  const snapshot = useSyncExternalStore(
    appToastBridge.subscribe,
    appToastBridge.getSnapshot,
    appToastBridge.getSnapshot
  );
  if (!snapshot) return null;
  const isError = snapshot.tone === "error";

  return (
    <div className="app-toast-region">
      <section
        className={`app-toast app-toast--${snapshot.tone}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="app-toast-icon" aria-hidden="true">
          {isError ? "!" : "✓"}
        </span>
        <div>
          <span className="app-toast-outcome">
            {isError ? "Failed" : "Success"}
          </span>
          <strong>{snapshot.title}</strong>
          <p>{snapshot.message}</p>
        </div>
        <button
          type="button"
          data-dismiss-app-toast
          aria-label="Dismiss notification"
          onClick={snapshot.commands.dismiss}
        >
          ×
        </button>
      </section>
    </div>
  );
}
