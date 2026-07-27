export function renderEnvironmentLayerNodes(scene, environmentPlan) {
  const plannedLayers = Array.isArray(environmentPlan?.layers) ? environmentPlan.layers : [];
  const layers = plannedLayers.length
    ? plannedLayers.filter(isRenderableEnvironmentLayer)
    : (scene.ambientLayers ?? []).filter(isSafeFallbackEnvironmentLayer);
  if (!layers.length) return [];

  const root = document.createElement("div");
  root.className = "environment-layer-root";
  root.dataset.environmentSource = environmentPlan?.source ?? "scene-fallback";
  root.dataset.renderPipeline = "image-plan-atmosphere-code-replacement";
  root.setAttribute("aria-hidden", "true");
  root.replaceChildren(
    renderAtmosphereLayer(layers),
    ...layers.map((layer) => renderEnvironmentLayer(layer, scene))
  );
  return [root];
}

function renderAtmosphereLayer(layers) {
  const root = document.createElement("div");
  root.className = "atmosphere-layer";
  root.dataset.atmosphere = getAtmosphereProfile(layers);

  const waterLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "water");
  const foliageLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "foliage");
  const cloudLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "cloud");
  const birdLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "birds");

  if (waterLayers.length) {
    root.append(renderWaterAtmosphere(waterLayers));
  }

  if (foliageLayers.length) {
    root.append(renderFoliageAtmosphere(foliageLayers));
  }

  root.append(renderAirAtmosphere(cloudLayers, {
    hasWater: waterLayers.length > 0,
    hasBirdPlan: birdLayers.length > 0
  }));
  return root;
}

function getAtmosphereProfile(layers) {
  const kinds = new Set(layers.map((layer) => normalizeEnvironmentKind(layer.kind)));
  if (kinds.has("water") && kinds.has("foliage")) return "coastal-park";
  if (kinds.has("water")) return "coastal";
  if (kinds.has("foliage")) return "garden";
  return "air";
}

function renderWaterAtmosphere(waterLayers) {
  const el = document.createElement("div");
  el.className = "atmosphere-water-field";
  applyNormalizedBounds(el, { x: 0, y: 0, width: 1, height: 1 });
  el.replaceChildren(...waterLayers.flatMap((layer, index) => renderWaterZone(layer, index)));
  return el;
}

function renderWaterZone(layer, zoneIndex) {
  const layerBounds = getNormalizedEnvironmentBounds(layer);
  const bounds = expandNormalizedBounds(layerBounds, {
    x: 0.035,
    y: 0.028,
    width: 0.07,
    height: 0.075
  });
  const zone = document.createElement("div");
  zone.className = "atmosphere-water-zone";
  zone.dataset.safePlacement = layer.safePlacement ?? "open_water";
  applyNormalizedBounds(zone, bounds);
  zone.replaceChildren(
    ...Array.from({ length: 6 }, (_, index) => {
      const band = document.createElement("span");
      band.className = "atmosphere-sea-band";
      band.style.setProperty("--ambient-delay", `${-((zoneIndex * 0.9) + index * 0.55)}s`);
      band.style.setProperty("--ambient-duration", `${4.8 + (index % 3) * 0.7}s`);
      band.style.setProperty("--band-y", `${8 + index * 13}%`);
      band.style.setProperty("--band-x", `${(index * 19 + zoneIndex * 11) % 42}%`);
      return band;
    }),
    ...Array.from({ length: 4 }, (_, index) => {
      const glint = document.createElement("span");
      glint.className = "atmosphere-water-glint";
      glint.style.setProperty("--ambient-x", `${10 + ((index * 29 + zoneIndex * 13) % 78)}%`);
      glint.style.setProperty("--ambient-y", `${14 + ((index * 23 + zoneIndex * 17) % 70)}%`);
      glint.style.setProperty("--ambient-delay", `${-(index * 0.7 + zoneIndex * 0.4)}s`);
      return glint;
    }),
    renderShorelineTrace(zoneIndex),
    ...renderMarineAtmosphere(layerBounds, zoneIndex)
  );
  return [zone];
}

function renderShorelineTrace(zoneIndex = 0) {
  const wrap = document.createElement("div");
  wrap.className = "atmosphere-shoreline";
  wrap.style.setProperty("--ambient-delay", `${-(zoneIndex * 0.8)}s`);
  wrap.innerHTML = `
    <svg class="ambient-svg atmosphere-shoreline-svg" viewBox="0 0 900 160" aria-hidden="true" focusable="false">
      <path class="atmosphere-shoreline-line atmosphere-shoreline-line--foam" d="M10 92 C125 42 214 128 331 78 S541 34 676 82 S800 126 890 66" />
      <path class="atmosphere-shoreline-line atmosphere-shoreline-line--wash" d="M40 119 C162 77 253 143 367 102 S574 63 704 107 S812 144 884 101" />
    </svg>
  `;
  return wrap;
}

function renderMarineAtmosphere(bounds, zoneIndex) {
  if (bounds.width < 0.075 || bounds.height < 0.038) return [];
  return Array.from({ length: bounds.width > 0.1 ? 2 : 1 }, (_, index) => {
    const dolphin = document.createElement("span");
    dolphin.className = "atmosphere-dolphin";
    dolphin.style.setProperty("--ambient-x", `${24 + ((index * 34 + zoneIndex * 21) % 48)}%`);
    dolphin.style.setProperty("--ambient-y", `${42 + ((index * 18 + zoneIndex * 9) % 22)}%`);
    dolphin.style.setProperty("--ambient-delay", `${-(zoneIndex * 1.1 + index * 2.6)}s`);
    dolphin.style.setProperty("--ambient-duration", `${6.8 + index * 1.2}s`);
    dolphin.innerHTML = renderEnvironmentParticleMarkup("marine_life");
    return dolphin;
  });
}

function renderFoliageAtmosphere(foliageLayers) {
  const bounds = expandNormalizedBounds(mergeNormalizedBounds(foliageLayers.map(getNormalizedEnvironmentBounds)), {
    x: 0.14,
    y: 0.12,
    width: 0.2,
    height: 0.16
  });
  const el = document.createElement("div");
  el.className = "atmosphere-foliage-field";
  applyNormalizedBounds(el, bounds);
  el.replaceChildren(
    ...Array.from({ length: 14 }, (_, index) => {
      const leaf = document.createElement("span");
      leaf.className = "atmosphere-leaf";
      leaf.style.setProperty("--ambient-x", `${7 + ((index * 19) % 84)}%`);
      leaf.style.setProperty("--ambient-y", `${8 + ((index * 31) % 78)}%`);
      leaf.style.setProperty("--ambient-delay", `${-(index * 0.38)}s`);
      leaf.style.setProperty("--ambient-duration", `${4.6 + (index % 4) * 0.45}s`);
      return leaf;
    })
  );
  return el;
}

function renderAirAtmosphere(cloudLayers, { hasWater, hasBirdPlan }) {
  const el = document.createElement("div");
  el.className = hasWater ? "atmosphere-air atmosphere-air--coastal" : "atmosphere-air";
  const cloudsBounds = { x: 0.04, y: 0.01, width: 0.92, height: hasWater ? 0.22 : 0.2 };
  applyNormalizedBounds(el, cloudsBounds);
  el.replaceChildren(
    ...Array.from({ length: hasWater ? 5 : 4 }, (_, index) => {
      const bank = document.createElement("span");
      bank.className = "atmosphere-cloud-bank";
      bank.style.setProperty("--ambient-x", `${10 + ((index * 23) % 78)}%`);
      bank.style.setProperty("--ambient-y", `${6 + ((index * 11) % 42)}%`);
      bank.style.setProperty("--ambient-delay", `${-(index * 2.1)}s`);
      bank.style.setProperty("--ambient-duration", `${18 + (index % 3) * 4}s`);
      bank.style.setProperty("--cloud-scale", `${0.82 + (index % 3) * 0.14}`);
      bank.innerHTML = renderEnvironmentParticleMarkup("cloud");
      return bank;
    }),
    ...Array.from({ length: hasWater ? 4 : 3 }, (_, index) => {
      const cloud = document.createElement("span");
      cloud.className = "atmosphere-cloud-wisp";
      cloud.style.setProperty("--ambient-x", `${5 + ((index * 28) % 74)}%`);
      cloud.style.setProperty("--ambient-y", `${6 + ((index * 17) % 62)}%`);
      cloud.style.setProperty("--ambient-delay", `${-(index * 1.3)}s`);
      cloud.style.setProperty("--ambient-duration", `${18 + (index % 3) * 3}s`);
      cloud.innerHTML = renderEnvironmentParticleMarkup("cloud");
      return cloud;
    }),
    ...Array.from({ length: hasWater ? 6 : 4 }, (_, index) => {
      const breeze = document.createElement("span");
      breeze.className = "atmosphere-breeze";
      breeze.style.setProperty("--ambient-y", `${15 + ((index * 18) % 64)}%`);
      breeze.style.setProperty("--ambient-delay", `${-(index * 0.8)}s`);
      breeze.style.setProperty("--ambient-duration", `${8 + (index % 3) * 1.4}s`);
      return breeze;
    }),
    ...Array.from({ length: hasWater || hasBirdPlan ? 5 : 0 }, (_, index) => {
      const bird = document.createElement("span");
      bird.className = "atmosphere-bird";
      bird.style.setProperty("--ambient-x", `${8 + ((index * 19) % 78)}%`);
      bird.style.setProperty("--ambient-y", `${18 + ((index * 13) % 56)}%`);
      bird.style.setProperty("--ambient-delay", `${-(index * 0.65)}s`);
      bird.style.setProperty("--ambient-duration", `${5.8 + (index % 3) * 0.9}s`);
      bird.innerHTML = renderEnvironmentParticleMarkup("birds");
      return bird;
    })
  );
  return el;
}

function mergeNormalizedBounds(boundsList) {
  const validBounds = boundsList.filter(Boolean);
  if (!validBounds.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x1 = Math.min(...validBounds.map((bounds) => bounds.x));
  const y1 = Math.min(...validBounds.map((bounds) => bounds.y));
  const x2 = Math.max(...validBounds.map((bounds) => bounds.x + bounds.width));
  const y2 = Math.max(...validBounds.map((bounds) => bounds.y + bounds.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function getNormalizedEnvironmentBounds(layer) {
  return isNormalizedBounds(layer?.bounds) ? layer.bounds : { x: 0, y: 0, width: 1, height: 1 };
}

function expandNormalizedBounds(bounds, amount) {
  const x = clamp01(bounds.x - amount.x);
  const y = clamp01(bounds.y - amount.y);
  const x2 = clamp01(bounds.x + bounds.width + amount.width);
  const y2 = clamp01(bounds.y + bounds.height + amount.height);
  return {
    x,
    y,
    width: Math.max(0.04, x2 - x),
    height: Math.max(0.04, y2 - y)
  };
}

function applyNormalizedBounds(el, bounds) {
  el.style.left = `${bounds.x * 100}%`;
  el.style.top = `${bounds.y * 100}%`;
  el.style.width = `${bounds.width * 100}%`;
  el.style.height = `${bounds.height * 100}%`;
}

function isRenderableEnvironmentLayer(layer) {
  const kind = normalizeEnvironmentKind(layer.kind);
  const bounds = layer.bounds;
  if (kind === "marine_life") {
    return bounds?.width >= 0.07 && bounds?.height >= 0.05 && bounds.y <= 0.86;
  }
  return true;
}

function renderEnvironmentLayer(layer, scene) {
  const el = document.createElement("div");
  const kind = normalizeEnvironmentKind(layer.kind);
  const intensity = layer.intensity === "medium" ? "medium" : "subtle";
  const bounds = layer.bounds ?? scene.coordinateSpace;
  const space = scene.coordinateSpace;
  const isNormalized = layer.coordinateSpace === "normalized" || isNormalizedBounds(bounds);
  const kindClassName = kind.replaceAll("_", "-");
  el.className = `environment-layer environment-layer--${kindClassName} environment-layer--${intensity}`;
  el.style.left = `${(isNormalized ? bounds.x : bounds.x / space.width) * 100}%`;
  el.style.top = `${(isNormalized ? bounds.y : bounds.y / space.height) * 100}%`;
  el.style.width = `${(isNormalized ? bounds.width : bounds.width / space.width) * 100}%`;
  el.style.height = `${(isNormalized ? bounds.height : bounds.height / space.height) * 100}%`;
  el.dataset.replacement = "code";
  el.replaceChildren(...createEnvironmentParticles(layer, kind, intensity));
  return el;
}

function isSafeFallbackEnvironmentLayer(layer) {
  return ["light", "cloud"].includes(normalizeEnvironmentKind(layer.kind));
}

function isNormalizedBounds(bounds) {
  return (
    Number.isFinite(bounds?.x) &&
    Number.isFinite(bounds?.y) &&
    Number.isFinite(bounds?.width) &&
    Number.isFinite(bounds?.height) &&
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.width <= 1 &&
    bounds.height <= 1
  );
}

function createEnvironmentParticles(layer, kind, intensity) {
  const countByKind = {
    cloud: intensity === "medium" ? 6 : 4,
    water: intensity === "medium" ? 8 : 6,
    foliage: intensity === "medium" ? 8 : 5,
    marine_life: intensity === "medium" ? 4 : 3,
    birds: intensity === "medium" ? 6 : 4,
    traffic: intensity === "medium" ? 5 : 3,
    crowd: intensity === "medium" ? 5 : 3,
    light: 1
  };
  const count = countByKind[kind] ?? 2;
  return Array.from({ length: count }, (_, index) => {
    const particle = document.createElement("span");
    particle.className = `environment-particle environment-particle--${kind}`;
    particle.style.setProperty("--ambient-x", `${seededPercent(layer.id, index, 17)}%`);
    particle.style.setProperty("--ambient-y", `${seededPercent(layer.id, index, 53)}%`);
    particle.style.setProperty("--ambient-delay", `${-(index * 0.9)}s`);
    particle.style.setProperty("--ambient-duration", `${environmentParticleDuration(kind, index, intensity)}s`);
    particle.innerHTML = renderEnvironmentParticleMarkup(kind);
    return particle;
  });
}

function renderEnvironmentParticleMarkup(kind) {
  if (kind === "birds") {
    return `
      <svg class="ambient-svg ambient-bird-svg" viewBox="0 0 64 32" aria-hidden="true" focusable="false">
        <path class="ambient-bird-wing ambient-bird-wing--left" d="M31 17 C22 6 12 4 3 15" />
        <path class="ambient-bird-wing ambient-bird-wing--right" d="M33 17 C43 5 53 4 61 15" />
      </svg>
    `;
  }

  if (kind === "water") {
    return `
      <svg class="ambient-svg ambient-water-svg" viewBox="0 0 160 36" aria-hidden="true" focusable="false">
        <path class="ambient-water-line ambient-water-line--wide" d="M3 18 C24 7 42 29 65 18 S108 8 132 18 S151 28 157 18" />
        <path class="ambient-water-line ambient-water-line--thin" d="M24 27 C43 19 58 31 77 27 S116 19 138 27" />
      </svg>
    `;
  }

  if (kind === "marine_life") {
    return `
      <svg class="ambient-svg ambient-marine-svg" viewBox="0 0 96 56" aria-hidden="true" focusable="false">
        <path class="ambient-marine-body" d="M23 32 C36 12 59 8 75 22 C61 22 49 30 38 42 C33 38 28 35 23 32 Z" />
        <path class="ambient-marine-fin" d="M51 22 C48 13 53 8 61 5 C60 14 58 21 51 22 Z" />
        <path class="ambient-marine-splash" d="M10 43 C23 36 35 48 49 42 S76 37 88 44" />
      </svg>
    `;
  }

  if (kind === "foliage") {
    return `
      <svg class="ambient-svg ambient-leaf-svg" viewBox="0 0 40 52" aria-hidden="true" focusable="false">
        <path class="ambient-leaf-body" d="M20 3 C34 14 35 33 20 49 C5 33 6 14 20 3 Z" />
        <path class="ambient-leaf-vein" d="M20 9 L20 45" />
      </svg>
    `;
  }

  if (kind === "cloud") {
    return `
      <svg class="ambient-svg ambient-cloud-svg" viewBox="0 0 180 70" aria-hidden="true" focusable="false">
        <path class="ambient-cloud-fill" d="M23 45 C28 25 47 20 62 29 C72 10 104 10 114 31 C130 24 153 32 158 47 C128 56 59 58 23 45 Z" />
        <path class="ambient-cloud-line" d="M29 45 C45 50 65 49 81 44 C100 51 131 52 153 47" />
      </svg>
    `;
  }

  return "";
}

function environmentParticleDuration(kind, index, intensity) {
  const mediumOffset = intensity === "medium" ? -0.7 : 0;
  const baseByKind = {
    birds: 4.8,
    marine_life: 4.2,
    water: 4.6,
    foliage: 5.4,
    cloud: 11,
    traffic: 4.8,
    crowd: 4.8,
    light: 16
  };
  const base = baseByKind[kind] ?? 6;
  return Math.max(3.2, base + mediumOffset + (index % 3) * 0.55);
}

export function normalizeEnvironmentKind(kind) {
  const value = String(kind ?? "light").trim().toLowerCase().replace(/[-\s]+/g, "_");
  return ["cloud", "water", "foliage", "marine_life", "birds", "traffic", "crowd", "light"].includes(value)
    ? value
    : "light";
}

function seededPercent(seed, index, salt) {
  const text = String(seed ?? "ambient");
  let value = salt + index * 31;
  for (let i = 0; i < text.length; i += 1) {
    value = (value + text.charCodeAt(i) * (i + 3)) % 100;
  }
  return Math.max(5, Math.min(95, value));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
