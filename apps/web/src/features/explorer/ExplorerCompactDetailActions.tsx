import { useStore } from "zustand";

import { explorerDetailStore } from "./explorerDetailStore";

export function ExplorerCompactDetailActions() {
  const snapshot = useStore(
    explorerDetailStore,
    (state) => state.snapshot
  );

  if (
    !snapshot?.node ||
    snapshot.detailOverride ||
    snapshot.mode === "hidden"
  ) {
    return null;
  }

  const title = snapshot.node.title ?? "selected place";
  const isExpanded = snapshot.mode === "expanded";

  return (
    <div
      className="scene-hud-detail-actions"
      aria-label={`Actions for ${title}`}
    >
      <button
        type="button"
        className={[
          "scene-hud-detail-button",
          isExpanded ? "is-active" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${isExpanded ? "Hide" : "Show"} facts for ${title}`}
        aria-pressed={isExpanded}
        onClick={
          isExpanded
            ? snapshot.commands.collapse
            : snapshot.commands.expand
        }
      >
        Facts
      </button>
    </div>
  );
}
