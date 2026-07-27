import { APP_CONFIG } from "../../config/appConfig.js";
import { normalizeEnvironmentKind } from "./environmentLayerRenderer.js";
import { normalizeEnvironmentPlanBounds, type Bounds } from "./sceneGeometry";

type JsonRecord = Record<string, unknown>;
type NodeLookup = Record<string, { childIds?: unknown[] } | undefined>;

export function normalizeEnvironmentPlan(plan: unknown) {
  const source = asRecord(plan);
  const targets = Array.isArray(source.targets)
    ? source.targets
        .map((value) => {
          const target = asRecord(value);
          return {
            ...target,
            nodeId: String(target.nodeId ?? ""),
            coordinateSpace: "normalized",
            visualBounds: normalizeEnvironmentPlanBounds(asBounds(target.visualBounds), {
              maxWidth: 0.48,
              maxHeight: 0.52
            }),
            labelBounds: normalizeEnvironmentPlanBounds(asBounds(target.labelBounds), {
              maxWidth: 0.24,
              maxHeight: 0.12
            })
          };
        })
        .filter((target) => target.nodeId && target.visualBounds && target.labelBounds)
    : [];
  const layers = Array.isArray(source.layers)
    ? source.layers
        .map((value) => {
          const layer = asRecord(value);
          return {
            ...layer,
            kind: normalizeEnvironmentKind(layer.kind),
            coordinateSpace: "normalized",
            bounds: normalizeEnvironmentPlanBounds(asBounds(layer.bounds))
          };
        })
        .filter((layer) => layer.bounds)
    : [];

  return {
    ...source,
    version: APP_CONFIG.environmentPlan.schemaVersion,
    targets,
    layers
  };
}

export function isCurrentEnvironmentPlan(plan: unknown) {
  const source = asRecord(plan);
  return source.version === APP_CONFIG.environmentPlan.schemaVersion
    && source.promptVersion === APP_CONFIG.environmentPlan.promptVersion;
}

export function hasUsableEnvironmentTargets(plan: unknown) {
  const source = asRecord(plan);
  return Array.isArray(source.targets) && source.targets.length > 0;
}

export function environmentPlanExpectsTargets(
  plan: unknown,
  currentPage: { nodeId?: string | null } | null | undefined,
  nodes: NodeLookup | null | undefined
) {
  const source = asRecord(plan);
  const nodeId = String(source.nodeId ?? currentPage?.nodeId ?? "");
  return (nodes?.[nodeId]?.childIds?.length ?? 0) > 0;
}

export function environmentPlanNeedsTargetRecovery(
  plan: unknown,
  currentPage: { nodeId?: string | null } | null | undefined,
  nodes: NodeLookup | null | undefined
) {
  return Boolean(plan)
    && environmentPlanExpectsTargets(plan, currentPage, nodes)
    && !hasUsableEnvironmentTargets(plan);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function asBounds(value: unknown): Partial<Bounds> | null {
  return value && typeof value === "object" ? value as Partial<Bounds> : null;
}
