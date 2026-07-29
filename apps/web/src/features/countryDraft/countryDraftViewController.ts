import type {
  ApplicationState,
  CountrySummary
} from "../../app/applicationRuntimeTypes";
import type {
  CountryDraftCommands,
  CountryDraftDeleteCommand,
  CountryDraftReorderCommand,
  DraftReferencePhotoInput
} from "./countryDraftViewModel";

type CountryDraftViewDependencies = {
  deleteCurrentDraftItem: (
    country: CountrySummary,
    command: CountryDraftDeleteCommand
  ) => void;
  editUnconfirmedDraftCandidate: (
    country: CountrySummary,
    path: string
  ) => void;
  openDraftPhotoLightbox: (
    input: DraftReferencePhotoInput
  ) => void;
  reorderCurrentDraftItems: (
    country: CountrySummary,
    command: CountryDraftReorderCommand
  ) => void;
  requestCountryDraft: (
    country: CountrySummary,
    options?: { force?: boolean; preserveScroll?: boolean }
  ) => Promise<boolean>;
  requestCountryDraftConfirmation: (
    country: CountrySummary
  ) => Promise<void>;
  requestCountryDraftInfluence: (
    country: CountrySummary,
    instruction: string,
    options?: { target?: string }
  ) => Promise<void>;
  requestCountryDraftApproval: (
    country: CountrySummary,
    command: {
      target: string;
      approved: boolean;
      recursive?: boolean;
    }
  ) => Promise<void>;
  requestPlaceImageReset: (
    country: CountrySummary,
    options?: { place?: string }
  ) => Promise<boolean>;
  scopeInstructionToCandidate: (
    target: string,
    instruction: string
  ) => string;
  state: ApplicationState;
};

export type CountryDraftViewController = {
  commands: CountryDraftCommands;
};

/**
 * Adapts React country-draft commands to feature mutation workflows.
 *
 * Draft data mutations remain in countryDraftController; this boundary only
 * coordinates draft mutations and reset requests exposed to React.
 */
export function createCountryDraftViewController({
  deleteCurrentDraftItem,
  editUnconfirmedDraftCandidate,
  openDraftPhotoLightbox,
  reorderCurrentDraftItems,
  requestCountryDraft,
  requestCountryDraftConfirmation,
  requestCountryDraftInfluence,
  requestCountryDraftApproval,
  requestPlaceImageReset,
  scopeInstructionToCandidate,
  state
}: CountryDraftViewDependencies): CountryDraftViewController {
  function selectedCountry(): CountrySummary | null {
    return state.selectedCountry;
  }

  function rebuildMetadata(): void {
    const country = selectedCountry();
    if (!country) return;
    void requestCountryDraft(country, {
      force: true,
      preserveScroll: true
    });
  }

  function confirmForCuration(): void {
    const country = selectedCountry();
    if (!country) return;
    void requestCountryDraftConfirmation(country);
  }

  function approveItem(
    target: string,
    approved: boolean,
    recursive = false
  ): void {
    const country = selectedCountry();
    if (!country || !target) return;
    void requestCountryDraftApproval(country, {
      target,
      approved,
      recursive
    });
  }

  function deleteItem(command: CountryDraftDeleteCommand): void {
    const country = selectedCountry();
    if (!country) return;
    deleteCurrentDraftItem(country, command);
  }

  function editCandidate(path: string): void {
    const country = selectedCountry();
    if (!country || !path) return;
    editUnconfirmedDraftCandidate(country, path);
  }

  function openReferencePhoto(
    input: DraftReferencePhotoInput
  ): void {
    openDraftPhotoLightbox(input);
  }

  function reorderItems(
    command: CountryDraftReorderCommand
  ): void {
    const country = selectedCountry();
    if (!country) return;
    reorderCurrentDraftItems(country, command);
  }

  function resetReferencePhotos(): void {
    const country = selectedCountry();
    if (!country) return;
    void requestPlaceImageReset(country);
  }

  function submitGenAi(
    target: string,
    instruction: string
  ): void {
    const country = selectedCountry();
    const trimmedInstruction = instruction.trim();
    if (!country || !trimmedInstruction) return;
    const scopedInstruction =
      target === "starter-map"
        ? trimmedInstruction
        : scopeInstructionToCandidate(target, trimmedInstruction);
    void requestCountryDraftInfluence(
      country,
      scopedInstruction,
      { target }
    );
  }

  return {
    commands: {
      approveItem,
      confirmForCuration,
      deleteItem,
      editCandidate,
      openReferencePhoto,
      rebuildMetadata,
      reorderItems,
      resetReferencePhotos,
      submitGenAi
    }
  };
}
