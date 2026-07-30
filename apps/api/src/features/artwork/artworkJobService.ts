import {
  isStaleProcessingImageJob,
  selectImageJobsForProcessing,
  shouldQueueDefaultArtwork
} from "./artworkQueuePolicy.ts";
import {
  createArtworkJobCreationService,
  type ArtworkCreationPage
} from "./artworkJobCreationService.ts";
import {
  createArtworkJobWorker
} from "./artworkJobWorker.ts";
import type {
  CompiledCountryPack
} from "../../data/countryPacks/serverRegistry.ts";
import type {
  createArtworkJobPolicy
} from "./artworkJobProcessingPolicy.ts";
import type {
  ArtworkJobRecord,
  ArtworkJobRepository
} from "./artworkJobRepository.ts";
import type {
  createConfiguredImageProvider
} from "./configuredImageProvider.ts";
import type {
  EnvironmentPlanQueue
} from "./environmentPlanQueue.ts";

type ArtworkServiceJob =
  ArtworkJobRecord & {
    assetVersion: string;
    attemptCount?: number;
    createdAt?: string;
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
    recoveryCount?: number;
    retryNotBefore?: string | null;
    sceneId?: string;
    status?: string;
    title?: string;
    updatedAt?: string;
  };

type ArtworkJobServiceDependencies = {
  configuredImageProvider: ReturnType<
    typeof createConfiguredImageProvider
  >;
  countryPacks: Record<
    string,
    CompiledCountryPack
  >;
  ensurePageUnderstanding: (
    page: ArtworkCreationPage
  ) => Promise<unknown>;
  environmentPlanQueue: EnvironmentPlanQueue;
  experienceConfig: {
    interactiveReservedSlots: number;
    providerConcurrency: number;
  };
  getCountryCacheFlushRun: (
    countrySlug: string
  ) => PromiseLike<unknown> | null | undefined;
  getCountrySlugForJob: (
    job: ArtworkServiceJob
  ) => string;
  getCountrySlugForPage: (
    page: ArtworkCreationPage
  ) => string;
  imageConfig: {
    outputCompression?: number;
    outputFormat: string;
    quality: string;
  };
  isPathBeingFlushed: (
    jobPath: string
  ) => boolean;
  jobPolicy: ReturnType<
    typeof createArtworkJobPolicy
  >;
  jobRepository: ArtworkJobRepository;
  listDefaultPages: (
    pack: CompiledCountryPack
  ) => ArtworkCreationPage[];
  logger?: Pick<Console, "error" | "log">;
  runtimeCacheRoot: string;
};

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
}: ArtworkJobServiceDependencies) {
  let scanPromise: Promise<void> | null = null;
  let rescanRequested = false;
  const jobWorker = createArtworkJobWorker({
    runtimeCacheRoot,
    imageConfig,
    configuredImageProvider,
    jobRepository,
    environmentPlanQueue,
    jobPolicy,
    getCountrySlugForJob,
    ensurePageUnderstanding,
    requestProcessing,
    logger
  });
  const creationService =
    createArtworkJobCreationService({
      runtimeCacheRoot,
      imageConfig,
      configuredImageProvider,
      jobRepository,
      environmentPlanQueue,
      jobPolicy,
      processingJobs:
        jobWorker.processingJobs,
      getCountrySlugForPage,
      ensurePageUnderstanding,
      getCountryCacheFlushRun,
      requestProcessing
    });

  function start(): void {
    if (
      !configuredImageProvider.isConfigured
    ) {
      logger.log(
        "RoamAtlas image job processor idle: no image provider key is configured."
      );
      return;
    }
    if (
      experienceConfig.providerConcurrency === 0
    ) {
      logger.log(
        "RoamAtlas image job processor disabled: provider concurrency is 0."
      );
      return;
    }

    logger.log(
      `RoamAtlas image job processor enabled with ${configuredImageProvider.provider}.`
    );
    const initialQueue =
      shouldQueueDefaultArtwork()
        ? queueDefaultArtworkJobs()
        : Promise.resolve();
    if (!shouldQueueDefaultArtwork()) {
      logger.log(
        "RoamAtlas default artwork pre-generation skipped. Set ROAMATLAS_LOAD_COUNTRY_PACK_EARLY=true to enable it."
      );
    }
    initialQueue
      .then(requestProcessing)
      .catch((error) => {
        logger.error(
          "Initial image job processing failed:",
          error
        );
      });
    setInterval(requestProcessing, 3000);
  }

  function requestProcessing():
  Promise<void> | null {
    if (
      !configuredImageProvider.canAutoProcess
    ) {
      return null;
    }
    if (scanPromise) {
      rescanRequested = true;
      return scanPromise;
    }

    scanPromise = Promise.resolve()
      .then(processPendingJobs)
      .catch((error) => {
        logger.error(
          "Image job processing failed:",
          error
        );
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

  async function queueDefaultArtworkJobs():
  Promise<void> {
    for (const pack of Object.values(
      countryPacks
    )) {
      const pages = listDefaultPages(pack);
      for (const page of pages) {
        await creationService.createImageJob(
          page,
          { jobKind: "prewarm" }
        );
      }
    }
  }

  async function processPendingJobs():
  Promise<void> {
    const jobs: Array<{
      fileName: string;
      job: ArtworkServiceJob;
      jobPath: string;
    }> = [];
    for (const {
      fileName,
      jobPath
    } of await jobRepository.listJobFiles()) {
      if (
        jobRepository.isTerminal(jobPath)
      ) {
        continue;
      }
      const storedJob =
        await jobRepository.readJob(jobPath);
      if (
        storedJob?.status === "ready" ||
        storedJob?.status === "failed"
      ) {
        jobRepository.markTerminal(
          jobPath,
          storedJob.status
        );
        continue;
      }
      if (!isArtworkServiceJob(storedJob)) {
        continue;
      }
      let job = storedJob;
      if (
        isStaleProcessingImageJob(job) &&
        !jobWorker.processingJobs.has(jobPath)
      ) {
        job = {
          ...job,
          status:
            "pending_codex_image_generation",
          recoveredAt:
            new Date().toISOString(),
          recoveryCount:
            (job.recoveryCount ?? 0) + 1,
          lastRecoveryReason:
            "processing lease expired after a server interruption"
        };
        await jobRepository.writeJob(
          jobPath,
          job
        );
      }
      jobs.push({
        fileName,
        jobPath,
        job
      });
    }

    const eligibleJobs = jobs.filter(
      ({ jobPath, job }) =>
        jobPolicy.shouldProcessJob({
          job,
          jobPath,
          processingJobs:
            jobWorker.processingJobs,
          isPathBeingFlushed
        })
    );
    const selectedJobs =
      selectImageJobsForProcessing({
        jobs: eligibleJobs,
        runningJobKinds:
          jobWorker.processingJobs.values(),
        providerConcurrency:
          experienceConfig.providerConcurrency,
        interactiveReservedSlots:
          experienceConfig.interactiveReservedSlots
      });

    for (const {
      jobPath,
      job
    } of selectedJobs) {
      jobWorker.run(jobPath, job);
    }
  }

  return {
    createImageJob:
      creationService.createImageJob,
    start,
    requestProcessing,
    cancelForCountry:
      jobWorker.cancelForCountry,
    waitForCountryCreations:
      creationService.waitForCountryCreations,
    assertWritable: jobWorker.assertWritable
  };
}

function isArtworkServiceJob(
  value: ArtworkJobRecord | null
): value is ArtworkServiceJob {
  return Boolean(
    value &&
      typeof value.pageId === "string" &&
      typeof value.assetVersion ===
        "string" &&
      typeof value.prompt === "string"
  );
}
