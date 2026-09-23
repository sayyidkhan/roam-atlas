import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { getSceneArtwork } from "./data/sceneArtwork.ts";
import { createConfiguredImageProvider } from "./features/artwork/configuredImageProvider.ts";
import { createArtworkJobPolicy } from "./features/artwork/artworkJobProcessingPolicy.ts";
import { createArtworkJobRepository } from "./features/artwork/artworkJobRepository.ts";
import { createArtworkJobService } from "./features/artwork/artworkJobService.ts";
import { createCountryArtworkQualityLockService } from "./features/artwork/countryArtworkQualityLockService.ts";
import { createEnvironmentPlanQueue } from "./features/artwork/environmentPlanQueue.ts";
import { createArtworkRoutes } from "./features/artwork/artworkHttpHandler.ts";
import { createArtworkQualityLockRoutes } from "./features/artwork/artworkQualityLockHttpHandler.ts";
import { createRuntimeArtworkContext } from "./features/artwork/runtimeArtworkContext.ts";
import { createConfirmedExplorerPackResolver } from "./features/countryCatalog/confirmedExplorerPack.ts";
import { createCountryPackRoutes } from "./features/countryCatalog/countryPackHttpHandler.ts";
import { createCountryDraftRepository } from "./features/countryDraft/countryDraftRepository.ts";
import { createCountryDraftFeature } from "./features/countryDraft/countryDraftFeature.ts";
import { createCountryImageService } from "./features/countryImages/countryImageService.ts";
import { createCountryImageRoutes } from "./features/countryImages/countryImageHttpHandler.ts";
import { createCountryImageRepository } from "./features/countryImages/countryImageRepository.ts";
import { createClickResolutionFeature } from "./features/explorer/clickResolutionFeature.ts";
import { createClickResolutionRoutes } from "./features/explorer/clickResolutionHttpHandler.ts";
import { createPlaceImageFeature } from "./features/placeImages/placeImageFeature.ts";
import { createPlaceImageRoutes } from "./features/placeImages/placeImageHttpHandler.ts";
import { resolvePlaceWikipediaImage } from "./features/placeImages/wikipediaPlaceImageProvider.ts";
import { createRuntimeArtifactRoutes } from "./features/runtimeCache/runtimeArtifactHttpHandler.ts";
import { createRuntimeCacheRoutes } from "./features/runtimeCache/runtimeCacheHttpHandler.ts";
import { createRuntimeCacheRepository } from "./features/runtimeCache/runtimeCacheRepository.ts";
import { createRuntimeCacheService } from "./features/runtimeCache/runtimeCacheService.ts";
import { createUsageRoutes } from "./features/usage/usageHttpHandler.ts";
import { createUsageService } from "./features/usage/usageService.ts";
import { createExperienceConfigRoutes } from "./features/experience/experienceConfigHttpHandler.ts";
import { createCountryDraftRoutes } from "./features/countryDraft/countryDraftHttpHandler.ts";
import { createEnvironmentPlanServerPolicy } from "./features/explorer/environmentPlanServerPolicy.ts";
import { createOpenAIEnvironmentPlanner } from "./features/explorer/openAIEnvironmentPlanner.ts";
import { createOpenAIClickResolver } from "./features/explorer/openAIClickResolver.ts";
import {
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "./data/defaultArtworkPages.ts";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  getCountryPack,
  isSourceControlledCountryPack
} from "./data/countryPacks/serverRegistry.ts";
import { getCountryBySlug } from "@roamatlas/data/countries.js";
import { resolveRoamAtlasConfig } from "./config/roamAtlasConfig.ts";
import { resolveRoamAtlasExperienceConfig } from "@roamatlas/data/experienceConfig.js";
import {
  DEFAULT_RUNTIME_COUNTRY_SLUG,
  RUNTIME_CACHE_URL_PREFIX,
  resolveRuntimeCacheRoot
} from "./domain/runtimeCache.ts";
import { buildEnvironmentPlanPrompt } from "@roamatlas/prompts/buildEnvironmentPlanPrompt.js";
import { loadLocalEnv } from "./platform/env/loadLocalEnv.ts";
import {
  extractOpenAIText,
  parseJsonObject
} from "./platform/openai/responseParsing.ts";
import { createRuntimeArtifactPathResolver } from "./platform/runtime/runtimeCacheFiles.ts";
import { createRoamAtlasApi } from "./server/createRoamAtlasApi.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
loadLocalEnv(path.join(root, ".env"));
const appConfig = resolveRoamAtlasConfig(process.env);
const appExperienceConfig = resolveRoamAtlasExperienceConfig(process.env);
const port = appConfig.server.port;
const runtimeCacheRoot = resolveRuntimeCacheRoot();
const usageService = createUsageService({ runtimeCacheRoot });
const getImagePathFromUrl = createRuntimeArtifactPathResolver({
  repositoryRoot: root,
  runtimeCacheRoot,
  runtimeCacheUrlPrefix: RUNTIME_CACHE_URL_PREFIX
});
const resolveConfirmedExplorerPack = createConfirmedExplorerPackResolver({
  getCountryBySlug,
  readStoredDraft: createCountryDraftRepository({
    cacheRoot: runtimeCacheRoot
  }).read
});
const confirmedExplorerPackCache = new Map<
  string,
  NonNullable<Awaited<ReturnType<typeof resolveConfirmedExplorerPack>>>
>();

async function resolveCachedConfirmedExplorerPack(
  countrySlug: string
) {
  const pack = await resolveConfirmedExplorerPack(countrySlug);
  if (pack) confirmedExplorerPackCache.set(countrySlug, pack);
  return pack;
}

function getExplorerCountryPack(countrySlug: string) {
  return confirmedExplorerPackCache.get(countrySlug) ?? getCountryPack(countrySlug);
}

const {
  getCountryPackForPage,
  getCountrySlugForPage: getRuntimeCountrySlugForPage,
  getCountrySlugForJob: getRuntimeCountrySlugForJob,
  resolveAssetVersionForPage
} = createRuntimeArtworkContext({
  defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
  defaultRuntimeCountrySlug: DEFAULT_RUNTIME_COUNTRY_SLUG,
  runtimeCacheUrlPrefix: RUNTIME_CACHE_URL_PREFIX,
  getCountryPack: getExplorerCountryPack
});
const resolveClickPhraseWithOpenAI = createOpenAIClickResolver({
  apiKey: process.env.OPENAI_API_KEY,
  model: appConfig.ai.vlmModel,
  recordUsage: usageService.record,
  serviceTier: appConfig.ai.serviceTier,
  defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
  getCountryPack: getExplorerCountryPack,
  getSceneArtwork,
  getImagePathFromUrl
});
const {
  getPromptContext: getEnvironmentPromptContext,
  hasExpectedTargets: hasExpectedEnvironmentTargets,
  normalizePlan: normalizeEnvironmentPlan,
  createFallback: createEnvironmentFallbackPlan
} = createEnvironmentPlanServerPolicy({
  getCountryPackForPage,
  getRuntimeCountrySlugForPage
});
const createEnvironmentPlanWithOpenAI = createOpenAIEnvironmentPlanner({
  apiKey: process.env.OPENAI_API_KEY,
  model: appConfig.ai.environmentModel,
  recordUsage: usageService.record,
  serviceTier: appConfig.ai.serviceTier,
  getImagePathFromUrl,
  buildPrompt: buildEnvironmentPlanPrompt,
  getPromptContext: getEnvironmentPromptContext,
  normalizePlan: normalizeEnvironmentPlan,
  createFallback: createEnvironmentFallbackPlan
});
const configuredImageProvider = createConfiguredImageProvider({
  apiKey: process.env.OPENAI_API_KEY,
  imageConfig: appConfig.image,
  providerConcurrency: appExperienceConfig.providerConcurrency,
  recordUsage: usageService.record
});
const normalizeRequestedImageQuality = configuredImageProvider.normalizeQuality;
const {
  handleResolveClick,
  handleFlipbookClick,
  ensurePageUnderstanding
} = createClickResolutionFeature({
  defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
  resolveClickPhrase: resolveClickPhraseWithOpenAI,
  getCountryPackForPage,
  getCountrySlugForPage: getRuntimeCountrySlugForPage,
  resolveAssetVersionForPage,
  createImageJob: (
    ...args: Parameters<
      ReturnType<typeof createArtworkJobService>["createImageJob"]
    >
  ) => artworkJobService.createImageJob(...args),
  normalizeImageQuality: normalizeRequestedImageQuality,
  runtimeCacheRoot,
  imageModel: configuredImageProvider.model,
  outputFormat: appConfig.image.outputFormat
});
const countryImageService = createCountryImageService({
  repository: createCountryImageRepository({
    storageDirectory: path.join(runtimeCacheRoot, "country-cards"),
    urlPrefix: `${RUNTIME_CACHE_URL_PREFIX}/country-cards`
  })
});
const {
  handlers: placeImageHttpHandlers,
  clearRuntimeMemory: clearPlaceImageRuntimeMemory
} = createPlaceImageFeature({
  cacheRoot: runtimeCacheRoot,
  getImagePathFromUrl,
  getCountryBySlug,
  getCountryPack,
  resolveWikipediaImage: resolvePlaceWikipediaImage,
  apiKeys: {
    exa: process.env.EXA_API_KEY,
    openai: process.env.OPENAI_API_KEY
  },
  textModel: appConfig.ai.textModel,
  recordUsage: usageService.record,
  serviceTier: appConfig.ai.serviceTier,
  extractOpenAIText,
  parseJsonObject
});
const {
  handlers: countryDraftHttpHandlers,
  clearRuntimeMemory: clearCountryDraftRuntimeMemory
} = createCountryDraftFeature({
  cacheRoot: runtimeCacheRoot,
  getCountryBySlug,
  getCountryPack,
  isSourceControlledCountryPack,
  apiKeys: {
    exa: process.env.EXA_API_KEY,
    openai: process.env.OPENAI_API_KEY
  },
  textModel: appConfig.ai.textModel,
  recordUsage: usageService.record,
  serviceTier: appConfig.ai.serviceTier,
});
const artworkJobPolicy = createArtworkJobPolicy({
  imageConfig: appConfig.image,
  getCountryPackForPage,
  normalizeImageQuality: normalizeRequestedImageQuality
});
const artworkJobRepository = createArtworkJobRepository({
  runtimeCacheRoot,
  assertJobWritable: (jobPath: string) =>
    artworkJobService?.assertWritable(jobPath)
});
const countryArtworkQualityLockService =
  createCountryArtworkQualityLockService({
    runtimeCacheRoot,
    jobRepository: artworkJobRepository,
    normalizeImageQuality: normalizeRequestedImageQuality
  });
const runtimeCacheService = createRuntimeCacheService({
  repository: createRuntimeCacheRepository({ runtimeCacheRoot }),
  waitForArtworkCreations: (countrySlug: string) =>
    artworkJobService.waitForCountryCreations(countrySlug),
  cancelArtworkForCountry: (countryCacheRoot: string) =>
    artworkJobService.cancelForCountry(countryCacheRoot),
  cancelEnvironmentForCountry: (countryCacheRoot: string) =>
    environmentPlanQueue.cancelForCountry(countryCacheRoot),
  clearArtworkRuntimeMemory: (countryCacheRoot: string) =>
    artworkJobRepository.clearTerminalUnder(countryCacheRoot),
  clearPlaceImageRuntimeMemory,
  clearCountryDraftRuntimeMemory
});
const environmentPlanQueue = createEnvironmentPlanQueue({
  jobRepository: artworkJobRepository,
  createEnvironmentPlan: createEnvironmentPlanWithOpenAI,
  createFallbackPlan: createEnvironmentFallbackPlan,
  hasExpectedTargets: hasExpectedEnvironmentTargets,
  isPathBeingFlushed: runtimeCacheService.isPathBeingFlushed
});
const artworkJobService = createArtworkJobService({
  countryArtworkQualityLockService,
  runtimeCacheRoot,
  imageConfig: appConfig.image,
  experienceConfig: appExperienceConfig,
  countryPacks,
  configuredImageProvider,
  jobRepository: artworkJobRepository,
  environmentPlanQueue,
  jobPolicy: artworkJobPolicy,
  getCountrySlugForPage: getRuntimeCountrySlugForPage,
  getCountrySlugForJob: getRuntimeCountrySlugForJob,
  listDefaultPages: listDefaultArtworkPages,
  ensurePageUnderstanding: (
    ...args: Parameters<typeof ensurePageUnderstanding>
  ) => ensurePageUnderstanding(...args),
  isPathBeingFlushed: runtimeCacheService.isPathBeingFlushed,
  getCountryCacheFlushRun: runtimeCacheService.getCountryFlushRun
});

const api = createRoamAtlasApi({
  routeRegistrars: [
    createRuntimeArtifactRoutes({
      runtimeCacheRoot,
      runtimeCacheUrlPrefix: RUNTIME_CACHE_URL_PREFIX
    }),
    createClickResolutionRoutes({
      handleResolveClick,
      handleFlipbookClick
    }),
    createArtworkRoutes({
      defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
      getCountryPack,
      resolveConfirmedExplorerPack: resolveCachedConfirmedExplorerPack,
      getDefaultArtworkPageForNode,
      getDefaultArtworkPageForScene,
      createImageJob: artworkJobService.createImageJob,
      normalizeImageQuality: normalizeRequestedImageQuality
    }),
    createArtworkQualityLockRoutes({
      defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
      getCountryPack,
      qualityLockService: countryArtworkQualityLockService
    }),
    createExperienceConfigRoutes({
      experienceConfig: appExperienceConfig,
      defaultImageQuality: appConfig.image.quality
    }),
    createUsageRoutes({
      readUsage: usageService.read
    }),
    createCountryImageRoutes({
      getCountryBySlug,
      resolveImage: countryImageService.resolveImage,
      isLocalImageUrl: countryImageService.isLocalImageUrl
    }),
    createPlaceImageRoutes(placeImageHttpHandlers),
    createCountryPackRoutes({
      countryPacks,
      defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
      resolveConfirmedExplorerPack: resolveCachedConfirmedExplorerPack
    }),
    createCountryDraftRoutes(countryDraftHttpHandlers),
    createRuntimeCacheRoutes({
      getCountryBySlug,
      flushVisualCache: runtimeCacheService.flushVisualCache,
      flushRuntimeCache: runtimeCacheService.flushRuntimeCache
    })
  ]
});

serve({
  fetch: api.fetch,
  port,
  hostname: appConfig.server.host
}, () => {
  console.log(`RoamAtlas API listening on http://${appConfig.server.host}:${port}`);
  console.log(`RoamAtlas runtime cache: ${runtimeCacheRoot}`);
  artworkJobService.start();
});
