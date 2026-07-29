import { resolveRoamAtlasExperienceConfig } from "@roamatlas/data/experienceConfig.js";

const JOB_KIND_PRIORITY = {
  interactive: 0,
  prefetch: 1,
  artwork: 2,
  prewarm: 3
} as const;

const STATUS_PRIORITY = {
  pending_codex_image_generation: 0,
  processing_openai_image: 1,
  failed: 2,
  ready: 3
} as const;

export interface ArtworkQueueJob {
  jobKind?: string | null;
  status?: string | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  processingStartedAt?: string | number | null;
}

export interface ArtworkQueueEntry<TJob extends ArtworkQueueJob = ArtworkQueueJob> {
  fileName: string;
  job: TJob;
}

interface ArtworkQueueSelection<TEntry> {
  jobs: readonly TEntry[];
  runningJobKinds?: Iterable<string>;
  providerConcurrency: string | number | null | undefined;
  interactiveReservedSlots: string | number | null | undefined;
}

interface StaleArtworkJobOptions {
  now?: number;
  leaseMs?: number;
}

export function shouldQueueDefaultArtwork(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return resolveRoamAtlasExperienceConfig(env).loadCountryPackEarly;
}

export function imageJobPriority(job: ArtworkQueueJob | null | undefined): number {
  return JOB_KIND_PRIORITY[
    job?.jobKind as keyof typeof JOB_KIND_PRIORITY
  ] ?? JOB_KIND_PRIORITY.prewarm;
}

export function sortImageJobsForProcessing<
  TEntry extends ArtworkQueueEntry
>(jobs: readonly TEntry[]): TEntry[] {
  return [...jobs].sort((a, b) => {
    const priorityDelta = imageJobPriority(a.job) - imageJobPriority(b.job);
    if (priorityDelta !== 0) return priorityDelta;

    const statusDelta = statusPriority(a.job?.status) - statusPriority(b.job?.status);
    if (statusDelta !== 0) return statusDelta;

    const aCreated = parseJobTimestamp(a.job?.createdAt ?? a.job?.updatedAt ?? 0);
    const bCreated = parseJobTimestamp(b.job?.createdAt ?? b.job?.updatedAt ?? 0);
    if (aCreated !== bCreated) return aCreated - bCreated;

    return String(a.fileName).localeCompare(String(b.fileName));
  });
}

export function isInteractiveImageJob(
  job: ArtworkQueueJob | null | undefined
): boolean {
  return job?.jobKind === "interactive";
}

/**
 * Select work without allowing speculative jobs to occupy capacity reserved
 * for a click/navigation request. Callers should pass only eligible jobs.
 */
export function selectImageJobsForProcessing<
  TEntry extends ArtworkQueueEntry
>({
  jobs,
  runningJobKinds = [],
  providerConcurrency,
  interactiveReservedSlots
}: ArtworkQueueSelection<TEntry>): TEntry[] {
  const parsedConcurrency = parseInteger(providerConcurrency);
  const concurrency = Math.max(
    0,
    Number.isFinite(parsedConcurrency) ? parsedConcurrency : 0
  );
  if (concurrency === 0) return [];
  const reservedSlots = Math.min(
    concurrency,
    Math.max(0, parseInteger(interactiveReservedSlots) || 0)
  );
  const runningKinds = Array.from(runningJobKinds);
  let availableSlots = Math.max(0, concurrency - runningKinds.length);
  let availableBackgroundSlots = Math.max(
    0,
    concurrency -
      reservedSlots -
      runningKinds.filter((kind) => kind !== "interactive").length
  );
  const selected: TEntry[] = [];

  for (const entry of sortImageJobsForProcessing(jobs)) {
    if (availableSlots === 0) break;
    if (!isInteractiveImageJob(entry.job) && availableBackgroundSlots === 0) {
      continue;
    }

    selected.push(entry);
    availableSlots -= 1;
    if (!isInteractiveImageJob(entry.job)) {
      availableBackgroundSlots -= 1;
    }
  }

  return selected;
}

export function isStaleProcessingImageJob(
  job: ArtworkQueueJob | null | undefined,
  {
    now = Date.now(),
    leaseMs = 10 * 60 * 1000
  }: StaleArtworkJobOptions = {}
): boolean {
  if (!["processing_openai_image", "partial_ready"].includes(job?.status ?? "")) {
    return false;
  }
  const startedAt = parseJobTimestamp(
    job?.processingStartedAt ?? job?.updatedAt ?? ""
  );
  return Number.isFinite(startedAt) && now - startedAt > leaseMs;
}

function statusPriority(status: string | null | undefined): number {
  return STATUS_PRIORITY[
    status as keyof typeof STATUS_PRIORITY
  ] ?? STATUS_PRIORITY.failed;
}

function parseInteger(value: string | number | null | undefined): number {
  return Number.parseInt(String(value ?? ""), 10);
}

function parseJobTimestamp(value: string | number): number {
  return Date.parse(String(value));
}
