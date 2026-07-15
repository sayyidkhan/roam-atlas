const JOB_KIND_PRIORITY = {
  interactive: 0,
  prefetch: 1,
  artwork: 2,
  prewarm: 3
};

const STATUS_PRIORITY = {
  pending_codex_image_generation: 0,
  processing_openai_image: 1,
  failed: 2,
  ready: 3
};

import { resolveRoamAtlasExperienceConfig } from "../config/experienceConfig.js";

export function shouldQueueDefaultArtwork(env = process.env) {
  return resolveRoamAtlasExperienceConfig(env).loadCountryPackEarly;
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

export function isInteractiveImageJob(job) {
  return job?.jobKind === "interactive";
}

/**
 * Select work without allowing speculative jobs to occupy capacity reserved
 * for a click/navigation request. Callers should pass only eligible jobs.
 */
export function selectImageJobsForProcessing({
  jobs,
  runningJobKinds = [],
  providerConcurrency,
  interactiveReservedSlots
}) {
  const parsedConcurrency = Number.parseInt(providerConcurrency, 10);
  const concurrency = Math.max(0, Number.isFinite(parsedConcurrency) ? parsedConcurrency : 0);
  if (concurrency === 0) return [];
  const reservedSlots = Math.min(
    concurrency,
    Math.max(0, Number.parseInt(interactiveReservedSlots, 10) || 0)
  );
  const runningKinds = Array.from(runningJobKinds);
  let availableSlots = Math.max(0, concurrency - runningKinds.length);
  let availableBackgroundSlots = Math.max(
    0,
    concurrency - reservedSlots - runningKinds.filter((kind) => kind !== "interactive").length
  );
  const selected = [];

  for (const entry of sortImageJobsForProcessing(jobs)) {
    if (availableSlots === 0) break;
    if (!isInteractiveImageJob(entry.job) && availableBackgroundSlots === 0) continue;

    selected.push(entry);
    availableSlots -= 1;
    if (!isInteractiveImageJob(entry.job)) {
      availableBackgroundSlots -= 1;
    }
  }

  return selected;
}

export function isStaleProcessingImageJob(job, {
  now = Date.now(),
  leaseMs = 10 * 60 * 1000
} = {}) {
  if (!["processing_openai_image", "partial_ready"].includes(job?.status)) return false;
  const startedAt = Date.parse(job.processingStartedAt ?? job.updatedAt ?? "");
  return Number.isFinite(startedAt) && now - startedAt > leaseMs;
}
