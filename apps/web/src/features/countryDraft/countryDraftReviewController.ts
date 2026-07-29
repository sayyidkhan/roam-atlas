import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type { CountryShellScrollSnapshot } from "../countrySetup/countryShellScroll";
import type {
  CountryDraftClient,
  CountryDraftStore,
  CountryDraftToast
} from "./countryDraftTypes";

type CountryDraftReviewDependencies = {
  captureCountryShellScroll: () => CountryShellScrollSnapshot;
  countryDraftClient: Pick<
    CountryDraftClient,
    "approve" | "confirm"
  >;
  explainError: (error: unknown) => string;
  render: () => void;
  restoreCountryShellScroll: (
    snapshot: CountryShellScrollSnapshot
  ) => void;
  showToast: (options: CountryDraftToast) => void;
  draftStore: CountryDraftStore;
};

export function createCountryDraftReviewController(
  dependencies: CountryDraftReviewDependencies
) {
  const {
    captureCountryShellScroll,
    countryDraftClient,
    explainError,
    render,
    restoreCountryShellScroll,
    showToast,
    draftStore
  } = dependencies;

  async function requestCountryDraftApproval(
    country: CountrySummary,
    {
      target,
      approved,
      recursive = false
    }: {
      approved: boolean;
      recursive?: boolean;
      target: string;
    }
  ): Promise<void> {
    const existing = draftStore.get(country.slug);
    if (
      !existing?.draft ||
      existing.isSending ||
      existing.status === "loading" ||
      existing.isApproving
    ) {
      return;
    }
    const scrollSnapshot = captureCountryShellScroll();
    draftStore.set(country.slug, {
      ...existing,
      isApproving: true,
      approvalError: null
    });
    renderWithScroll(scrollSnapshot);

    try {
      const payload = await countryDraftClient.approve({
        countrySlug: country.slug,
        currentDraft: existing.draft,
        target,
        approved,
        recursive
      });
      draftStore.set(country.slug, {
        ...existing,
        status: "ready",
        isApproving: false,
        approvalError: null,
        draft: payload.draft,
        messages: payload.message
          ? [
              ...(existing.messages ?? []),
              payload.message
            ].slice(-8)
          : existing.messages ?? []
      });
    } catch (error) {
      const message = explainError(error);
      draftStore.set(country.slug, {
        ...existing,
        isApproving: false,
        approvalError: message
      });
      showToast({
        tone: "error",
        title: "Curation update failed",
        message
      });
    }
    renderWithScroll(scrollSnapshot);
  }

  async function requestCountryDraftConfirmation(
    country: CountrySummary
  ): Promise<void> {
    const existing = draftStore.get(country.slug);
    if (
      !existing?.draft ||
      existing.isConfirming ||
      existing.isSending ||
      existing.status === "loading"
    ) {
      return;
    }

    draftStore.set(country.slug, {
      ...existing,
      isConfirming: true,
      confirmationError: null
    });
    render();

    try {
      const confirmation = await countryDraftClient.confirm({
        countrySlug: country.slug,
        currentDraft: existing.draft
      });
      draftStore.set(country.slug, {
        ...existing,
        status: "ready",
        isConfirming: false,
        confirmationError: null,
        confirmation
      });
    } catch (error) {
      const message = explainError(error);
      draftStore.set(country.slug, {
        ...existing,
        status: "ready",
        isConfirming: false,
        confirmationError: message,
        messages: [
          ...(existing.messages ?? []),
          { role: "assistant", text: message }
        ].slice(-8)
      });
    }
    render();
  }

  function renderWithScroll(
    scrollSnapshot: CountryShellScrollSnapshot
  ): void {
    render();
    restoreCountryShellScroll(scrollSnapshot);
  }

  return {
    requestCountryDraftApproval,
    requestCountryDraftConfirmation
  };
}
