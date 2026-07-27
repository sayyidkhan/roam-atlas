import { normalizeCountryDraftPayload } from "../../domain/countryDraft.js";
import { createCountryDraftGenerator } from "./countryDraftGenerator.js";
import { createCountryDraftHttpHandlers } from "./countryDraftHttpHandler.js";
import { createCountryDraftPolicy } from "./countryDraftPolicy.js";
import { createCountryDraftRepository } from "./countryDraftRepository.js";
import { createExaCountryGroundingProvider } from "./exaCountryGroundingProvider.js";
import { createOpenAICountryDraftProvider } from "./openAICountryDraftProvider.js";

export function createCountryDraftFeature({
  cacheRoot,
  getCountryBySlug,
  getCountryPack,
  isSourceControlledCountryPack,
  apiKeys,
  textModel,
  fetchFn = fetch
}) {
  const cache = new Map();
  const repository = createCountryDraftRepository({ cacheRoot });
  const policy = createCountryDraftPolicy({
    getCountryPack,
    isSourceControlledCountryPack
  });
  const generateCountryDraft = createCountryDraftGenerator({
    groundingProvider: createExaCountryGroundingProvider({
      apiKey: apiKeys.exa,
      fetchFn
    }),
    draftProvider: createOpenAICountryDraftProvider({
      apiKey: apiKeys.openai,
      model: textModel,
      fetchFn
    })
  });

  async function readStoredCountryDraft(country) {
    const stored = await repository.read(country);
    if (!stored) return null;
    const draft = stored.draft ?? stored;
    if (
      draft?.mode === "curated_pack_snapshot" &&
      draft.countrySlug === country.slug
    ) {
      return policy.withFreshPackThemes(draft, country);
    }

    return normalizeCountryDraftPayload(draft, country, {
      generatedAt: stored.draft?.generatedAt ?? stored.generatedAt,
      model: stored.draft?.model ?? stored.model,
      generationStatus:
        stored.draft?.generationStatus ??
        stored.generationStatus ??
        "ready"
    });
  }

  async function writeStoredCountryDraft(country, draft) {
    return repository.write(
      country,
      policy.withFreshPackThemes(draft, country)
    );
  }

  const handlers = createCountryDraftHttpHandlers({
    getCountryBySlug,
    getCountryPack,
    isSourceControlledCountryPack,
    countryDraftCache: cache,
    readStoredCountryDraft,
    writeStoredCountryDraft,
    withFreshPackThemes: policy.withFreshPackThemes,
    generateCountryDraft,
    normalizeCurrentCountryDraft: policy.normalizeCurrentCountryDraft,
    createStarterMapConfirmation: policy.createStarterMapConfirmation,
    writeStoredCountryPromotion: repository.writePromotion
  });

  return {
    handlers,
    clearRuntimeMemory(countrySlug) {
      cache.delete(countrySlug);
    }
  };
}
