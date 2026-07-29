import { EnvironmentParticleGraphic } from "./EnvironmentParticleGraphic";
import {
  expandNormalizedBounds,
  getAtmosphereProfile,
  getNormalizedEnvironmentBounds,
  mergeNormalizedBounds,
  normalizeEnvironmentKind,
  type EnvironmentLayer
} from "./explorerEnvironmentLayerPolicy";
import {
  environmentAmbientStyle,
  environmentBoundsStyle,
  environmentRange
} from "./environmentLayerStyles";

export function ExplorerEnvironmentAtmosphere({
  layers
}: {
  layers: EnvironmentLayer[];
}) {
  const waterLayers = layers.filter(
    (layer) =>
      normalizeEnvironmentKind(layer.kind) === "water"
  );
  const foliageLayers = layers.filter(
    (layer) =>
      normalizeEnvironmentKind(layer.kind) ===
      "foliage"
  );
  const hasBirdPlan = layers.some(
    (layer) =>
      normalizeEnvironmentKind(layer.kind) === "birds"
  );

  return (
    <div
      className="atmosphere-layer"
      data-atmosphere={getAtmosphereProfile(layers)}
    >
      {waterLayers.length ? (
        <WaterAtmosphere layers={waterLayers} />
      ) : null}
      {foliageLayers.length ? (
        <FoliageAtmosphere layers={foliageLayers} />
      ) : null}
      <AirAtmosphere
        hasBirdPlan={hasBirdPlan}
        hasWater={waterLayers.length > 0}
      />
    </div>
  );
}

function WaterAtmosphere({
  layers
}: {
  layers: EnvironmentLayer[];
}) {
  return (
    <div
      className="atmosphere-water-field"
      style={environmentBoundsStyle({
        x: 0,
        y: 0,
        width: 1,
        height: 1
      })}
    >
      {layers.map((layer, index) => (
        <WaterZone
          key={layer.id ?? `water:${index}`}
          layer={layer}
          zoneIndex={index}
        />
      ))}
    </div>
  );
}

function WaterZone({
  layer,
  zoneIndex
}: {
  layer: EnvironmentLayer;
  zoneIndex: number;
}) {
  const layerBounds = getNormalizedEnvironmentBounds(layer);
  const bounds = expandNormalizedBounds(layerBounds, {
    x: 0.035,
    y: 0.028,
    width: 0.07,
    height: 0.075
  });
  const marineCount =
    layerBounds.width >= 0.075 &&
    layerBounds.height >= 0.038
      ? layerBounds.width > 0.1
        ? 2
        : 1
      : 0;

  return (
    <div
      className="atmosphere-water-zone"
      data-safe-placement={
        layer.safePlacement ?? "open_water"
      }
      style={environmentBoundsStyle(bounds)}
    >
      {environmentRange(6).map((index) => (
        <span
          className="atmosphere-sea-band"
          key={`band:${index}`}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(zoneIndex * 0.9 + index * 0.55)}s`,
            "--ambient-duration": `${4.8 + (index % 3) * 0.7}s`,
            "--band-x": `${(index * 19 + zoneIndex * 11) % 42}%`,
            "--band-y": `${8 + index * 13}%`
          })}
        />
      ))}
      {environmentRange(4).map((index) => (
        <span
          className="atmosphere-water-glint"
          key={`glint:${index}`}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(index * 0.7 + zoneIndex * 0.4)}s`,
            "--ambient-x": `${10 + ((index * 29 + zoneIndex * 13) % 78)}%`,
            "--ambient-y": `${14 + ((index * 23 + zoneIndex * 17) % 70)}%`
          })}
        />
      ))}
      <ShorelineTrace zoneIndex={zoneIndex} />
      {environmentRange(marineCount).map((index) => (
        <span
          className="atmosphere-dolphin"
          key={`marine:${index}`}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(zoneIndex * 1.1 + index * 2.6)}s`,
            "--ambient-duration": `${6.8 + index * 1.2}s`,
            "--ambient-x": `${24 + ((index * 34 + zoneIndex * 21) % 48)}%`,
            "--ambient-y": `${42 + ((index * 18 + zoneIndex * 9) % 22)}%`
          })}
        >
          <EnvironmentParticleGraphic kind="marine_life" />
        </span>
      ))}
    </div>
  );
}

function ShorelineTrace({
  zoneIndex
}: {
  zoneIndex: number;
}) {
  return (
    <div
      className="atmosphere-shoreline"
      style={environmentAmbientStyle({
        "--ambient-delay": `${-(zoneIndex * 0.8)}s`
      })}
    >
      <svg
        className="ambient-svg atmosphere-shoreline-svg"
        viewBox="0 0 900 160"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="atmosphere-shoreline-line atmosphere-shoreline-line--foam"
          d="M10 92 C125 42 214 128 331 78 S541 34 676 82 S800 126 890 66"
        />
        <path
          className="atmosphere-shoreline-line atmosphere-shoreline-line--wash"
          d="M40 119 C162 77 253 143 367 102 S574 63 704 107 S812 144 884 101"
        />
      </svg>
    </div>
  );
}

function FoliageAtmosphere({
  layers
}: {
  layers: EnvironmentLayer[];
}) {
  const bounds = expandNormalizedBounds(
    mergeNormalizedBounds(
      layers.map(getNormalizedEnvironmentBounds)
    ),
    {
      x: 0.14,
      y: 0.12,
      width: 0.2,
      height: 0.16
    }
  );
  return (
    <div
      className="atmosphere-foliage-field"
      style={environmentBoundsStyle(bounds)}
    >
      {environmentRange(14).map((index) => (
        <span
          className="atmosphere-leaf"
          key={index}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(index * 0.38)}s`,
            "--ambient-duration": `${4.6 + (index % 4) * 0.45}s`,
            "--ambient-x": `${7 + ((index * 19) % 84)}%`,
            "--ambient-y": `${8 + ((index * 31) % 78)}%`
          })}
        />
      ))}
    </div>
  );
}

function AirAtmosphere({
  hasBirdPlan,
  hasWater
}: {
  hasBirdPlan: boolean;
  hasWater: boolean;
}) {
  return (
    <div
      className={
        hasWater
          ? "atmosphere-air atmosphere-air--coastal"
          : "atmosphere-air"
      }
      style={environmentBoundsStyle({
        x: 0.04,
        y: 0.01,
        width: 0.92,
        height: hasWater ? 0.22 : 0.2
      })}
    >
      {environmentRange(hasWater ? 5 : 4).map((index) => (
        <span
          className="atmosphere-cloud-bank"
          key={`bank:${index}`}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(index * 2.1)}s`,
            "--ambient-duration": `${18 + (index % 3) * 4}s`,
            "--ambient-x": `${10 + ((index * 23) % 78)}%`,
            "--ambient-y": `${6 + ((index * 11) % 42)}%`,
            "--cloud-scale": `${0.82 + (index % 3) * 0.14}`
          })}
        >
          <EnvironmentParticleGraphic kind="cloud" />
        </span>
      ))}
      {environmentRange(hasWater ? 4 : 3).map((index) => (
        <span
          className="atmosphere-cloud-wisp"
          key={`wisp:${index}`}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(index * 1.3)}s`,
            "--ambient-duration": `${18 + (index % 3) * 3}s`,
            "--ambient-x": `${5 + ((index * 28) % 74)}%`,
            "--ambient-y": `${6 + ((index * 17) % 62)}%`
          })}
        >
          <EnvironmentParticleGraphic kind="cloud" />
        </span>
      ))}
      {environmentRange(hasWater ? 6 : 4).map((index) => (
        <span
          className="atmosphere-breeze"
          key={`breeze:${index}`}
          style={environmentAmbientStyle({
            "--ambient-delay": `${-(index * 0.8)}s`,
            "--ambient-duration": `${8 + (index % 3) * 1.4}s`,
            "--ambient-y": `${15 + ((index * 18) % 64)}%`
          })}
        />
      ))}
      {environmentRange(hasWater || hasBirdPlan ? 5 : 0).map(
        (index) => (
          <span
            className="atmosphere-bird"
            key={`bird:${index}`}
            style={environmentAmbientStyle({
              "--ambient-delay": `${-(index * 0.65)}s`,
              "--ambient-duration": `${5.8 + (index % 3) * 0.9}s`,
              "--ambient-x": `${8 + ((index * 19) % 78)}%`,
              "--ambient-y": `${18 + ((index * 13) % 56)}%`
            })}
          >
            <EnvironmentParticleGraphic kind="birds" />
          </span>
        )
      )}
    </div>
  );
}
