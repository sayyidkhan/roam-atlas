import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { getSceneArtwork } from "./data/sceneArtwork.js";
import { createConfiguredImageProvider } from "./features/artwork/configuredImageProvider.js";
import { createArtworkJobPolicy } from "./features/artwork/artworkJobProcessingPolicy.js";
import { createArtworkJobRepository } from "./features/artwork/artworkJobRepository.js";
import { createArtworkJobService } from "./features/artwork/artworkJobService.js";
import { createEnvironmentPlanQueue } from "./features/artwork/environmentPlanQueue.js";
import { createArtworkRoutes } from "./features/artwork/artworkHttpHandler.js";
import { createRuntimeArtworkContext } from "./features/artwork/runtimeArtworkContext.js";
import { createCountryPackRoutes } from "./features/countryCatalog/countryPackHttpHandler.js";
import { createCountryDraftFeature } from "./features/countryDraft/countryDraftFeature.js";
import { createCountryImageService } from "./features/countryImages/countryImageService.js";
import { createCountryImageRoutes } from "./features/countryImages/countryImageHttpHandler.js";
import { createCountryImageRepository } from "./features/countryImages/countryImageRepository.js";
import { createClickResolutionFeature } from "./features/explorer/clickResolutionFeature.js";
import { createClickResolutionRoutes } from "./features/explorer/clickResolutionHttpHandler.js";
import { createPlaceImageFeature } from "./features/placeImages/placeImageFeature.js";
import { createPlaceImageRoutes } from "./features/placeImages/placeImageHttpHandler.js";
import { resolvePlaceWikipediaImage } from "./features/placeImages/wikipediaPlaceImageProvider.js";
import { createRuntimeArtifactRoutes } from "./features/runtimeCache/runtimeArtifactHttpHandler.js";
import { createRuntimeCacheRoutes } from "./features/runtimeCache/runtimeCacheHttpHandler.js";
import { createRuntimeCacheRepository } from "./features/runtimeCache/runtimeCacheRepository.js";
import { createRuntimeCacheService } from "./features/runtimeCache/runtimeCacheService.js";
import { createExperienceConfigRoutes } from "./features/experience/experienceConfigHttpHandler.js";
import { createCountryDraftRoutes } from "./features/countryDraft/countryDraftHttpHandler.js";
import { createEnvironmentPlanServerPolicy } from "./features/explorer/environmentPlanServerPolicy.js";
import { createOpenAIEnvironmentPlanner } from "./features/explorer/openAIEnvironmentPlanner.js";
import { createOpenAIClickResolver } from "./features/explorer/openAIClickResolver.js";
import {
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  listDefaultArtworkPages
} from "./data/defaultArtworkPages.js";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  getCountryPack,
  isSourceControlledCountryPack
} from "./data/countryPacks/serverRegistry.js";
import { getCountryBySlug } from "@roamatlas/data/countries.js";
import { resolveRoamAtlasConfig } from "./config/roamAtlasConfig.js";
import { resolveRoamAtlasExperienceConfig } from "@roamatlas/data/experienceConfig.js";
import {
  DEFAULT_RUNTIME_COUNTRY_SLUG,
  RUNTIME_CACHE_URL_PREFIX,
  resolveRuntimeCacheRoot
} from "./domain/runtimeCache.js";
import { buildEnvironmentPlanPrompt } from "@roamatlas/prompts/buildEnvironmentPlanPrompt.js";
import { loadLocalEnv } from "./platform/env/loadLocalEnv.js";
import {
  extractOpenAIText,
  parseJsonObject
} from "./platform/openai/responseParsing.js";
import { createRuntimeArtifactPathResolver } from "./platform/runtime/runtimeCacheFiles.js";
import { createRoamAtlasApi } from "./server/createRoamAtlasApi.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
loadLocalEnv(path.join(root, ".env"));
const appConfig = resolveRoamAtlasConfig(process.env);
const appExperienceConfig = resolveRoamAtlasExperienceConfig(process.env);
const port = appConfig.server.port;
const runtimeCacheRoot = resolveRuntimeCacheRoot();
const getImagePathFromUrl = createRuntimeArtifactPathResolver({
  repositoryRoot: root,
  runtimeCacheRoot,
  runtimeCacheUrlPrefix: RUNTIME_CACHE_URL_PREFIX
});
const {
  getCountryPackForPage,
  getCountrySlugForPage: getRuntimeCountrySlugForPage,
  getCountrySlugForJob: getRuntimeCountrySlugForJob,
  resolveAssetVersionForPage
} = createRuntimeArtworkContext({
  defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
  defaultRuntimeCountrySlug: DEFAULT_RUNTIME_COUNTRY_SLUG,
  runtimeCacheUrlPrefix: RUNTIME_CACHE_URL_PREFIX,
  getCountryPack
});
const resolveClickPhraseWithOpenAI = createOpenAIClickResolver({
  apiKey: process.env.OPENAI_API_KEY,
  model: appConfig.ai.vlmModel,
  defaultCountrySlug: DEFAULT_COUNTRY_SLUG,
  getCountryPack,
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
  getImagePathFromUrl,
  buildPrompt: buildEnvironmentPlanPrompt,
  getPromptContext: getEnvironmentPromptContext,
  normalizePlan: normalizeEnvironmentPlan,
  createFallback: createEnvironmentFallbackPlan
});
const configuredImageProvider = createConfiguredImageProvider({
  apiKey: process.env.OPENAI_API_KEY,
  imageConfig: appConfig.image,
  providerConcurrency: appExperienceConfig.providerConcurrency
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
  textModel: appConfig.ai.textModel
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
      getDefaultArtworkPageForNode,
      getDefaultArtworkPageForScene,
      createImageJob: artworkJobService.createImageJob,
      normalizeImageQuality: normalizeRequestedImageQuality
    }),
    createExperienceConfigRoutes({
      experienceConfig: appExperienceConfig,
      defaultImageQuality: appConfig.image.quality
    }),
    createCountryImageRoutes({
      getCountryBySlug,
      resolveImage: countryImageService.resolveImage,
      isLocalImageUrl: countryImageService.isLocalImageUrl
    }),
    createPlaceImageRoutes(placeImageHttpHandlers),
    createCountryPackRoutes({
      countryPacks,
      defaultCountrySlug: DEFAULT_COUNTRY_SLUG
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
