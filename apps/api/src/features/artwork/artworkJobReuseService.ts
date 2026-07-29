interface ArtworkPage extends Record<string, unknown> {
  id: string;
  sceneId?: string | null;
  nodeId?: string | null;
  parentId?: string | null;
  parentClick?: unknown;
  plan?: {
    title?: string;
    pageType?: string;
  } | null;
}

interface ArtworkEnvironmentPlan {
  status?: string | null;
}

interface ArtworkRuntimePaths {
  environmentPath: string;
  environmentUrl: string;
  metadataUrl: string;
}

interface ArtworkMetadata {
  imageUrl: string;
  imageProvider?: string | null;
  imageModel?: string | null;
  requestedImageModel?: string | null;
  generatedAt?: string | null;
}

interface ExistingArtworkJob extends Record<string, unknown> {
  status: string;
  jobKind?: string | null;
  autoProcess?: boolean;
  partialImageUrl?: string | null;
}

interface ArtworkJobRepository {
  writeJob: (
    jobPath: string,
    job: Record<string, unknown>
  ) => Promise<unknown>;
}

interface EnvironmentPlanQueue {
  findMatchingPlan: (
    page: ArtworkPage,
    paths: ArtworkRuntimePaths
  ) => Promise<ArtworkEnvironmentPlan | null | undefined>;
  queuePlan: (input: {
    page: ArtworkPage;
    paths: ArtworkRuntimePaths;
    jobPath: string;
  }) => unknown;
}

interface ArtworkJobPolicy {
  chooseHigherPriorityJobKind: (
    existingJobKind: string | null | undefined,
    requestedJobKind: string
  ) => string;
  shouldQueueEnvironmentPlanForJobKind: (jobKind: string) => boolean;
}

interface ConfiguredImageProvider {
  provider: string;
  canAutoProcess: boolean;
}

interface ArtworkJobReuseServiceDependencies {
  configuredImageProvider: ConfiguredImageProvider;
  jobRepository: ArtworkJobRepository;
  environmentPlanQueue: EnvironmentPlanQueue;
  jobPolicy: ArtworkJobPolicy;
  processingJobs: Map<string, string>;
  ensurePageUnderstanding: (page: ArtworkPage) => Promise<unknown>;
  requestProcessing: () => unknown;
}

interface BaseReuseInput {
  page: ArtworkPage;
  countrySlug: string;
  assetVersion: string;
  jobKind: string;
  jobPath: string;
  jobUrl: string;
}

interface ReadyImageReuseInput extends BaseReuseInput {
  imageUrl: string;
  paths: ArtworkRuntimePaths;
  source: string;
}

interface MetadataImageReuseInput extends BaseReuseInput {
  imageModel: string;
  imageQuality: string;
  prompt: unknown;
  existingMetadata: ArtworkMetadata;
  paths: ArtworkRuntimePaths;
}

interface ExistingJobPromotionInput extends BaseReuseInput {
  existingJob: ExistingArtworkJob;
}

interface ReadyResponseInput {
  page: ArtworkPage;
  countrySlug: string;
  assetVersion: string;
  imageUrl: string;
  environmentPlan: ArtworkEnvironmentPlan | null | undefined;
  environmentUrl: string;
  jobKind: string;
  jobUrl: string;
  source: string;
}

export function createArtworkJobReuseService({
  configuredImageProvider,
  jobRepository,
  environmentPlanQueue,
  jobPolicy,
  processingJobs,
  ensurePageUnderstanding,
  requestProcessing
}: ArtworkJobReuseServiceDependencies) {
  async function reuseReadyImage({
    page,
    countrySlug,
    assetVersion,
    imageUrl,
    jobKind,
    jobPath,
    jobUrl,
    paths,
    source
  }: ReadyImageReuseInput) {
    const readyPage = createReadyPage({
      page,
      countrySlug,
      assetVersion,
      imageUrl
    });
    const environmentPlan = await environmentPlanQueue.findMatchingPlan(
      readyPage,
      paths
    );
    queueEnvironmentPlanWhenNeeded({
      environmentPlan,
      jobKind,
      readyPage,
      paths,
      jobPath
    });
    await ensurePageUnderstanding(readyPage);
    return createReadyResponse({
      page,
      countrySlug,
      assetVersion,
      imageUrl,
      environmentPlan,
      environmentUrl: paths.environmentUrl,
      jobKind,
      jobUrl,
      source
    });
  }

  async function reuseMetadataImage({
    page,
    countrySlug,
    assetVersion,
    imageModel,
    imageQuality,
    prompt,
    existingMetadata,
    jobKind,
    jobPath,
    jobUrl,
    paths
  }: MetadataImageReuseInput) {
    const readyPage = createReadyPage({
      page,
      countrySlug,
      assetVersion,
      imageUrl: existingMetadata.imageUrl
    });
    const environmentPlan = await environmentPlanQueue.findMatchingPlan(
      readyPage,
      paths
    );
    const source = `${
      existingMetadata.imageProvider ?? configuredImageProvider.provider
    }-image-api`;
    await jobRepository.writeJob(jobPath, {
      pageId: page.id,
      countrySlug,
      assetVersion,
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      parentId: page.parentId,
      parentClick: page.parentClick,
      status: "ready",
      jobKind,
      imageUrl: existingMetadata.imageUrl,
      source,
      imageProvider:
        existingMetadata.imageProvider ?? configuredImageProvider.provider,
      imageModel: existingMetadata.imageModel ?? imageModel,
      requestedImageModel:
        existingMetadata.requestedImageModel ?? imageModel,
      imageQuality,
      metadataUrl: paths.metadataUrl,
      environmentUrl: paths.environmentUrl,
      environmentStatus: environmentStatus(environmentPlan, jobKind),
      prompt,
      title: page.plan?.title,
      pageType: page.plan?.pageType,
      cacheKind: "runtime",
      factBoundary: "Generated image is visual only and is not a fact source.",
      reusedFromMetadata: true,
      completedAt: existingMetadata.generatedAt ?? new Date().toISOString()
    });
    queueEnvironmentPlanWhenNeeded({
      environmentPlan,
      jobKind,
      readyPage,
      paths,
      jobPath
    });
    await ensurePageUnderstanding(readyPage);
    return createReadyResponse({
      page,
      countrySlug,
      assetVersion,
      imageUrl: existingMetadata.imageUrl,
      environmentPlan,
      environmentUrl: paths.environmentUrl,
      jobKind,
      jobUrl,
      source
    });
  }

  async function promoteExistingJob({
    page,
    countrySlug,
    assetVersion,
    existingJob,
    jobKind,
    jobPath,
    jobUrl
  }: ExistingJobPromotionInput) {
    const promotedJobKind = jobPolicy.chooseHigherPriorityJobKind(
      existingJob.jobKind,
      jobKind
    );
    if (
      configuredImageProvider.canAutoProcess &&
      existingJob.autoProcess !== true
    ) {
      await jobRepository.writeJob(jobPath, {
        ...existingJob,
        jobKind: promotedJobKind,
        autoProcess: true,
        updatedAt: new Date().toISOString()
      });
    } else if (promotedJobKind !== existingJob.jobKind) {
      await jobRepository.writeJob(jobPath, {
        ...existingJob,
        jobKind: promotedJobKind,
        updatedAt: new Date().toISOString()
      });
    }
    if (processingJobs.has(jobPath)) {
      processingJobs.set(jobPath, promotedJobKind);
    }
    if (promotedJobKind === "interactive") requestProcessing();
    return {
      ...page,
      countrySlug,
      assetVersion,
      status: existingJob.status,
      partialImageUrl: existingJob.partialImageUrl,
      generated: {
        source: "image-generation-required",
        jobUrl,
        assetVersion,
        partialImageUrl: existingJob.partialImageUrl,
        reused: true,
        factBoundary:
          "Generated image is visual only and is not a fact source."
      }
    };
  }

  function queueEnvironmentPlanWhenNeeded({
    environmentPlan,
    jobKind,
    readyPage,
    paths,
    jobPath
  }: {
    environmentPlan: ArtworkEnvironmentPlan | null | undefined;
    jobKind: string;
    readyPage: ArtworkPage;
    paths: ArtworkRuntimePaths;
    jobPath: string;
  }): void {
    if (
      !environmentPlan &&
      jobPolicy.shouldQueueEnvironmentPlanForJobKind(jobKind)
    ) {
      environmentPlanQueue.queuePlan({ page: readyPage, paths, jobPath });
    }
  }

  function environmentStatus(
    environmentPlan: ArtworkEnvironmentPlan | null | undefined,
    jobKind: string
  ): string {
    return (
      environmentPlan?.status ??
      (jobPolicy.shouldQueueEnvironmentPlanForJobKind(jobKind)
        ? "pending"
        : "deferred")
    );
  }

  return { reuseReadyImage, reuseMetadataImage, promoteExistingJob };
}

function createReadyPage({
  page,
  countrySlug,
  assetVersion,
  imageUrl
}: {
  page: ArtworkPage;
  countrySlug: string;
  assetVersion: string;
  imageUrl: string;
}): ArtworkPage {
  return {
    ...page,
    countrySlug,
    assetVersion,
    imageUrl,
    status: "ready"
  };
}

function createReadyResponse({
  page,
  countrySlug,
  assetVersion,
  imageUrl,
  environmentPlan,
  environmentUrl,
  jobKind,
  jobUrl,
  source
}: ReadyResponseInput) {
  return {
    ...page,
    countrySlug,
    assetVersion,
    imageUrl,
    status: "ready",
    environmentUrl,
    generated: {
      source,
      jobUrl,
      assetVersion,
      environmentUrl,
      environmentStatus:
        environmentPlan?.status ??
        (jobKind === "prefetch" ? "deferred" : "pending"),
      reused: true,
      factBoundary: "Generated image is visual only and is not a fact source."
    }
  };
}
