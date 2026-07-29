import {
  normalizeCountryDraftPayload,
  refreshCuratedPackSnapshotThemes,
  type CountryDraft,
  type CountryDraftCountry
} from "@roamatlas/domain/countryDraft.js";

export type StarterMapConfirmation = {
  candidateCounts: {
    regions: number;
    themes: number;
  };
  confirmedAt: string;
  countryCode: string;
  countryName: string;
  countrySlug: string;
  factBoundary: string;
  nextStep: string;
  sourceStarterMap: {
    confidence: string;
    generatedAt: string;
    mode: string;
    sourceType: string;
  };
  status: "confirmed_for_curation";
};

type CountryDraftPolicyOptions<CountryPack> = {
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
};

export function createCountryDraftPolicy<
  CountryPack
>({
  getCountryPack,
  isSourceControlledCountryPack
}: CountryDraftPolicyOptions<CountryPack>) {
  function withFreshPackThemes(
    draft: CountryDraft | null,
    country: CountryDraftCountry
  ): CountryDraft | null {
    if (
      !draft ||
      !isSourceControlledCountryPack(
        country.slug
      )
    ) {
      return draft;
    }
    return refreshCuratedPackSnapshotThemes(
      draft,
      getCountryPack(country.slug)
    );
  }

  function normalizeCurrentCountryDraft(
    currentDraft: unknown,
    country: CountryDraftCountry
  ): CountryDraft | null {
    if (
      !isRecord(currentDraft) ||
      currentDraft.countrySlug !== country.slug
    ) {
      return null;
    }
    const normalized =
      normalizeCountryDraftPayload(
        currentDraft,
        country,
        {
          generatedAt: readString(
            currentDraft.generatedAt
          ),
          model: readNullableString(
            currentDraft.model
          ),
          generationStatus:
            readString(
              currentDraft.generationStatus
            ) ?? "ready",
          mode: readString(currentDraft.mode),
          preserveConfirmed: true
        }
      );
    return withFreshPackThemes(
      normalized,
      country
    );
  }

  function createStarterMapConfirmation(
    country: CountryDraftCountry,
    draft: CountryDraft
  ): StarterMapConfirmation {
    return {
      countryCode: country.code,
      countrySlug: country.slug,
      countryName: country.name,
      status: "confirmed_for_curation",
      sourceStarterMap: {
        mode: draft.mode,
        sourceType: draft.sourceType,
        confidence: draft.confidence,
        generatedAt: draft.generatedAt
      },
      candidateCounts: {
        regions: draft.regions.length,
        themes: draft.themes.length
      },
      nextStep:
        "Generate a source-reviewed country pack from the draft artifact.",
      factBoundary:
        "Confirmation approves curation direction only; it does not verify travel facts.",
      confirmedAt: new Date().toISOString()
    };
  }

  return {
    withFreshPackThemes,
    normalizeCurrentCountryDraft,
    createStarterMapConfirmation
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
