export function resolveLoadingStep({ job, pageTitle }) {
  const title = pageTitle ?? job?.title ?? job?.nodeId ?? "this page";

  if (job?.status === "failed") {
    return {
      phase: "failed",
      message: `Could not open ${title}`,
      detail: job.error ?? "Image generation failed.",
      progress: 1
    };
  }

  if (job?.status === "processing_openai_image") {
    return {
      phase: "generating",
      message: `Drawing ${title}`,
      detail: "Generating the illustrated page from curated visual direction.",
      progress: 0.62
    };
  }

  if (job?.status === "ready") {
    return {
      phase: "ready",
      message: `Opening ${title}`,
      detail: "Illustration ready. Finishing the page.",
      progress: 0.92
    };
  }

  if (job?.status === "pending_codex_image_generation") {
    return {
      phase: "queued",
      message: `Queued ${title}`,
      detail:
        job?.jobKind === "prefetch"
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

export function buildLoadingStepTrail({ job, pageTitle }) {
  const current = resolveLoadingStep({ job, pageTitle });
  const steps = [
    { id: "queued", label: "Queued" },
    { id: "generating", label: "Drawing illustration" },
    { id: "ready", label: "Opening page" }
  ];
  const phaseOrder = {
    starting: 0,
    queued: 0,
    generating: 1,
    ready: 2,
    failed: -1
  };
  const activeIndex = Math.max(0, phaseOrder[current.phase] ?? 0);

  return {
    current,
    steps: steps.map((step, index) => ({
      ...step,
      state: current.phase === "failed"
        ? index === 0
          ? "failed"
          : "pending"
        : index < activeIndex
        ? "done"
        : index === activeIndex
        ? "active"
        : "pending"
    }))
  };
}
