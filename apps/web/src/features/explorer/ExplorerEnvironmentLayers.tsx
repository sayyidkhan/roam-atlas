import { EnvironmentParticleGraphic } from "./EnvironmentParticleGraphic";
import { ExplorerEnvironmentAtmosphere } from "./ExplorerEnvironmentAtmosphere";
import {
  environmentParticleDuration,
  getEnvironmentParticleCount,
  getRenderedEnvironmentBounds,
  normalizeEnvironmentKind,
  readEnvironmentScene,
  seededPercent,
  selectEnvironmentLayers,
  type EnvironmentLayer
} from "./explorerEnvironmentLayerPolicy";
import {
  environmentAmbientStyle,
  environmentBoundsStyle,
  environmentRange
} from "./environmentLayerStyles";

export function ExplorerEnvironmentLayers({
  environmentPlan,
  scene: sceneValue
}: {
  environmentPlan: unknown;
  scene: unknown;
}) {
  const scene = readEnvironmentScene(sceneValue);
  const selection = selectEnvironmentLayers(
    sceneValue,
    environmentPlan
  );
  if (!selection.layers.length) return null;

  return (
    <div
      className="environment-layer-root"
      data-environment-source={selection.source}
      data-render-pipeline="image-plan-atmosphere-react"
      aria-hidden="true"
    >
      <ExplorerEnvironmentAtmosphere
        layers={selection.layers}
      />
      {selection.layers.map((layer, index) => (
        <EnvironmentLayerView
          key={layer.id ?? `${layer.kind ?? "light"}:${index}`}
          layer={layer}
          scene={scene}
        />
      ))}
    </div>
  );
}

function EnvironmentLayerView({
  layer,
  scene
}: {
  layer: EnvironmentLayer;
  scene: ReturnType<typeof readEnvironmentScene>;
}) {
  const kind = normalizeEnvironmentKind(layer.kind);
  const intensity =
    layer.intensity === "medium" ? "medium" : "subtle";
  const count = getEnvironmentParticleCount(
    kind,
    intensity
  );
  return (
    <div
      className={`environment-layer environment-layer--${kind.replaceAll("_", "-")} environment-layer--${intensity}`}
      data-replacement="react"
      style={environmentBoundsStyle(
        getRenderedEnvironmentBounds(layer, scene)
      )}
    >
      {environmentRange(count).map((index) => (
        <span
          className={`environment-particle environment-particle--${kind}`}
          key={index}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(index * 0.9)}s`,
            "--ambient-duration": `${environmentParticleDuration(kind, index, intensity)}s`,
            "--ambient-x": `${seededPercent(layer.id, index, 17)}%`,
            "--ambient-y": `${seededPercent(layer.id, index, 53)}%`
          })}
        >
          <EnvironmentParticleGraphic kind={kind} />
        </span>
      ))}
    </div>
  );
}
