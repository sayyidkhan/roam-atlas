import { imageJobPriority } from "./artworkQueuePolicy.ts";
import { createImageVariantKey } from "../../domain/runtimeCache.ts";

type ArtworkPage = {
  dataVersion?: string;
  plan?: {
    dataVersion?: string;
    promptVersion?: string;
    styleVersion?: string;
  } | null;
  promptVersion?: string;
  sceneId?: string | null;
  styleVersion?: string;
};

type ArtworkPack = {
  scenes?: Record<
    string,
    {
      dataVersion?: string;
      promptVersion?: string;
      styleVersion?: string;
    }
  >;
  versions?: {
    data?: string;
    prompt?: string;
    style?: string;
  };
};

type ImageConfig = {
  fallbackModel?: string | null;
  outputCompression?: number;
  outputFormat?: string;
  quality: string;
  size?: string;
};

type ArtworkJobPolicyDependencies = {
  getCountryPackForPage: (
    page: ArtworkPage
  ) => ArtworkPack | null | undefined;
  imageConfig: ImageConfig;
  normalizeImageQuality: (quality: string) => string;
};

type ArtworkJob = {
  assetVersion?: string | null;
  autoProcess?: boolean;
  prompt?: string | null;
  retryNotBefore?: string | null;
  status?: string;
};

export function createArtworkJobPolicy({
  imageConfig,
  getCountryPackForPage,
  normalizeImageQuality
}: ArtworkJobPolicyDependencies) {
  function createAssetVersion(
    page: ArtworkPage,
    {
      imageModel,
      prompt,
      imageQuality = imageConfig.quality
    }: {
      imageModel: string;
      imageQuality?: string;
      prompt: string;
    }
  ): string {
    const pack = getCountryPackForPage(page);
    const scene = page.sceneId
      ? pack?.scenes?.[page.sceneId]
      : undefined;
    return createImageVariantKey({
      prompt,
      imageModel,
      fallbackImageModel: imageConfig.fallbackModel,
      size: imageConfig.size,
      quality: normalizeImageQuality(imageQuality),
      outputFormat: imageConfig.outputFormat,
      outputCompression: imageConfig.outputCompression,
      promptVersion:
        page.plan?.promptVersion ??
        page.promptVersion ??
        scene?.promptVersion ??
        pack?.versions?.prompt,
      styleVersion:
        page.plan?.styleVersion ??
        page.styleVersion ??
        scene?.styleVersion ??
        pack?.versions?.style,
      dataVersion:
        page.plan?.dataVersion ??
        page.dataVersion ??
        scene?.dataVersion ??
        pack?.versions?.data
    });
  }

  return {
    createAssetVersion,
    chooseHigherPriorityJobKind,
    shouldQueueEnvironmentPlanForJobKind,
    shouldProcessJob,
    isTransientGenerationError
  };
}

export function chooseHigherPriorityJobKind(
  existingJobKind: string | null | undefined,
  requestedJobKind: string
): string {
  if (!existingJobKind) return requestedJobKind;
  return imageJobPriority({ jobKind: requestedJobKind }) <
    imageJobPriority({ jobKind: existingJobKind })
    ? requestedJobKind
    : existingJobKind;
}

export function shouldQueueEnvironmentPlanForJobKind(
  jobKind: string
): boolean {
  // Prefetched artwork becomes useful before its optional ambience. Deferring
  // that plan prevents speculative work from delaying the active page.
  return jobKind !== "prefetch";
}

export function shouldProcessJob({
  job,
  jobPath,
  processingJobs,
  isPathBeingFlushed,
  now = Date.now()
}: {
  isPathBeingFlushed: (jobPath: string) => boolean;
  job: ArtworkJob | null | undefined;
  jobPath: string;
  now?: number;
  processingJobs: {
    has: (jobPath: string) => boolean;
  };
}): boolean {
  const retryAt = Date.parse(job?.retryNotBefore ?? "");
  return Boolean(
    job &&
      job.status === "pending_codex_image_generation" &&
      job.autoProcess === true &&
      job.assetVersion &&
      job.prompt &&
      (!Number.isFinite(retryAt) || retryAt <= now) &&
      !processingJobs.has(jobPath) &&
      !isPathBeingFlushed(jobPath)
  );
}

export function isTransientGenerationError(
  error: unknown
): boolean {
  const message =
    error instanceof Error ? error.message : String(error);
  return /(?:\b408\b|\b409\b|\b429\b|\b5\d\d\b|fetch failed|network|econnreset|etimedout|timeout|aborted|terminated|premature close|socket hang up)/i.test(
    message
  );
}
