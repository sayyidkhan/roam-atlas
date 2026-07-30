import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import {
  explorerDestinationStore,
  type DestinationPhase,
  type ExplorerDestinationItem
} from "./explorerDestinationStore";
import {
  findDestinationHotspot,
  getDestinationMapNumber,
  getDestinationStatusText,
  getNormalizedDestinationPoint,
  normalizeDestinationLoadingJob,
  normalizeDestinationPhase,
  orderDestinationTargets,
  readDestinationArtworkJob,
  type DestinationArtworkJob,
  type DestinationNode,
  type DestinationScene,
  type DestinationTarget
} from "./explorerDestinationPolicy";

type DestinationNavigationState = {
  activeCountrySlug: string;
  activePack: {
    confidence?: string;
    countrySlug: string;
  } | null;
  artworkJobs: Map<string, unknown>;
  prefetchJobs: Map<string, unknown>;
};

type LoadingTrail = {
  current: {
    detail: string;
    message: string;
    phase: string;
  };
};

export type ExplorerDestinationInput = {
  artworkJobKey: string;
  isArtworkPending: boolean;
  mode: "hidden" | "loading" | "rail";
  nodes: Record<string, DestinationNode>;
  pageTitle: string;
  scene: DestinationScene;
  targets: DestinationTarget[];
};

type ExplorerDestinationDependencies = {
  buildLoadingStepTrail: (input: {
    job: DestinationArtworkJob;
    pageTitle: string;
  }) => LoadingTrail;
  enterCountryShell: (country: CountrySummary) => void;
  getArtworkFailureMessage: (error: unknown) => string;
  getExplorerState: () => DestinationNavigationState;
  getPrefetchReadinessLabel: () => string | null;
  isArtworkJobFailed: (
    job: DestinationArtworkJob | null
  ) => boolean;
  isArtworkJobPending: (
    job: DestinationArtworkJob | null
  ) => boolean;
  isArtworkTargetReady: (
    target: DestinationTarget
  ) => boolean;
  resolveOverlayTarget: (target: {
    nodeId: string;
    normalizedClick: {
      x: number;
      y: number;
    };
  }) => void;
  retryArtwork: (artworkJobKey: string) => void;
  worldCountries: CountrySummary[];
};

export function createExplorerDestinationController({
  buildLoadingStepTrail,
  enterCountryShell,
  getArtworkFailureMessage,
  getExplorerState,
  getPrefetchReadinessLabel,
  isArtworkJobFailed,
  isArtworkJobPending,
  isArtworkTargetReady,
  resolveOverlayTarget,
  retryArtwork,
  worldCountries
}: ExplorerDestinationDependencies) {
  function publish(input: ExplorerDestinationInput): void {
    const items = buildDestinationItems(input);
    explorerDestinationStore.getState().setSnapshot({
      board:
        input.mode === "loading"
          ? buildLoadingBoard(input, items)
          : null,
      commands: {
        openCountrySetup,
        openDestination,
        retryArtwork
      },
      rail:
        input.mode === "rail"
          ? {
              items,
              readiness:
                getPrefetchReadinessLabel() ?? ""
            }
          : null
    });
  }

  function buildLoadingBoard(
    input: ExplorerDestinationInput,
    items: ExplorerDestinationItem[]
  ) {
    const state = getExplorerState();
    const job = readDestinationArtworkJob(
      state.artworkJobs.get(input.artworkJobKey),
      input.isArtworkPending
        ? "pending_codex_image_generation"
        : "starting",
      input.pageTitle
    );
    const isFailed = isArtworkJobFailed(job);
    const isPending = isArtworkJobPending(job);
    const isUnmappedStarterCountry =
      state.activePack?.confidence !== "confirmed" &&
      input.scene.pageType === "homepage_overview" &&
      input.targets.length === 0;
    const trail = buildLoadingStepTrail({
      job: normalizeDestinationLoadingJob(
        job,
        isFailed
      ),
      pageTitle: input.pageTitle
    });

    return {
      artworkJobKey: input.artworkJobKey,
      detail: isUnmappedStarterCountry
        ? "This country has an unconfirmed explorer shell but no reviewed location chapters yet."
        : isFailed
          ? getArtworkFailureMessage(job.error)
          : trail.current.detail,
      headline: isUnmappedStarterCountry
        ? `No mapped regions for ${input.pageTitle} yet`
        : trail.current.message,
      isBusy: isPending,
      isFailed,
      isUnmappedStarterCountry,
      items,
      pageTitle: input.pageTitle,
      readyCount: input.targets.filter(
        isArtworkTargetReady
      ).length,
      totalCount: input.targets.length
    };
  }

  function buildDestinationItems({
    nodes,
    scene,
    targets
  }: ExplorerDestinationInput): ExplorerDestinationItem[] {
    return orderDestinationTargets(scene, targets).flatMap(
      (target, index) => {
        const node = nodes[target.nodeId];
        if (!node) return [];
        const hotspot = findDestinationHotspot(
          scene,
          target.nodeId
        );
        const readiness = getTargetReadiness(target);
        return [
          {
            key: target.key,
            label: hotspot?.label ?? node.title,
            mapNumber:
              getDestinationMapNumber(hotspot) ||
              String(index + 1),
            nodeId: target.nodeId,
            normalizedClick: getNormalizedDestinationPoint(
              scene,
              hotspot
            ),
            phase: readiness.phase,
            readinessLabel: readiness.label,
            statusText: getDestinationStatusText(
              readiness.phase
            )
          }
        ];
      }
    );
  }

  function getTargetReadiness(
    target: DestinationTarget
  ): {
    label: string;
    phase: DestinationPhase;
  } {
    if (isArtworkTargetReady(target)) {
      return {
        label: "illustration ready",
        phase: "ready"
      };
    }

    const storedJob = getExplorerState().prefetchJobs.get(
      target.key
    );
    if (!storedJob) {
      return {
        label: "not started yet",
        phase: "idle"
      };
    }
    const job = readDestinationArtworkJob(
      storedJob,
      "starting",
      target.title
    );
    if (isArtworkJobFailed(job)) {
      return {
        label: getArtworkFailureMessage(job.error),
        phase: "failed"
      };
    }

    const current = buildLoadingStepTrail({
      job: normalizeDestinationLoadingJob(job, false),
      pageTitle: target.title
    }).current;
    const phase = normalizeDestinationPhase(current.phase);
    return {
      label:
        phase === "failed"
          ? "illustration failed"
          : current.detail,
      phase
    };
  }

  function openDestination(
    item: ExplorerDestinationItem
  ): void {
    resolveOverlayTarget({
      nodeId: item.nodeId,
      normalizedClick: item.normalizedClick
    });
  }

  function openCountrySetup(): void {
    const state = getExplorerState();
    const country = worldCountries.find(
      (item) => item.slug === state.activeCountrySlug
    );
    if (country) enterCountryShell(country);
  }

  return { publish };
}
