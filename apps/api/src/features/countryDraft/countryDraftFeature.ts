import {
  normalizeCountryDraftPayload,
  type CountryDraft,
  type CountryDraftCountry
} from "@roamatlas/domain/countryDraft.js";

import {
  createCountryDraftGenerator
} from "./countryDraftGenerator.ts";
import {
  createCountryDraftHttpHandlers
} from "./countryDraftHttpHandler.ts";
import {
  createCountryDraftPolicy
} from "./countryDraftPolicy.ts";
import {
  createCountryDraftRepository
} from "./countryDraftRepository.ts";
import type {
  RecordProviderUsage
} from "../usage/usageService.ts";
import {
  createExaCountryGroundingProvider
} from "./exaCountryGroundingProvider.ts";
import {
  createOpenAICountryDraftProvider
} from "./openAICountryDraftProvider.ts";

type CountryDraftFeatureOptions<
  CountryPack extends {
    confidence?: unknown;
  }
> = {
  apiKeys: {
    exa?: string;
    openai?: string;
  };
  cacheRoot: string;
  fetchFn?: typeof fetch;
  getCountryBySlug: (
    countrySlug: string
  ) => CountryDraftCountry | null | undefined;
  getCountryPack: (
    countrySlug: string
  ) => CountryPack | null | undefined;
  isSourceControlledCountryPack: (
    value:
      | string
      | CountryPack
      | null
      | undefined
  ) => boolean;
  recordUsage?: RecordProviderUsage;
  serviceTier?: "fast";
  textModel: string;
};

export function createCountryDraftFeature<
  CountryPack extends {
    confidence?: unknown;
  }
>({
  cacheRoot,
  getCountryBySlug,
  getCountryPack,
  isSourceControlledCountryPack,
  apiKeys,
  textModel,
  recordUsage,
  serviceTier,
  fetchFn = fetch
}: CountryDraftFeatureOptions<CountryPack>) {
  const cache = new Map<
    string,
    CountryDraft
  >();
  const repository =
    createCountryDraftRepository({ cacheRoot });
  const policy = createCountryDraftPolicy({
    getCountryPack,
    isSourceControlledCountryPack
  });
  const generateCountryDraft =
    createCountryDraftGenerator({
      groundingProvider:
        createExaCountryGroundingProvider({
          apiKey: apiKeys.exa,
          fetchFn
        }),
      draftProvider:
        createOpenAICountryDraftProvider({
          apiKey: apiKeys.openai,
          model: textModel,
          recordUsage,
          serviceTier,
          fetchFn
        })
    });

  async function readStoredCountryDraft(
    country: CountryDraftCountry
  ): Promise<CountryDraft | null> {
    const stored = await repository.read(country);
    if (!stored) return null;
    const storedRecord = isRecord(stored)
      ? stored
      : null;
    const draft =
      storedRecord &&
      Object.hasOwn(storedRecord, "draft")
        ? storedRecord.draft
        : stored;
    if (
      isCountryDraft(draft) &&
      draft.mode === "curated_pack_snapshot" &&
      draft.countrySlug === country.slug
    ) {
      return policy.withFreshPackThemes(
        draft,
        country
      );
    }

    const draftRecord = isRecord(
      storedRecord?.draft
    )
      ? storedRecord.draft
      : null;
    return normalizeCountryDraftPayload(
      draft,
      country,
      {
        generatedAt:
          readString(draftRecord?.generatedAt) ??
          readString(storedRecord?.generatedAt),
        model:
          readNullableString(draftRecord?.model) ??
          readNullableString(storedRecord?.model),
        generationStatus:
          readString(
            draftRecord?.generationStatus
          ) ??
          readString(
            storedRecord?.generationStatus
          ) ??
          "ready"
      }
    );
  }

  async function writeStoredCountryDraft(
    country: CountryDraftCountry,
    draft: CountryDraft
  ) {
    return repository.write(
      country,
      policy.withFreshPackThemes(
        draft,
        country
      ) ?? draft
    );
  }

  const handlers =
    createCountryDraftHttpHandlers({
      getCountryBySlug,
      getCountryPack,
      isSourceControlledCountryPack,
      countryDraftCache: cache,
      readStoredCountryDraft,
      writeStoredCountryDraft,
      withFreshPackThemes:
        policy.withFreshPackThemes,
      generateCountryDraft,
      normalizeCurrentCountryDraft:
        policy.normalizeCurrentCountryDraft,
      createStarterMapConfirmation:
        policy.createStarterMapConfirmation,
      writeStoredCountryPromotion:
        repository.writePromotion
    });

  return {
    handlers,
    clearRuntimeMemory(
      countrySlug: string
    ): void {
      cache.delete(countrySlug);
    }
  };
}

function readString(
  value: unknown
): string | undefined {
  return typeof value === "string"
    ? value
    : undefined;
}

function readNullableString(
  value: unknown
): string | null | undefined {
  return value === null
    ? null
    : readString(value);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isCountryDraft(
  value: unknown
): value is CountryDraft {
  if (!isRecord(value)) return false;
  return (
    typeof value.countryCode === "string" &&
    typeof value.countryName === "string" &&
    typeof value.countrySlug === "string" &&
    typeof value.factBoundary === "string" &&
    typeof value.generatedAt === "string" &&
    typeof value.generationStatus ===
      "string" &&
    typeof value.mode === "string" &&
    typeof value.sourceType === "string" &&
    typeof value.summary === "string" &&
    typeof value.changeNote === "string" &&
    Array.isArray(value.regions) &&
    Array.isArray(value.themes) &&
    Array.isArray(value.reviewChecklist) &&
    Array.isArray(value.warnings) &&
    (value.model === null ||
      typeof value.model === "string") &&
    (value.unavailableReason === null ||
      typeof value.unavailableReason ===
        "string") &&
    (value.confidence === "confirmed" ||
      value.confidence === "likely" ||
      value.confidence === "unconfirmed")
  );
}
