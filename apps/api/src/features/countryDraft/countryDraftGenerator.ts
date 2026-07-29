import {
  buildCountryDraftInfluencePrompt,
  buildCountryDraftPrompt,
  createCountryDraftFallback,
  normalizeCountryDraftPayload,
  type CountryDraft,
  type CountryDraftCountry,
  type CountryDraftGenerationOptions,
  type CountryDraftGroundingSnippet
} from "@roamatlas/domain/countryDraft.js";

import type {
  CountryDraftProviderResult
} from "./openAICountryDraftProvider.ts";

type CountryDraftGeneratorOptions = {
  draftProvider: {
    generate: (
      prompt: string
    ) => Promise<CountryDraftProviderResult>;
    isConfigured: boolean;
    model: string;
  };
  groundingProvider: {
    search: (
      country: CountryDraftCountry
    ) => Promise<CountryDraftGroundingSnippet[]>;
  };
};

export type GenerateCountryDraftOptions = {
  appendOnlyRegionName?: string | null;
  currentDraft?: CountryDraft | null;
  instruction?: string | null;
};

export type GenerateCountryDraft = (
  country: CountryDraftCountry,
  options?: GenerateCountryDraftOptions
) => Promise<CountryDraft>;

export function createCountryDraftGenerator({
  groundingProvider,
  draftProvider
}: CountryDraftGeneratorOptions): GenerateCountryDraft {
  return async function generateCountryDraft(
    country,
    {
      instruction = null,
      currentDraft = null,
      appendOnlyRegionName = null
    } = {}
  ) {
    if (!draftProvider.isConfigured) {
      return createFallbackFromCurrent(
        country,
        "OPENAI_API_KEY is not configured.",
        currentDraft,
        {
          generationStatus:
            "provider_missing"
        }
      );
    }

    const groundingSnippets =
      await groundingProvider.search(country);
    const prompt = instruction
      ? buildCountryDraftInfluencePrompt({
          country,
          instruction,
          currentDraft,
          groundingSnippets,
          appendOnlyRegionName
        })
      : buildCountryDraftPrompt(country, {
          groundingSnippets
        });

    const result =
      await draftProvider.generate(prompt);
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

    return normalizeCountryDraftPayload(
      result.payload,
      country,
      {
        generationStatus: "ready",
        model: draftProvider.model,
        groundingSnippets
      }
    );
  };
}

function createFallbackFromCurrent(
  country: CountryDraftCountry,
  reason: string,
  currentDraft: CountryDraft | null,
  options: CountryDraftGenerationOptions = {}
): CountryDraft {
  if (currentDraft) {
    return normalizeCountryDraftPayload(
      currentDraft,
      country,
      {
        ...options,
        unavailableReason: reason
      }
    );
  }
  return createCountryDraftFallback(
    country,
    reason,
    options
  );
}
