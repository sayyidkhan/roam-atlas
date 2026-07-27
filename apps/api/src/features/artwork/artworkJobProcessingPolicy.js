import { imageJobPriority } from "../../domain/imageJobQueue.js";
import { createImageVariantKey } from "../../domain/runtimeCache.js";

export function createArtworkJobPolicy({
  imageConfig,
  getCountryPackForPage,
  normalizeImageQuality
}) {
  function createAssetVersion(
    page,
    {
      imageModel,
      prompt,
      imageQuality = imageConfig.quality
    }
  ) {
    const pack = getCountryPackForPage(page);
    const scene = pack?.scenes?.[page?.sceneId];
    return createImageVariantKey({
      prompt,
      imageModel,
      fallbackImageModel: imageConfig.fallbackModel,
      size: imageConfig.size,
      quality: normalizeImageQuality(imageQuality),
      outputFormat: imageConfig.outputFormat,
      outputCompression: imageConfig.outputCompression,
      promptVersion:
        page?.plan?.promptVersion ??
        page?.promptVersion ??
        scene?.promptVersion ??
        pack?.versions?.prompt,
      styleVersion:
        page?.plan?.styleVersion ??
        page?.styleVersion ??
        scene?.styleVersion ??
        pack?.versions?.style,
      dataVersion:
        page?.plan?.dataVersion ??
        page?.dataVersion ??
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
  existingJobKind,
  requestedJobKind
) {
  if (!existingJobKind) return requestedJobKind;
  return imageJobPriority({ jobKind: requestedJobKind }) <
    imageJobPriority({ jobKind: existingJobKind })
    ? requestedJobKind
    : existingJobKind;
}

export function shouldQueueEnvironmentPlanForJobKind(jobKind) {
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
}) {
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

export function isTransientGenerationError(error) {
  return /(?:\b408\b|\b409\b|\b429\b|\b5\d\d\b|fetch failed|network|econnreset|etimedout|timeout|aborted|terminated|premature close|socket hang up)/i.test(
    String(error?.message ?? error)
  );
}
