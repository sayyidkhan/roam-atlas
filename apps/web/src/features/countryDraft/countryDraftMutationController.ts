import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type { CountryShellScrollSnapshot } from "../countrySetup/countryShellScroll";
import type {
  CountryDraft,
  CountryDraftClient,
  CountryDraftStore,
  CountryDraftToast,
  DraftDeleteCommand,
  DraftListCommand,
  DraftNode
} from "./countryDraftTypes";

type CountryDraftMutationDependencies = {
  candidateNameMaxLength: number;
  captureCountryShellScroll: () => CountryShellScrollSnapshot;
  countryDraftClient: Pick<CountryDraftClient, "reorder">;
  explainError: (error: unknown) => string;
  getDraftNodeAtPath: (
    draft: CountryDraft | null | undefined,
    path: unknown
  ) => DraftNode | null;
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
  showToast: (options: CountryDraftToast) => void;
  draftStore: CountryDraftStore;
};

export function createCountryDraftMutationController(
  dependencies: CountryDraftMutationDependencies
) {
  const {
    candidateNameMaxLength,
    captureCountryShellScroll,
    countryDraftClient,
    explainError,
    getDraftNodeAtPath,
    isDraftItemApproved,
    removeDraftNodeAtPath,
    render,
    reorderArray,
    restoreCountryShellScroll,
    showToast,
    draftStore
  } = dependencies;

  function reorderCurrentDraftItems(
    country: CountrySummary,
    {
      list,
      fromIndex,
      targetIndex,
      insertAfter
    }: DraftListCommand
  ): void {
    const existing = draftStore.get(country.slug);
    const items =
      list === "regions"
        ? existing?.draft?.regions
        : existing?.draft?.themes;
    if (!existing?.draft || !Array.isArray(items)) return;
    const scrollSnapshot = captureCountryShellScroll();
    const insertionIndex =
      targetIndex + (insertAfter ? 1 : 0);
    const nextItems = reorderArray(
      items,
      fromIndex,
      insertionIndex
    );
    if (!nextItems) return;
    const draft = {
      ...existing.draft,
      [list]: nextItems
    };
    draftStore.set(country.slug, {
      ...existing,
      draft,
      confirmation: null
    });
    render();
    restoreCountryShellScroll(scrollSnapshot);
    void persistCountryDraftReorder(country, draft);
  }

  function deleteCurrentDraftItem(
    country: CountrySummary,
    { list, index, path, label }: DraftDeleteCommand
  ): void {
    const existing = draftStore.get(country.slug);
    const items =
      list === "regions"
        ? existing?.draft?.regions
        : list === "themes"
          ? existing?.draft?.themes
          : null;
    const hasValidIndex =
      Number.isInteger(index) &&
      typeof index === "number" &&
      Array.isArray(items) &&
      index >= 0 &&
      index < items.length;
    const item = path
      ? getDraftNodeAtPath(existing?.draft, path)
      : hasValidIndex
        ? items?.[index]
        : null;
    if (
      !existing?.draft ||
      !item ||
      (!path && !hasValidIndex)
    ) {
      return;
    }
    const itemLabel =
      label ||
      String(item.name ?? item.label ?? "this record");
    if (
      !window.confirm(
        `Delete ${itemLabel} from this starter map? This only removes the draft record.`
      )
    ) {
      return;
    }

    const scrollSnapshot = captureCountryShellScroll();
    const draft = path
      ? removeDraftNodeAtPath(existing.draft, path)
      : {
          ...existing.draft,
          [list]: (items ?? []).filter(
            (_, itemIndex) => itemIndex !== index
          )
        };
    if (!draft) return;
    draftStore.set(country.slug, {
      ...existing,
      draft,
      confirmation: null
    });
    render();
    restoreCountryShellScroll(scrollSnapshot);
    void persistCountryDraftReorder(country, draft);
  }

  function editUnconfirmedDraftCandidate(
    country: CountrySummary,
    path: unknown
  ): void {
    const existing = draftStore.get(country.slug);
    const item = getDraftNodeAtPath(existing?.draft, path);
    if (
      !existing?.draft ||
      !item ||
      isDraftItemApproved(item)
    ) {
      showToast({
        tone: "error",
        title: "Candidate cannot be edited",
        message:
          "Only unconfirmed appended candidates can be edited here. Curated source data stays protected."
      });
      return;
    }
    const nextName = window
      .prompt("Rename unconfirmed candidate", item.name)
      ?.trim();
    if (!nextName || nextName === item.name) return;

    const draft = structuredClone(existing.draft);
    const nextItem = getDraftNodeAtPath(draft, path);
    if (!nextItem) return;
    nextItem.name = nextName.slice(
      0,
      candidateNameMaxLength
    );
    draft.changeNote =
      `Renamed unconfirmed candidate to ${nextItem.name}.`;
    const scrollSnapshot = captureCountryShellScroll();
    draftStore.set(country.slug, {
      ...existing,
      draft
    });
    render();
    restoreCountryShellScroll(scrollSnapshot);
    void persistCountryDraftReorder(country, draft);
  }

  async function persistCountryDraftReorder(
    country: CountrySummary,
    draft: CountryDraft
  ): Promise<void> {
    try {
      const payload = await countryDraftClient.reorder({
        countrySlug: country.slug,
        currentDraft: draft
      });
      const existing =
        draftStore.get(country.slug);
      if (existing?.draft !== draft) return;
      draftStore.set(country.slug, {
        ...existing,
        draft: payload.draft ?? draft
      });
    } catch (error) {
      const scrollSnapshot = captureCountryShellScroll();
      const existing =
        draftStore.get(country.slug);
      if (existing?.draft !== draft) return;
      draftStore.set(country.slug, {
        ...existing,
        messages: [
          ...(existing.messages ?? []),
          {
            role: "assistant",
            status: "error",
            text: explainError(error)
          }
        ].slice(-12)
      });
      render();
      restoreCountryShellScroll(scrollSnapshot);
    }
  }

  return {
    deleteCurrentDraftItem,
    editUnconfirmedDraftCandidate,
    reorderCurrentDraftItems
  };
}
