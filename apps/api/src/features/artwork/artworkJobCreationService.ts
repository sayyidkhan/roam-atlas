import {
  normalizeImageModel
} from "../../domain/imageGenerationPolicy.ts";
import {
  createRuntimeCachePaths
} from "../../domain/runtimeCache.ts";
import {
  createArtworkJobCreationGuard
} from "./artworkJobCreationGuard.ts";
import {
  createArtworkJobReuseService
} from "./artworkJobReuseService.ts";
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
import type {
  CountryArtworkQualityLockService
} from "./countryArtworkQualityLockService.ts";

export type ArtworkCreationPage =
  Record<string, unknown> & {
    id: string;
    nodeId?: string | null;
    parentClick?: unknown;
    parentId?: string | null;
    plan?: {
      dataVersion?: string;
      imagePrompt?: string;
      pageType?: string;
      promptVersion?: string;
      styleVersion?: string;
      title?: string;
    } | null;
    sceneId?: string | null;
  };

export type ArtworkCreationOptions = {
  imageQuality?: string;
  jobKind?: string;
};

type ArtworkJobCreationDependencies = {
  countryArtworkQualityLockService: CountryArtworkQualityLockService;
  configuredImageProvider: ReturnType<
    typeof createConfiguredImageProvider
  >;
  ensurePageUnderstanding: (
    page: ArtworkCreationPage
  ) => Promise<unknown>;
  environmentPlanQueue: EnvironmentPlanQueue;
  getCountryCacheFlushRun: (
    countrySlug: string
  ) => PromiseLike<unknown> | null | undefined;
  getCountrySlugForPage: (
    page: ArtworkCreationPage
  ) => string;
  imageConfig: {
    outputFormat: string;
    quality: string;
  };
  jobPolicy: ReturnType<
    typeof createArtworkJobPolicy
  >;
  jobRepository: ArtworkJobRepository;
  processingJobs: Map<string, string>;
  requestProcessing: () => unknown;
  runtimeCacheRoot: string;
};

export function createArtworkJobCreationService({
  countryArtworkQualityLockService,
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
}: ArtworkJobCreationDependencies) {
  const creationGuard =
    createArtworkJobCreationGuard({
      getCountryCacheFlushRun
    });
  const {
    reuseReadyImage,
    reuseMetadataImage,
    promoteExistingJob
  } = createArtworkJobReuseService({
    configuredImageProvider,
    jobRepository,
    environmentPlanQueue,
    jobPolicy,
    processingJobs,
    ensurePageUnderstanding,
    requestProcessing
  });

  async function createImageJob(
    page: ArtworkCreationPage,
    options: ArtworkCreationOptions = {}
  ) {
    const countrySlug =
      getCountrySlugForPage(page);
    const release =
      await creationGuard.begin(countrySlug);
    try {
      const result =
        await createImageJobUnlocked(
          page,
          options
        );
      if (
        getCountryCacheFlushRun(countrySlug)
      ) {
        throw new ArtworkCreationConflictError(
          `Runtime cache flush in progress for ${countrySlug}; retry artwork after it completes.`
        );
      }
      return result;
    } finally {
      release();
    }
  }

  async function createImageJobUnlocked(
    page: ArtworkCreationPage,
    {
      jobKind = "interactive",
      imageQuality = imageConfig.quality
    }: ArtworkCreationOptions = {}
  ) {
    const imageModel =
      configuredImageProvider.model;
    imageQuality =
      configuredImageProvider.normalizeQuality(
        imageQuality
      );
    const countrySlug =
      getCountrySlugForPage(page);
    imageQuality =
      await countryArtworkQualityLockService.lockImageQuality(
        countrySlug,
        imageQuality
      );
    const prompt =
      page.plan?.imagePrompt ?? "";
    const assetVersion =
      jobPolicy.createAssetVersion(page, {
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
    const {
      jobPath,
      jobUrl
    } = paths;

    const existingJob =
      await jobRepository.readJob(jobPath);
    const cachedImageAvailable =
      await jobRepository.isFileAvailable(
        paths.imagePath
      );
    const existingMatchesRequest =
      existingJob?.prompt === prompt &&
      existingJob.assetVersion ===
        assetVersion &&
      normalizeImageModel(
        existingJob.requestedImageModel ??
          existingJob.imageModel ??
          imageModel
      ) === normalizeImageModel(imageModel);

    if (
      existingMatchesRequest &&
      existingJob?.status === "ready" &&
      typeof existingJob.imageUrl ===
        "string" &&
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
        source:
          typeof existingJob.source ===
          "string"
            ? existingJob.source
            : "image-cache"
      });
    }

    const existingMetadata =
      await jobRepository.readMetadata(
        paths.metadataPath
      );
    const metadataMatchesRequest =
      existingMetadata?.prompt === prompt &&
      existingMetadata.assetVersion ===
        assetVersion &&
      normalizeImageModel(
        existingMetadata.requestedImageModel ??
          existingMetadata.imageModel ??
          imageModel
      ) === normalizeImageModel(imageModel) &&
      typeof existingMetadata.imageUrl ===
        "string" &&
      cachedImageAvailable;
    if (
      metadataMatchesRequest &&
      isArtworkMetadata(existingMetadata)
    ) {
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
      isPromotableJob(existingJob)
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
      status:
        "pending_codex_image_generation",
      jobKind,
      autoProcess:
        configuredImageProvider.canAutoProcess,
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
    if (jobKind === "interactive") {
      requestProcessing();
    }

    return {
      ...page,
      countrySlug,
      assetVersion,
      status:
        "pending_codex_image_generation",
      generated: {
        source: "image-generation-required",
        jobUrl,
        assetVersion,
        factBoundary:
          "Generated fallback art is visual only and is not a fact source."
      }
    };
  }

  function waitForCountryCreations(
    countrySlug: string
  ): Promise<PromiseSettledResult<void>[]> {
    return creationGuard.waitForCountry(
      countrySlug
    );
  }

  return {
    createImageJob,
    waitForCountryCreations
  };
}

export type ArtworkJobCreationService =
  ReturnType<
    typeof createArtworkJobCreationService
  >;

type ArtworkMetadata =
  ArtworkJobRecord & {
    imageUrl: string;
  };

type PromotableArtworkJob =
  ArtworkJobRecord & {
    status: string;
  };

function isArtworkMetadata(
  value: ArtworkJobRecord | null
): value is ArtworkMetadata {
  return typeof value?.imageUrl === "string";
}

function isPromotableJob(
  value: ArtworkJobRecord | null
): value is PromotableArtworkJob {
  return (
    typeof value?.status === "string" &&
    [
      "pending_codex_image_generation",
      "processing_openai_image",
      "partial_ready"
    ].includes(value.status)
  );
}

class ArtworkCreationConflictError extends Error {
  readonly statusCode = 409;
}
