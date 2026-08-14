import type { ExplorerSceneTarget } from "./explorerSceneStore";
import { sceneOutlinePath } from "./sceneOutlineGeometry";

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

  return (
    <svg
      aria-hidden="true"
      className="scene-target-boundaries"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      {visualTargets.map((target) => {
        const stateClasses = [
          target.isActive ? "is-active" : "",
          highlightedNodeId === target.nodeId
            ? "is-highlighted"
            : ""
        ]
          .filter(Boolean)
          .join(" ");
        const path = sceneOutlinePath({
          bounds: target.bounds,
          outline: target.visualOutline
        });
        return (
          <g key={target.nodeId}>
            <path
              className={[
                "scene-target-boundary",
                stateClasses
              ]
                .filter(Boolean)
                .join(" ")}
              d={path}
            />
            <path
              className={[
                "scene-target-boundary-pulse",
                stateClasses
              ]
                .filter(Boolean)
                .join(" ")}
              d={path}
            />
          </g>
        );
      })}
    </svg>
  );
}
