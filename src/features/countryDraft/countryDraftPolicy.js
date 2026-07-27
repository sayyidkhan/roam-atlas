import {
  normalizeCountryDraftPayload,
  refreshCuratedPackSnapshotThemes
} from "../../domain/countryDraft.js";

export function createCountryDraftPolicy({
  getCountryPack,
  isSourceControlledCountryPack
}) {
  function withFreshPackThemes(draft, country) {
    if (!draft || !isSourceControlledCountryPack(country.slug)) return draft;
    return refreshCuratedPackSnapshotThemes(draft, getCountryPack(country.slug));
  }

  function normalizeCurrentCountryDraft(currentDraft, country) {
    if (!currentDraft || currentDraft.countrySlug !== country.slug) return null;
    const normalized = normalizeCountryDraftPayload(currentDraft, country, {
      generatedAt: currentDraft.generatedAt,
      model: currentDraft.model,
      generationStatus: currentDraft.generationStatus ?? "ready",
      mode: currentDraft.mode,
      preserveConfirmed: true
    });
    return withFreshPackThemes(normalized, country);
  }

  function createStarterMapConfirmation(country, draft) {
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
        regions: draft.regions?.length ?? 0,
        themes: draft.themes?.length ?? 0
      },
      nextStep: "Generate a source-reviewed country pack from the draft artifact.",
      factBoundary: "Confirmation approves curation direction only; it does not verify travel facts.",
      confirmedAt: new Date().toISOString()
    };
  }

  return {
    withFreshPackThemes,
    normalizeCurrentCountryDraft,
    createStarterMapConfirmation
  };
}
