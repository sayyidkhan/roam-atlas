import type { DraftMessage } from "../countrySetup/countryExperiencePolicy";

export type DraftNode = {
  children?: DraftNode[];
  confidence?: string;
  kind?: string;
  label?: string;
  name?: string;
  note?: string;
  reviewStatus?: string;
  sourceUrl?: string | null;
  why?: string;
  [key: string]: unknown;
};

export type DraftTheme = {
  confidence?: string;
  label?: string;
  note?: string;
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type CountryDraft = {
  changeNote?: string;
  confidence?: string;
  curationConfirmation?: CountryDraftConfirmation | null;
  curationStatus?: string;
  countryName?: string;
  mode?: string;
  regions?: DraftNode[];
  reviewChecklist?: string[];
  summary?: string;
  themes?: DraftTheme[];
  unavailableReason?: string | null;
  [key: string]: unknown;
};

export type CountryDraftConfirmation = {
  paths: {
    confirmationUrl: string;
    countryPackDraftUrl: string;
  };
  [key: string]: unknown;
};

export type CountryDraftState = {
  approvalError?: string | null;
  confirmation?: CountryDraftConfirmation | null;
  confirmationError?: string | null;
  draft?: CountryDraft | null;
  error?: string;
  isApproving?: boolean;
  isConfirming?: boolean;
  isSending?: boolean;
  messages?: DraftMessage[];
  status?: "loading" | "ready" | "failed";
};

export type CountryDraftStore = {
  delete: (countrySlug: string) => void;
  get: (countrySlug: string) => CountryDraftState | undefined;
  has: (countrySlug: string) => boolean;
  hasCheckedStoredDraft: (countrySlug: string) => boolean;
  markStoredDraftChecked: (countrySlug: string) => void;
  set: (
    countrySlug: string,
    state: CountryDraftState
  ) => void;
  subscribe: (
    countrySlug: string,
    listener: () => void
  ) => () => void;
};

export type CountryDraftClient = {
  approve: (payload: {
    approved: boolean;
    countrySlug: string;
    currentDraft: CountryDraft;
    recursive: boolean;
    target: string;
  }) => Promise<{
    draft: CountryDraft;
    message?: DraftMessage;
  }>;
  confirm: (payload: {
    countrySlug: string;
    currentDraft: CountryDraft;
  }) => Promise<CountryDraftConfirmation>;
  influence: (payload: {
    countrySlug: string;
    currentDraft: CountryDraft | null;
    instruction: string;
    target: string;
  }) => Promise<{
    draft: CountryDraft;
    message?: DraftMessage;
  }>;
  load: (
    countrySlug: string,
    options?: {
      force?: boolean;
      generate?: boolean;
    }
  ) => Promise<{
    draft?: CountryDraft | null;
  }>;
  reorder: (payload: {
    countrySlug: string;
    currentDraft: CountryDraft;
  }) => Promise<{
    draft?: CountryDraft;
  }>;
};

export type CountryDraftToast = {
  message: string;
  title: string;
  tone?: "error";
};

export type DraftDeleteCommand = {
  index?: number;
  label?: string;
  list: "regions" | "themes" | "node";
  path?: unknown;
};

export type DraftListCommand = {
  fromIndex: number;
  insertAfter: boolean;
  list: "regions" | "themes";
  targetIndex: number;
};
