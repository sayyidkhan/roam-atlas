import {
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_SCHEMA_VERSION
} from "@roamatlas/prompts/buildEnvironmentPlanPrompt.js";

import {
  normalizeEnvironmentLayer,
  normalizeEnvironmentTarget,
  normalizeEnvironmentWarnings
} from "./environmentPlanNormalization.ts";
import type {
  EnvelopeOptions,
  EnvironmentNode,
  EnvironmentPage,
  EnvironmentPlanServerPolicyDependencies,
  EnvironmentTargetPlan,
  PlanMetadata,
  RawEnvironmentPlan,
  TargetCandidate
} from "./environmentPlanServerTypes.ts";

export function createEnvironmentPlanServerPolicy({
  getCountryPackForPage,
  getRuntimeCountrySlugForPage
}: EnvironmentPlanServerPolicyDependencies) {
  function getPromptContext(page: EnvironmentPage) {
    const pack = getCountryPackForPage(page);
    const title =
      page.plan?.title ??
      page.title ??
      page.nodeId ??
      page.sceneId ??
      "current atlas page";
    const pageType =
      page.plan?.pageType ??
      page.pageType ??
      "atlas_page";
    const currentNode =
      (page.nodeId ? pack.nodes[page.nodeId] : undefined) ??
      (page.sceneId
        ? pack.nodes[
            pack.scenes?.[page.sceneId]?.rootNodeId ?? ""
          ]
        : undefined);
    const scene = page.sceneId
      ? pack.scenes?.[page.sceneId]
      : undefined;
    const mapNumberByNodeId = new Map(
      (scene?.hotspots ?? [])
        .filter(
          (
            hotspot
          ): hotspot is {
            mapNumber?: unknown;
            nodeId: string;
          } => Boolean(hotspot?.nodeId)
        )
        .map((hotspot) => [
          hotspot.nodeId,
          hotspot.mapNumber ?? null
        ])
    );
    const targetCandidates = (
      currentNode?.childIds ?? []
    )
      .map((nodeId) => pack.nodes[nodeId])
      .filter(
        (node): node is EnvironmentNode => Boolean(node)
      )
      .map((node): TargetCandidate => ({
        nodeId: node.id,
        title: node.title,
        mapNumber:
          mapNumberByNodeId.get(node.id) ?? null
      }));
    return {
      countryName: pack.title,
      title,
      pageType,
      targetCandidates
    };
  }

  function hasExpectedTargets(
    page: EnvironmentPage,
    plan: EnvironmentTargetPlan | null | undefined
  ): boolean {
    const candidateCount =
      getPromptContext(page).targetCandidates.length;
    return (
      candidateCount === 0 ||
      (Array.isArray(plan?.targets) &&
        plan.targets.length > 0)
    );
  }

  function normalizePlan(
    rawPlan: RawEnvironmentPlan | null | undefined,
    page: EnvironmentPage,
    { source, model }: PlanMetadata
  ) {
    const targetCandidates =
      getPromptContext(page).targetCandidates;
    const allowedTargets = new Map(
      targetCandidates.map((candidate) => [
        candidate.nodeId,
        candidate
      ])
    );
    const targets = Array.isArray(rawPlan?.targets)
      ? rawPlan.targets
          .map((target, index) =>
            normalizeEnvironmentTarget(
              target,
              index,
              allowedTargets
            )
          )
          .filter(Boolean)
          .slice(0, targetCandidates.length)
      : [];
    const layers = Array.isArray(rawPlan?.layers)
      ? rawPlan.layers
          .map((layer, index) =>
            normalizeEnvironmentLayer(layer, index)
          )
          .filter(Boolean)
          .slice(0, 6)
      : [];
    return createEnvelope(page, {
      source,
      model,
      status:
        layers.length || targets.length
          ? "ready"
          : "fallback",
      targets,
      layers,
      warnings: normalizeEnvironmentWarnings(
        rawPlan?.warnings
      )
    });
  }

  function createFallback(
    page: EnvironmentPage,
    warning?: string | null
  ) {
    return createEnvelope(page, {
      source: "fallback",
      model: null,
      status: "fallback",
      targets: [],
      layers: [
        {
          id: "safe-light-wash",
          kind: "light",
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          coordinateSpace: "normalized",
          intensity: "subtle",
          safePlacement: "open_light",
          avoid: [
            "labels",
            "callouts",
            "leader lines"
          ],
          reason:
            "Conservative fallback avoids placing water or wildlife without image understanding."
        }
      ],
      warnings: warning ? [warning] : []
    });
  }

  function createEnvelope(
    page: EnvironmentPage,
    {
      source,
      model,
      status,
      targets = [],
      layers,
      warnings
    }: EnvelopeOptions
  ) {
    return {
      version: ENVIRONMENT_PLAN_SCHEMA_VERSION,
      source,
      model,
      status,
      pageId: page.id,
      countrySlug: getRuntimeCountrySlugForPage(page),
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      imageUrl: page.imageUrl,
      promptVersion: ENVIRONMENT_PLAN_PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      factBoundary:
        "Environment overlays are decorative code-rendered ambience only and are not fact sources.",
      targets,
      layers,
      warnings
    };
  }

  return {
    getPromptContext,
    hasExpectedTargets,
    normalizePlan,
    createFallback
  };
}
