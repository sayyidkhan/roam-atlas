import {
  createCountryPackDraftFromStarterMap,
  type CountryDraft,
  type CountryDraftCountry
} from "@roamatlas/domain/countryDraft.js";
import type {
  GenerateCountryDraft
} from "./countryDraftGenerator.ts";
import type {
  StarterMapConfirmation
} from "./countryDraftPolicy.ts";

export type CountryPackDraft = ReturnType<
  typeof createCountryPackDraftFromStarterMap
>;

export type CountryDraftHttpHandlers = {
  handleApprovalRequest: (
    request: Request
  ) => Promise<Response>;
  handleConfirmRequest: (
    request: Request
  ) => Promise<Response>;
  handleDraftRequest: (
    url: URL
  ) => Promise<Response>;
  handleInfluenceRequest: (
    request: Request
  ) => Promise<Response>;
  handleReorderRequest: (
    request: Request
  ) => Promise<Response>;
};

export type CountryDraftHttpDependencies<
  CountryPack extends {
    confidence?: unknown;
  }
> = {
  countryDraftCache: Map<string, CountryDraft>;
  createStarterMapConfirmation: (
    country: CountryDraftCountry,
    draft: CountryDraft
  ) => StarterMapConfirmation;
  generateCountryDraft: GenerateCountryDraft;
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
  normalizeCurrentCountryDraft: (
    currentDraft: unknown,
    country: CountryDraftCountry
  ) => CountryDraft | null;
  readStoredCountryDraft: (
    country: CountryDraftCountry
  ) => Promise<CountryDraft | null>;
  withFreshPackThemes: (
    draft: CountryDraft | null,
    country: CountryDraftCountry
  ) => CountryDraft | null;
  writeStoredCountryDraft: (
    country: CountryDraftCountry,
    draft: CountryDraft
  ) => Promise<unknown>;
  writeStoredCountryPromotion: (
    input: {
      confirmation: StarterMapConfirmation;
      country: CountryDraftCountry;
      countryPackDraft: CountryPackDraft;
    }
  ) => Promise<{
    countryPackDraftUrl: string;
    starterMapConfirmationUrl: string;
  }>;
};
