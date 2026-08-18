import type { ExplorerSceneTarget } from "./explorerSceneStore";

export function ExplorerSceneBoundaries({
  highlightedNodeId,
  targets
}: {
  highlightedNodeId: string | null;
  targets: ExplorerSceneTarget[];
}) {
  const visualTargets = targets.filter(
    (target) => target.mode === "visual"
  );
  if (!visualTargets.length) return null;

  const targetStateClasses = (target: ExplorerSceneTarget) =>
    [
      target.isActive ? "is-active" : "",
      highlightedNodeId === target.nodeId
        ? "is-highlighted"
        : ""
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div aria-hidden="true" className="scene-target-selection-layer">
      {visualTargets.map((target) => (
        <span
          className={[
            "scene-target-ripple",
            targetStateClasses(target)
          ]
            .filter(Boolean)
            .join(" ")}
          key={target.nodeId}
          style={{
            left: `${target.normalizedClick.x * 100}%`,
            top: `${target.normalizedClick.y * 100}%`
          }}
        >
          <span className="scene-target-ripple-ring" />
          <span className="scene-target-ripple-dot" />
        </span>
      ))}
    </div>
  );
}
