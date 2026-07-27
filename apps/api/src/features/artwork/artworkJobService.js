import path from "node:path";

import {
  isStaleProcessingImageJob,
  selectImageJobsForProcessing,
  shouldQueueDefaultArtwork
} from "../../domain/imageJobQueue.js";
import { createRuntimeCachePaths } from "../../domain/runtimeCache.js";
import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.js";
import { createArtworkJobCreationService } from "./artworkJobCreationService.js";

export function createArtworkJobService({
  runtimeCacheRoot,
  imageConfig,
  experienceConfig,
  countryPacks,
  configuredImageProvider,
  jobRepository,
  environmentPlanQueue,
  jobPolicy,
  getCountrySlugForPage,
  getCountrySlugForJob,
  listDefaultPages,
  ensurePageUnderstanding,
  isPathBeingFlushed,
  getCountryCacheFlushRun,
  logger = console
}) {
  const processingJobs = new Map();
  const processingJobRuns = new Map();
  const processingJobAbortControllers = new Map();
  const cancelledJobs = new Set();
  let scanPromise = null;
  let rescanRequested = false;
  const creationService = createArtworkJobCreationService({
    runtimeCacheRoot,
    imageConfig,
    configuredImageProvider,
    jobRepository,
    environmentPlanQueue,
    jobPolicy,
    processingJobs,
    getCountrySlugForPage,
    ensurePageUnderstanding,
    getCountryCacheFlushRun,
    requestProcessing
  });

  function start() {
    if (!configuredImageProvider.isConfigured) {
      logger.log(
        "RoamAtlas image job processor idle: no image provider key is configured."
      );
      return;
    }
    if (experienceConfig.providerConcurrency === 0) {
      logger.log(
        "RoamAtlas image job processor disabled: provider concurrency is 0."
      );
      return;
    }

    logger.log(
      `RoamAtlas image job processor enabled with ${configuredImageProvider.provider}.`
    );
    const initialQueue = shouldQueueDefaultArtwork()
      ? queueDefaultArtworkJobs()
      : Promise.resolve();
    if (!shouldQueueDefaultArtwork()) {
      logger.log(
        "RoamAtlas default artwork pre-generation skipped. Set ROAMATLAS_LOAD_COUNTRY_PACK_EARLY=true to enable it."
      );
    }
    initialQueue.then(requestProcessing).catch((error) => {
      logger.error("Initial image job processing failed:", error);
    });
    setInterval(requestProcessing, 3000);
  }

  function requestProcessing() {
    if (!configuredImageProvider.canAutoProcess) return null;
    if (scanPromise) {
      rescanRequested = true;
      return scanPromise;
    }

    scanPromise = Promise.resolve()
      .then(processPendingJobs)
      .catch((error) => {
        logger.error("Image job processing failed:", error);
      })
      .finally(() => {
        scanPromise = null;
        if (rescanRequested) {
          rescanRequested = false;
          requestProcessing();
        }
      });
    return scanPromise;
  }

  async function queueDefaultArtworkJobs() {
    for (const pack of Object.values(countryPacks)) {
      const pages = listDefaultPages(
        pack.scenes,
        pack.nodes,
        pack.countrySlug,
        pack.title
      );
      for (const page of pages) {
        await creationService.createImageJob(page, { jobKind: "prewarm" });
      }
    }
  }

  async function processPendingJobs() {
    const jobs = [];
    for (const { fileName, jobPath } of await jobRepository.listJobFiles()) {
      if (jobRepository.isTerminal(jobPath)) continue;
      let job = await jobRepository.readJob(jobPath);
      if (["ready", "failed"].includes(job?.status)) {
        jobRepository.markTerminal(jobPath, job.status);
        continue;
      }
      if (isStaleProcessingImageJob(job) && !processingJobs.has(jobPath)) {
        job = {
          ...job,
          status: "pending_codex_image_generation",
          recoveredAt: new Date().toISOString(),
          recoveryCount: (job.recoveryCount ?? 0) + 1,
          lastRecoveryReason:
            "processing lease expired after a server interruption"
        };
        await jobRepository.writeJob(jobPath, job);
      }
      jobs.push({ fileName, jobPath, job });
    }

    const eligibleJobs = jobs.filter(({ jobPath, job }) =>
      jobPolicy.shouldProcessJob({
        job,
        jobPath,
        processingJobs,
        isPathBeingFlushed
      })
    );
    const selectedJobs = selectImageJobsForProcessing({
      jobs: eligibleJobs,
      runningJobKinds: processingJobs.values(),
      providerConcurrency: experienceConfig.providerConcurrency,
      interactiveReservedSlots: experienceConfig.interactiveReservedSlots
    });

    for (const { jobPath, job } of selectedJobs) {
      const run = processJob(jobPath, job);
      processingJobRuns.set(jobPath, run);
      run
        .catch((error) => {
          logger.error("Image job processing failed:", error);
        })
        .finally(() => {
          if (processingJobRuns.get(jobPath) === run) {
            processingJobRuns.delete(jobPath);
          }
        });
    }
  }

  async function processJob(jobPath, job) {
    processingJobs.set(jobPath, job.jobKind ?? "prewarm");
    const abortController = new AbortController();
    processingJobAbortControllers.set(jobPath, abortController);
    const imageModel = configuredImageProvider.model;
    const countrySlug = getCountrySlugForJob(job);
    const paths = createRuntimeCachePaths({
      cacheRoot: runtimeCacheRoot,
      pageId: job.pageId,
      imageModel,
      countrySlug,
      outputFormat: imageConfig.outputFormat,
      variantKey: job.assetVersion
    });
    const processingStartedAt = new Date().toISOString();
    const processingJob = {
      ...job,
      countrySlug,
      status: "processing_openai_image",
      imageModel,
      requestedImageModel: imageModel,
      attemptCount: (job.attemptCount ?? 0) + 1,
      firstProcessingStartedAt:
        job.firstProcessingStartedAt ??
        job.processingStartedAt ??
        processingStartedAt,
      processingStartedAt,
      providerStartedAt: processingStartedAt,
      retryNotBefore: null,
      error: null
    };
    let firstPartialAt = job.firstPartialAt ?? null;
    let latestPartialAt = job.latestPartialAt ?? null;

    try {
      assertWritable(jobPath);
      await jobRepository.writeJob(jobPath, processingJob);

      const generated = await configuredImageProvider.generate({
        model: imageModel,
        prompt: job.prompt,
        quality: job.imageQuality,
        signal: abortController.signal,
        onPartialImage: async (partial) => {
          if (cancelledJobs.has(jobPath)) return;
          const receivedAt = new Date().toISOString();
          firstPartialAt ??= receivedAt;
          latestPartialAt = receivedAt;
          await jobRepository.writeBinaryArtifact(
            paths.partialImagePath,
            Buffer.from(partial.b64Json, "base64"),
            jobPath
          );
          const partialImageWrittenAt = new Date().toISOString();
          const currentJob = await jobRepository.readJob(jobPath);
          if (
            currentJob?.assetVersion !== job.assetVersion ||
            cancelledJobs.has(jobPath) ||
            !processingJobs.has(jobPath) ||
            !["processing_openai_image", "partial_ready"].includes(
              currentJob.status
            )
          ) {
            return;
          }
          await jobRepository.writeJob(jobPath, {
            ...currentJob,
            status: "partial_ready",
            partialImageUrl: paths.partialImageUrl,
            firstPartialAt: currentJob.firstPartialAt ?? firstPartialAt,
            latestPartialAt,
            partialImageWrittenAt,
            partialImageIndex: partial.partialImageIndex ?? 0
          });
        }
      });
      const providerCompletedAt = new Date().toISOString();

      assertWritable(jobPath);
      await jobRepository.writeBinaryArtifact(
        paths.imagePath,
        Buffer.from(generated.b64Json, "base64"),
        jobPath
      );
      const imageWrittenAt = new Date().toISOString();
      const metadataPreparedAt = new Date().toISOString();
      assertWritable(jobPath);
      await jobRepository.writeJsonArtifact(
        paths.metadataPath,
        createImageMetadata({
          job,
          countrySlug,
          generated,
          imageModel,
          paths,
          processingStartedAt,
          providerCompletedAt,
          firstPartialAt,
          imageWrittenAt,
          metadataPreparedAt
        }),
        jobPath
      );
      const metadataWrittenAt = new Date().toISOString();
      assertWritable(jobPath);
      const readyAt = new Date().toISOString();
      const currentJob = await jobRepository.readJob(jobPath);
      const completedJobKind =
        currentJob?.jobKind ?? processingJob.jobKind;
      const shouldQueueEnvironment =
        jobPolicy.shouldQueueEnvironmentPlanForJobKind(completedJobKind);
      const readyPage = {
        id: job.pageId,
        countrySlug,
        assetVersion: job.assetVersion,
        sceneId: job.sceneId,
        nodeId: job.nodeId,
        imageUrl: paths.imageUrl,
        status: "ready",
        plan: {
          title: job.title,
          pageType: job.pageType
        }
      };

      await jobRepository.writeJob(jobPath, {
        ...(currentJob?.assetVersion === job.assetVersion
          ? currentJob
          : processingJob),
        countrySlug,
        status: "ready",
        assetVersion: job.assetVersion,
        imageUrl: paths.imageUrl,
        partialImageUrl: firstPartialAt
          ? paths.partialImageUrl
          : undefined,
        source: `${generated.provider ??
          configuredImageProvider.provider}-image-api`,
        imageProvider:
          generated.provider ?? configuredImageProvider.provider,
        imageModel: generated.model,
        requestedImageModel: imageModel,
        imageQuality: job.imageQuality ?? imageConfig.quality,
        metadataUrl: paths.metadataUrl,
        environmentUrl: paths.environmentUrl,
        environmentStatus: shouldQueueEnvironment ? "pending" : "deferred",
        cacheKind: "runtime",
        processingStartedAt,
        providerCompletedAt,
        firstPartialAt,
        latestPartialAt,
        imageWrittenAt,
        metadataWrittenAt,
        readyAt,
        completedAt: readyAt
      });
      assertWritable(jobPath);
      if (shouldQueueEnvironment) {
        environmentPlanQueue.queuePlan({ page: readyPage, paths, jobPath });
      }
      await ensurePageUnderstanding(readyPage);
    } catch (error) {
      if (cancelledJobs.has(jobPath)) return;
      const failedAt = new Date().toISOString();
      const currentJob = await jobRepository.readJob(jobPath);
      const retryable =
        jobPolicy.isTransientGenerationError(error) &&
        processingJob.attemptCount < 3;
      const retryDelayMs = Math.min(
        5 * 60 * 1000,
        Math.max(
          1000 * 2 ** (processingJob.attemptCount - 1),
          Number(error?.retryAfterMs) || 0
        )
      );
      await jobRepository.writeJob(jobPath, {
        ...(currentJob?.assetVersion === job.assetVersion
          ? currentJob
          : processingJob),
        countrySlug,
        status: retryable
          ? "pending_codex_image_generation"
          : "failed",
        error: String(error?.message ?? error),
        transientError: retryable,
        retryNotBefore: retryable
          ? new Date(Date.now() + retryDelayMs).toISOString()
          : null,
        retryScheduledAt: retryable ? failedAt : null,
        failedAt: retryable ? null : failedAt,
        lastAttemptFailedAt: failedAt,
        processingStartedAt,
        firstPartialAt,
        latestPartialAt
      });
    } finally {
      processingJobs.delete(jobPath);
      processingJobAbortControllers.delete(jobPath);
      cancelledJobs.delete(jobPath);
      requestProcessing();
    }
  }

  function cancelForCountry(countryCacheRoot) {
    const activeRuns = [];
    for (const jobPath of processingJobs.keys()) {
      if (isPathInside(countryCacheRoot, path.normalize(jobPath))) {
        cancelledJobs.add(jobPath);
        processingJobAbortControllers.get(jobPath)?.abort(
          new Error(
            "Image generation cancelled because its country runtime cache was flushed."
          )
        );
        const run = processingJobRuns.get(jobPath);
        if (run) activeRuns.push(run);
      }
    }
    jobRepository.clearTerminalUnder(countryCacheRoot);
    return activeRuns;
  }

  function assertWritable(jobPath) {
    if (cancelledJobs.has(jobPath)) {
      throw new Error(
        "Image generation cancelled because its runtime cache was flushed."
      );
    }
  }

  return {
    createImageJob: creationService.createImageJob,
    start,
    requestProcessing,
    cancelForCountry,
    waitForCountryCreations: creationService.waitForCountryCreations,
    assertWritable
  };

  function createImageMetadata({
    job,
    countrySlug,
    generated,
    imageModel,
    paths,
    processingStartedAt,
    providerCompletedAt,
    firstPartialAt,
    imageWrittenAt,
    metadataPreparedAt
  }) {
    return {
      pageId: job.pageId,
      countrySlug,
      assetVersion: job.assetVersion,
      sceneId: job.sceneId,
      nodeId: job.nodeId,
      parentId: job.parentId,
      parentClick: job.parentClick,
      imageModel: generated.model,
      requestedImageModel: imageModel,
      imageProvider:
        generated.provider ?? configuredImageProvider.provider,
      size: generated.size,
      quality:
        generated.quality ?? job.imageQuality ?? imageConfig.quality,
      outputFormat:
        generated.outputFormat ?? imageConfig.outputFormat,
      outputCompression:
        generated.outputCompression ?? imageConfig.outputCompression,
      imageUrl: paths.imageUrl,
      environmentUrl: paths.environmentUrl,
      prompt: job.prompt,
      revisedPrompt: generated.revisedPrompt,
      usage: generated.usage ?? null,
      cacheKind: "runtime",
      generatedAt: providerCompletedAt,
      processingStartedAt,
      providerCompletedAt,
      firstPartialAt,
      imageWrittenAt,
      metadataPreparedAt,
      factBoundary:
        "Generated image is visual only and is not a fact source."
    };
  }
}
