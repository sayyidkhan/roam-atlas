export type LoadingPhase =
  | "starting"
  | "queued"
  | "generating"
  | "ready"
  | "failed";

export type LoadingJob = {
  error?: string;
  jobKind?: string;
  nodeId?: string;
  status?: string;
  title?: string;
};

export type LoadingStep = {
  detail: string;
  message: string;
  phase: LoadingPhase;
  progress: number;
};

export type LoadingTrailItem = {
  id: "queued" | "generating" | "ready";
  label: string;
  state: "pending" | "active" | "done" | "failed";
};

export type LoadingStepTrail = {
  current: LoadingStep;
  steps: LoadingTrailItem[];
};

type LoadingStepInput = {
  job?: LoadingJob | null;
  pageTitle?: string;
};

export function resolveLoadingStep({
  job,
  pageTitle
}: LoadingStepInput): LoadingStep {
  const title =
    pageTitle ??
    job?.title ??
    job?.nodeId ??
    "this page";

  if (job?.status === "failed") {
    return {
      phase: "failed",
      message: `Could not open ${title}`,
      detail:
        job.error ?? "Image generation failed.",
      progress: 1
    };
  }

  if (
    job?.status ===
    "processing_openai_image"
  ) {
    return {
      phase: "generating",
      message: `Drawing ${title}`,
      detail:
        "Generating the illustrated page from curated visual direction.",
      progress: 0.62
    };
  }

  if (job?.status === "ready") {
    return {
      phase: "ready",
      message: `Opening ${title}`,
      detail:
        "Illustration ready. Finishing the page.",
      progress: 0.92
    };
  }

  if (
    job?.status ===
    "pending_codex_image_generation"
  ) {
    return {
      phase: "queued",
      message: `Queued ${title}`,
      detail:
        job.jobKind === "prefetch"
          ? "Prefetch is still drawing this region in the background."
          : "Illustration is still generating. This opens as soon as the job finishes.",
      progress: 0.24
    };
  }

  return {
    phase: "starting",
    message: `Preparing ${title}`,
    detail: "Starting illustration job.",
    progress: 0.08
  };
}

export function buildLoadingStepTrail(
  input: LoadingStepInput
): LoadingStepTrail {
  const current = resolveLoadingStep(input);
  const steps = [
    { id: "queued", label: "Queued" },
    {
      id: "generating",
      label: "Drawing illustration"
    },
    { id: "ready", label: "Opening page" }
  ] as const;
  const phaseOrder: Record<LoadingPhase, number> = {
    starting: 0,
    queued: 0,
    generating: 1,
    ready: 2,
    failed: -1
  };
  const activeIndex = Math.max(
    0,
    phaseOrder[current.phase]
  );

  return {
    current,
    steps: steps.map((step, index) => ({
      ...step,
      state: resolveTrailItemState(
        current.phase,
        index,
        activeIndex
      )
    }))
  };
}

function resolveTrailItemState(
  phase: LoadingPhase,
  index: number,
  activeIndex: number
): LoadingTrailItem["state"] {
  if (phase === "failed") {
    return index === 0 ? "failed" : "pending";
  }
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}
