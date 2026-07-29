import path from "node:path";

import { createRuntimeCachePaths } from "../../domain/runtimeCache.ts";
import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.ts";
import type {
  ArtworkJobRepository
} from "./artworkJobRepository.ts";

type RuntimeCachePaths = ReturnType<typeof createRuntimeCachePaths>;

type ArtworkJob = {
  [key: string]: unknown;
  assetVersion: string;
  attemptCount?: number;
  firstPartialAt?: string | null;
  firstProcessingStartedAt?: string;
  imageQuality?: string;
  jobKind?: string;
  latestPartialAt?: string | null;
  nodeId?: string;
  pageId: string;
  pageType?: string;
  parentClick?: unknown;
  parentId?: string;
  processingStartedAt?: string;
  prompt: string;
  sceneId?: string;
  status?: string;
  title?: string;
};

type GeneratedArtwork = {
  b64Json: string;
  model: string;
  outputCompression?: number;
  outputFormat?: string;
  provider?: string;
  quality?: string;
  revisedPrompt?: string;
  size?: string;
  usage?: unknown;
};

type PartialArtwork = {
  b64Json: string;
  partialImageIndex?: number;
};

type ArtworkPage = {
  assetVersion: string;
  countrySlug: string;
  id: string;
  imageUrl: string;
  nodeId?: string;
  plan: {
    pageType?: string;
    title?: string;
  };
  sceneId?: string;
  status: "ready";
};

type ArtworkWorkerDependencies = {
  configuredImageProvider: {
    generate: (input: {
      model: string;
      onPartialImage: (
        partial: PartialArtwork
      ) => Promise<void>;
      prompt: string;
      quality?: string;
      signal: AbortSignal;
    }) => Promise<GeneratedArtwork>;
    model: string;
    provider: string;
  };
  ensurePageUnderstanding: (
    page: ArtworkPage
  ) => Promise<unknown>;
  environmentPlanQueue: {
    queuePlan: (input: {
      jobPath: string;
      page: ArtworkPage;
      paths: RuntimeCachePaths;
    }) => unknown;
  };
  getCountrySlugForJob: (job: ArtworkJob) => string;
  imageConfig: {
    outputCompression?: number;
    outputFormat: string;
    quality?: string;
  };
  jobPolicy: {
    isTransientGenerationError: (error: unknown) => boolean;
    shouldQueueEnvironmentPlanForJobKind: (
      jobKind: string
    ) => boolean;
  };
  jobRepository: ArtworkJobRepository;
  logger?: Pick<Console, "error">;
  requestProcessing: () => unknown;
  runtimeCacheRoot: string;
};

export function createArtworkJobWorker({
  runtimeCacheRoot,
  imageConfig,
  configuredImageProvider,
  jobRepository,
  environmentPlanQueue,
  jobPolicy,
  getCountrySlugForJob,
  ensurePageUnderstanding,
  requestProcessing,
  logger = console
}: ArtworkWorkerDependencies) {
  const processingJobs = new Map<string, string>();
  const processingJobRuns = new Map<string, Promise<void>>();
  const processingJobAbortControllers =
    new Map<string, AbortController>();
  const cancelledJobs = new Set<string>();

  function run(
    jobPath: string,
    job: ArtworkJob
  ): Promise<void> {
    const activeRun = processJob(jobPath, job);
    processingJobRuns.set(jobPath, activeRun);
    activeRun
      .catch((error) => {
        logger.error("Image job processing failed:", error);
      })
      .finally(() => {
        if (processingJobRuns.get(jobPath) === activeRun) {
          processingJobRuns.delete(jobPath);
        }
      });
    return activeRun;
  }

  async function processJob(
    jobPath: string,
    job: ArtworkJob
  ): Promise<void> {
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
          const currentStatus = currentJob?.status;
          if (
            currentJob?.assetVersion !== job.assetVersion ||
            cancelledJobs.has(jobPath) ||
            !processingJobs.has(jobPath) ||
            typeof currentStatus !== "string" ||
            !["processing_openai_image", "partial_ready"].includes(
              currentStatus
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
        typeof currentJob?.jobKind === "string"
          ? currentJob.jobKind
          : processingJob.jobKind ?? "prewarm";
      const shouldQueueEnvironment =
        jobPolicy.shouldQueueEnvironmentPlanForJobKind(completedJobKind);
      const readyPage: ArtworkPage = {
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
        partialImageUrl: firstPartialAt ? paths.partialImageUrl : undefined,
        source: `${
          generated.provider ?? configuredImageProvider.provider
        }-image-api`,
        imageProvider: generated.provider ?? configuredImageProvider.provider,
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
          retryAfterMs(error)
        )
      );
      await jobRepository.writeJob(jobPath, {
        ...(currentJob?.assetVersion === job.assetVersion
          ? currentJob
          : processingJob),
        countrySlug,
        status: retryable ? "pending_codex_image_generation" : "failed",
        error: errorMessage(error),
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

  function cancelForCountry(
    countryCacheRoot: string
  ): Promise<void>[] {
    const activeRuns: Promise<void>[] = [];
    for (const jobPath of processingJobs.keys()) {
      if (isPathInside(countryCacheRoot, path.normalize(jobPath))) {
        cancelledJobs.add(jobPath);
        processingJobAbortControllers.get(jobPath)?.abort(
          new Error(
            "Image generation cancelled because its country runtime cache was flushed."
          )
        );
        const activeRun = processingJobRuns.get(jobPath);
        if (activeRun) activeRuns.push(activeRun);
      }
    }
    jobRepository.clearTerminalUnder(countryCacheRoot);
    return activeRuns;
  }

  function assertWritable(jobPath: string): void {
    if (cancelledJobs.has(jobPath)) {
      throw new Error(
        "Image generation cancelled because its runtime cache was flushed."
      );
    }
  }

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
  }: {
    countrySlug: string;
    firstPartialAt: string | null;
    generated: GeneratedArtwork;
    imageModel: string;
    imageWrittenAt: string;
    job: ArtworkJob;
    metadataPreparedAt: string;
    paths: RuntimeCachePaths;
    processingStartedAt: string;
    providerCompletedAt: string;
  }): Record<string, unknown> {
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
      quality: generated.quality ?? job.imageQuality ?? imageConfig.quality,
      outputFormat: generated.outputFormat ?? imageConfig.outputFormat,
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
      factBoundary: "Generated image is visual only and is not a fact source."
    };
  }

  return {
    processingJobs,
    run,
    cancelForCountry,
    assertWritable
  };
}

function retryAfterMs(error: unknown): number {
  if (
    typeof error !== "object" ||
    error === null ||
    !("retryAfterMs" in error)
  ) {
    return 0;
  }
  return Number(error.retryAfterMs) || 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
