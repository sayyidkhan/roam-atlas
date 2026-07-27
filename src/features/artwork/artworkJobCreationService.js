import { normalizeImageModel } from "../../domain/imageProvider.js";
import { createRuntimeCachePaths } from "../../domain/runtimeCache.js";

export function createArtworkJobCreationService({
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
}) {
  const activeCountryJobCreations = new Map();

  async function createImageJob(page, options = {}) {
    const countrySlug = getCountrySlugForPage(page);
    const release = await beginCountryJobCreation(countrySlug);
    try {
      const result = await createImageJobUnlocked(page, options);
      if (getCountryCacheFlushRun(countrySlug)) {
        const error = new Error(
          `Runtime cache flush in progress for ${countrySlug}; retry artwork after it completes.`
        );
        error.statusCode = 409;
        throw error;
      }
      return result;
    } finally {
      release();
    }
  }

  async function beginCountryJobCreation(countrySlug) {
    let flushRun = getCountryCacheFlushRun(countrySlug);
    while (flushRun) {
      await flushRun;
      flushRun = getCountryCacheFlushRun(countrySlug);
    }
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    });
    const active = activeCountryJobCreations.get(countrySlug) ?? new Set();
    active.add(done);
    activeCountryJobCreations.set(countrySlug, active);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active.delete(done);
      if (active.size === 0) activeCountryJobCreations.delete(countrySlug);
      resolveDone();
    };
  }

  async function createImageJobUnlocked(
    page,
    {
      jobKind = "interactive",
      imageQuality = imageConfig.quality
    } = {}
  ) {
    const imageModel = configuredImageProvider.model;
    imageQuality = configuredImageProvider.normalizeQuality(imageQuality);
    const countrySlug = getCountrySlugForPage(page);
    const prompt = page.plan?.imagePrompt;
    const assetVersion = jobPolicy.createAssetVersion(page, {
      imageModel,
      prompt,
      imageQuality
    });
    const paths = createRuntimeCachePaths({
      cacheRoot: runtimeCacheRoot,
      pageId: page.id,
      imageModel,
      countrySlug,
      outputFormat: imageConfig.outputFormat,
      variantKey: assetVersion
    });
    const jobPath = paths.jobPath;
    const jobUrl = paths.jobUrl;

    const existingJob = await jobRepository.readJob(jobPath);
    const cachedImageAvailable = await jobRepository.isFileAvailable(
      paths.imagePath
    );
    const existingMatchesRequest =
      existingJob?.prompt === prompt &&
      existingJob?.assetVersion === assetVersion &&
      normalizeImageModel(
        existingJob?.requestedImageModel ??
        existingJob?.imageModel ??
        imageModel
      ) === normalizeImageModel(imageModel);

    if (
      existingMatchesRequest &&
      existingJob?.status === "ready" &&
      existingJob.imageUrl &&
      cachedImageAvailable
    ) {
      return reuseReadyImage({
        page,
        countrySlug,
        assetVersion,
        imageUrl: existingJob.imageUrl,
        jobKind,
        jobPath,
        jobUrl,
        paths,
        source: existingJob.source ?? "image-cache"
      });
    }

    const existingMetadata = await jobRepository.readMetadata(
      paths.metadataPath
    );
    const metadataMatchesRequest =
      existingMetadata?.prompt === prompt &&
      existingMetadata?.assetVersion === assetVersion &&
      normalizeImageModel(
        existingMetadata?.requestedImageModel ??
        existingMetadata?.imageModel ??
        imageModel
      ) === normalizeImageModel(imageModel) &&
      existingMetadata.imageUrl &&
      cachedImageAvailable;
    if (metadataMatchesRequest) {
      return reuseMetadataImage({
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
      });
    }

    if (
      existingMatchesRequest &&
      [
        "pending_codex_image_generation",
        "processing_openai_image",
        "partial_ready"
      ].includes(existingJob?.status)
    ) {
      return promoteExistingJob({
        page,
        countrySlug,
        assetVersion,
        existingJob,
        jobKind,
        jobPath,
        jobUrl
      });
    }

    await jobRepository.writeJob(jobPath, {
      pageId: page.id,
      countrySlug,
      assetVersion,
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      parentId: page.parentId,
      parentClick: page.parentClick,
      status: "pending_codex_image_generation",
      jobKind,
      autoProcess: configuredImageProvider.canAutoProcess,
      imageModel,
      imageQuality,
      prompt,
      title: page.plan?.title,
      pageType: page.plan?.pageType,
      cacheKind: "runtime",
      factBoundary:
        "Generated image is visual only and is not a fact source.",
      createdAt: new Date().toISOString()
    });
    if (jobKind === "interactive") requestProcessing();

    return {
      ...page,
      countrySlug,
      assetVersion,
      status: "pending_codex_image_generation",
      generated: {
        source: "image-generation-required",
        jobUrl,
        assetVersion,
        factBoundary:
          "Generated fallback art is visual only and is not a fact source."
      }
    };
  }

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
  }) {
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
  }) {
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
    const source = `${existingMetadata.imageProvider ??
      configuredImageProvider.provider}-image-api`;
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
      factBoundary:
        "Generated image is visual only and is not a fact source.",
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
  }) {
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

  function waitForCountryCreations(countrySlug) {
    return Promise.allSettled([
      ...(activeCountryJobCreations.get(countrySlug) ?? [])
    ]);
  }

  return { createImageJob, waitForCountryCreations };

  function queueEnvironmentPlanWhenNeeded({
    environmentPlan,
    jobKind,
    readyPage,
    paths,
    jobPath
  }) {
    if (
      !environmentPlan &&
      jobPolicy.shouldQueueEnvironmentPlanForJobKind(jobKind)
    ) {
      environmentPlanQueue.queuePlan({ page: readyPage, paths, jobPath });
    }
  }

  function environmentStatus(environmentPlan, jobKind) {
    return environmentPlan?.status ??
      (jobPolicy.shouldQueueEnvironmentPlanForJobKind(jobKind)
        ? "pending"
        : "deferred");
  }
}

function createReadyPage({
  page,
  countrySlug,
  assetVersion,
  imageUrl
}) {
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
}) {
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
      environmentStatus: environmentPlan?.status ??
        (jobKind === "prefetch" ? "deferred" : "pending"),
      reused: true,
      factBoundary:
        "Generated image is visual only and is not a fact source."
    }
  };
}
