const JOB_KIND_PRIORITY = {
  interactive: 0,
  artwork: 1,
  prewarm: 2
};

const STATUS_PRIORITY = {
  pending_codex_image_generation: 0,
  processing_openai_image: 1,
  failed: 2,
  ready: 3
};

export function shouldQueueDefaultArtwork(env = process.env) {
  return env.WANDERSG_PREGENERATE_DEFAULT_ARTWORK === "true";
}

export function imageJobPriority(job) {
  return JOB_KIND_PRIORITY[job?.jobKind] ?? JOB_KIND_PRIORITY.prewarm;
}

export function sortImageJobsForProcessing(jobs) {
  return [...jobs].sort((a, b) => {
    const priorityDelta = imageJobPriority(a.job) - imageJobPriority(b.job);
    if (priorityDelta !== 0) return priorityDelta;

    const statusDelta =
      (STATUS_PRIORITY[a.job?.status] ?? STATUS_PRIORITY.failed) -
      (STATUS_PRIORITY[b.job?.status] ?? STATUS_PRIORITY.failed);
    if (statusDelta !== 0) return statusDelta;

    const aCreated = Date.parse(a.job?.createdAt ?? a.job?.updatedAt ?? 0);
    const bCreated = Date.parse(b.job?.createdAt ?? b.job?.updatedAt ?? 0);
    if (aCreated !== bCreated) return aCreated - bCreated;

    return String(a.fileName).localeCompare(String(b.fileName));
  });
}
