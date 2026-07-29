import type { DestinationPhase } from "./explorerDestinationBridge";

export type DestinationArtworkJob = {
  error?: unknown;
  status: string;
  title?: string;
};

export type DestinationTarget = {
  key: string;
  nodeId: string;
  sceneId: string;
  title: string;
};

export type DestinationNode = {
  title: string;
};

export type DestinationHotspot = {
  action?: {
    nodeId?: string;
  };
  anchorNumber?: string | number;
  displayNumber?: string | number;
  label?: string;
  mapNumber?: string | number;
  nodeId?: string;
  shape?: {
    height?: number;
    width?: number;
    x?: number;
    y?: number;
  };
};

export type DestinationScene = {
  coordinateSpace: {
    height: number;
    width: number;
  };
  hotspots?: DestinationHotspot[];
  pageType?: string;
};

export function readDestinationArtworkJob(
  value: unknown,
  fallbackStatus: string,
  fallbackTitle: string
): DestinationArtworkJob {
  if (!value || typeof value !== "object") {
    return {
      status: fallbackStatus,
      title: fallbackTitle
    };
  }
  const candidate = value as {
    error?: unknown;
    status?: unknown;
    title?: unknown;
  };
  return {
    error: candidate.error,
    status:
      typeof candidate.status === "string"
        ? candidate.status
        : fallbackStatus,
    title:
      typeof candidate.title === "string"
        ? candidate.title
        : fallbackTitle
  };
}

export function normalizeDestinationLoadingJob(
  job: DestinationArtworkJob,
  isFailed: boolean
): DestinationArtworkJob {
  if (isFailed) return { ...job, status: "failed" };
  if (job.status === "partial_ready") {
    return {
      ...job,
      status: "processing_openai_image"
    };
  }
  return job;
}

export function normalizeDestinationPhase(
  phase: string
): DestinationPhase {
  if (phase === "failed") return "failed";
  if (phase === "queued") return "queued";
  if (phase === "generating") return "loading";
  if (phase === "ready") return "ready";
  return "starting";
}

export function getDestinationStatusText(
  phase: DestinationPhase
): string {
  if (phase === "ready") return "Ready";
  if (phase === "failed") return "Retry later";
  if (phase === "queued") return "Queued";
  if (phase === "idle") return "Not queued";
  if (phase === "loading") return "Drawing";
  return "Starting";
}

export function orderDestinationTargets(
  scene: DestinationScene,
  targets: DestinationTarget[]
): DestinationTarget[] {
  return [...targets].sort((left, right) => {
    const leftNumber = Number(
      getDestinationMapNumber(
        findDestinationHotspot(scene, left.nodeId)
      )
    );
    const rightNumber = Number(
      getDestinationMapNumber(
        findDestinationHotspot(scene, right.nodeId)
      )
    );
    const leftHasNumber = Number.isFinite(leftNumber);
    const rightHasNumber = Number.isFinite(rightNumber);
    if (leftHasNumber && rightHasNumber) {
      return leftNumber - rightNumber;
    }
    if (leftHasNumber) return -1;
    if (rightHasNumber) return 1;
    return 0;
  });
}

export function findDestinationHotspot(
  scene: DestinationScene,
  nodeId: string
): DestinationHotspot | undefined {
  return scene.hotspots?.find(
    (hotspot) =>
      hotspot.nodeId === nodeId ||
      hotspot.action?.nodeId === nodeId
  );
}

export function getDestinationMapNumber(
  hotspot: DestinationHotspot | undefined
): string {
  const value =
    hotspot?.mapNumber ??
    hotspot?.displayNumber ??
    hotspot?.anchorNumber;
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }
  return String(value);
}

export function getNormalizedDestinationPoint(
  scene: DestinationScene,
  hotspot: DestinationHotspot | undefined
) {
  const width = scene.coordinateSpace.width;
  const height = scene.coordinateSpace.height;
  const centerX =
    (hotspot?.shape?.x ?? width / 2) +
    (hotspot?.shape?.width ?? 0) / 2;
  const centerY =
    (hotspot?.shape?.y ?? height / 2) +
    (hotspot?.shape?.height ?? 0) / 2;
  return {
    x: Math.min(1, Math.max(0, centerX / width)),
    y: Math.min(1, Math.max(0, centerY / height))
  };
}
