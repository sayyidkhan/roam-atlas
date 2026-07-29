import { createCountryDraftInfluenceController } from "./countryDraftInfluenceController";
import { createCountryDraftLifecycleController } from "./countryDraftLifecycleController";
import { createCountryDraftMutationController } from "./countryDraftMutationController";
import { createCountryDraftReviewController } from "./countryDraftReviewController";
import type {
  CountrySummary
} from "../../app/applicationRuntimeTypes";
import type {
  CountryDraft,
  CountryDraftClient,
  CountryDraftStore,
  CountryDraftToast,
  DraftNode
} from "./countryDraftTypes";
import type { CountryShellScrollSnapshot } from "../countrySetup/countryShellScroll";

type CountryDraftControllerDependencies = {
  APP_CONFIG: {
    countryDraft: {
      candidateNameMaxLength: number;
    };
  };
  appendUnconfirmedRegionCandidates: (
    sourceDraft: CountryDraft,
    regionName: string,
    storedDraft: CountryDraft
  ) => unknown;
  captureCountryShellScroll: () => CountryShellScrollSnapshot;
  countryDraftClient: CountryDraftClient;
  createCountryPackStarterMap: (
    countryPack: unknown
  ) => CountryDraft;
  ensureCountryPack: (
    countrySlug: string
  ) => Promise<unknown>;
  explainClickError: (error: unknown) => string;
  getSelectedCountry: () => CountrySummary | null;
  getDraftNodeAtPath: (
    draft: CountryDraft | null | undefined,
    path: unknown
  ) => DraftNode | null;
  isConfiguredCountryPack: (
    countrySlug: string
  ) => boolean;
  isDraftItemApproved: (item: DraftNode) => boolean;
  removeDraftNodeAtPath: (
    draft: CountryDraft | null | undefined,
    path: unknown
  ) => CountryDraft | null;
  render: () => void;
  reorderArray: <T>(
    items: T[],
    fromIndex: number,
    insertionIndex: number
  ) => T[] | null;
  restoreCountryShellScroll: (
    snapshot: CountryShellScrollSnapshot
  ) => void;
  showAppToast: (options: CountryDraftToast) => void;
  draftStore: CountryDraftStore;
};

/**
 * Typed composition boundary for country starter-map workflows.
 *
 * Loading, local mutations, AI influence, and explicit review are separate so
 * future changes retrieve only the workflow they need. Checked-in facts remain
 * distinct from runtime-generated, unconfirmed candidates.
 */
export function createCountryDraftController(
  dependencies: CountryDraftControllerDependencies
) {
  const {
    APP_CONFIG,
    appendUnconfirmedRegionCandidates,
    captureCountryShellScroll,
    countryDraftClient,
    createCountryPackStarterMap,
    ensureCountryPack,
    explainClickError,
    getSelectedCountry,
    getDraftNodeAtPath,
    isConfiguredCountryPack,
    isDraftItemApproved,
    removeDraftNodeAtPath,
    render,
    reorderArray,
    restoreCountryShellScroll,
    showAppToast,
    draftStore
  } = dependencies;

  const mutationController =
    createCountryDraftMutationController({
      candidateNameMaxLength:
        APP_CONFIG.countryDraft.candidateNameMaxLength,
      captureCountryShellScroll,
      countryDraftClient,
      explainError: explainClickError,
      getDraftNodeAtPath,
      isDraftItemApproved,
      removeDraftNodeAtPath,
      render,
      reorderArray,
      restoreCountryShellScroll,
      showToast: showAppToast,
      draftStore
    });
  const lifecycleController =
    createCountryDraftLifecycleController({
      appendUnconfirmedRegionCandidates,
      captureCountryShellScroll,
      countryDraftClient,
      createCountryPackStarterMap,
      ensureCountryPack,
      explainError: explainClickError,
      getSelectedCountry,
      isConfiguredCountryPack,
      render,
      restoreCountryShellScroll,
      draftStore
    });
  const influenceController =
    createCountryDraftInfluenceController({
      countryDraftClient,
      explainError: explainClickError,
      render,
      draftStore
    });
  const reviewController =
    createCountryDraftReviewController({
      captureCountryShellScroll,
      countryDraftClient,
      explainError: explainClickError,
      render,
      restoreCountryShellScroll,
      showToast: showAppToast,
      draftStore
    });

  return {
    ...influenceController,
    ...lifecycleController,
    ...mutationController,
    ...reviewController
  };
}
