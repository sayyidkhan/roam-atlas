import { findTopmostHotspot } from "./scrollScene.js";

export function resolveImageClick({ scene, point, nodes }) {
  const hotspot = findTopmostHotspot(scene.hotspots, point);

  if (!hotspot) {
    return {
      status: "unmapped",
      nodeId: null,
      phrase: "unmapped illustrated detail",
      confidence: "unconfirmed",
      reason: "No precomputed WanderSG region contains this click."
    };
  }

  const node = hotspot.nodeId ? nodes[hotspot.nodeId] : null;
  if (!node) {
    return {
      status: "unmapped",
      nodeId: null,
      phrase: hotspot.label ?? "unmapped illustrated detail",
      confidence: "unconfirmed",
      reason: "The clicked region is visual-only and has no curated node."
    };
  }

  return {
    status: "matched",
    nodeId: node.id,
    phrase: hotspot.label ?? node.title,
    confidence: hotspot.confidence,
    action: hotspot.action,
    reason: "Matched through precomputed click region and mapped scene graph."
  };
}

export function precomputeClickableRegions(scene, limit = 4) {
  return [...scene.hotspots]
    .sort((a, b) => b.zIndex - a.zIndex)
    .slice(0, limit)
    .map((hotspot) => ({
      id: hotspot.id,
      nodeId: hotspot.nodeId,
      label: hotspot.label,
      shape: hotspot.shape,
      confidence: hotspot.confidence
    }));
}
