import {
  buildCountryDraftInfluencePrompt,
  buildCountryDraftPrompt,
  createCountryDraftFallback,
  normalizeCountryDraftPayload
} from "@roamatlas/domain/countryDraft.js";

export function createCountryDraftGenerator({
  groundingProvider,
  draftProvider
}) {
  return async function generateCountryDraft(
    country,
    { instruction = null, currentDraft = null, appendOnlyRegionName = null } = {}
  ) {
    if (!draftProvider.isConfigured) {
      return createFallbackFromCurrent(
        country,
        "OPENAI_API_KEY is not configured.",
        currentDraft,
        { generationStatus: "provider_missing" }
      );
    }

    const groundingSnippets = await groundingProvider.search(country);
    const prompt = instruction
      ? buildCountryDraftInfluencePrompt({
          country,
          instruction,
          currentDraft,
          groundingSnippets,
          appendOnlyRegionName
        })
      : buildCountryDraftPrompt(country, { groundingSnippets });

    const result = await draftProvider.generate(prompt);
    if (result.status !== "ready") {
      return createFallbackFromCurrent(
        country,
        result.reason,
        currentDraft,
        {
          generationStatus: result.status,
          model: draftProvider.model
        }
      );
    }

    return normalizeCountryDraftPayload(result.payload, country, {
      generationStatus: "ready",
      model: draftProvider.model,
      groundingSnippets
    });
  };
}

function createFallbackFromCurrent(country, reason, currentDraft, options = {}) {
  if (currentDraft) {
    return normalizeCountryDraftPayload(currentDraft, country, {
      ...options,
      unavailableReason: reason
    });
  }
  return createCountryDraftFallback(country, reason, options);
}
