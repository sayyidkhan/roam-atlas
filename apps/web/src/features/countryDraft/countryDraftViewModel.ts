import type {
  CountryDraft,
  CountryDraftConfirmation,
  CountryDraftState
} from "./countryDraftTypes";
import type { DraftMessage } from "../countrySetup/countryExperiencePolicy";

export type CountryDraftSection = "regions" | "themes";
export type CountryDraftList = CountryDraftSection;

export type CountryDraftDeleteCommand = {
  list: CountryDraftList | "node";
  index?: number;
  label?: string;
  path?: string;
};

export type CountryDraftReorderCommand = {
  list: CountryDraftList;
  fromIndex: number;
  insertAfter: boolean;
  targetIndex: number;
};

export type DraftReferencePhotoInput = {
  context: string;
  kind: string;
  placeName: string;
  src: string;
};

export type CountryDraftCommands = {
  approveItem: (
    target: string,
    approved: boolean,
    recursive?: boolean
  ) => void;
  confirmForCuration: () => void;
  deleteItem: (command: CountryDraftDeleteCommand) => void;
  editCandidate: (path: string) => void;
  openReferencePhoto: (input: DraftReferencePhotoInput) => void;
  rebuildMetadata: () => void;
  reorderItems: (command: CountryDraftReorderCommand) => void;
  resetReferencePhotos: () => void;
  submitGenAi: (target: string, instruction: string) => void;
};

export type CountryDraftRenderState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "failed"; error: string }
  | {
      status: "ready";
      draft: CountryDraft;
      editor: {
        isSending: boolean;
        messages: DraftMessage[];
      };
      isBusy: boolean;
      review: {
        confirmation: CountryDraftConfirmation | null;
        error: string | null;
        isConfirming: boolean;
      };
    };

export function createCountryDraftRenderState(
  draftState: CountryDraftState | undefined
): CountryDraftRenderState {
  if (!draftState) return { status: "empty" };
  if (
    draftState.status === "loading" &&
    !draftState.draft
  ) {
    return { status: "loading" };
  }
  if (draftState.status === "failed") {
    return {
      status: "failed",
      error:
        draftState.error ?? "Could not build a starter map."
    };
  }
  if (!draftState.draft) return { status: "empty" };
  return {
    status: "ready",
    draft: draftState.draft,
    editor: {
      isSending: Boolean(draftState.isSending),
      messages: draftState.messages ?? []
    },
    isBusy: Boolean(
      draftState.status === "loading" ||
        draftState.isSending
    ),
    review: {
      confirmation: draftState.confirmation ?? null,
      error: draftState.confirmationError ?? null,
      isConfirming: Boolean(draftState.isConfirming)
    }
  };
}
