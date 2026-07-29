import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import type { CountryShellScrollSnapshot } from "../countrySetup/countryShellScroll";
import type {
  CountryDraft,
  CountryDraftClient,
  CountryDraftStore
} from "./countryDraftTypes";

type CountryDraftLifecycleDependencies = {
  appendUnconfirmedRegionCandidates: (
    sourceDraft: CountryDraft,
    regionName: string,
    storedDraft: CountryDraft
  ) => unknown;
  captureCountryShellScroll: () => CountryShellScrollSnapshot;
  countryDraftClient: Pick<CountryDraftClient, "load">;
  createCountryPackStarterMap: (
    countryPack: unknown
  ) => CountryDraft;
  ensureCountryPack: (
    countrySlug: string
  ) => Promise<unknown>;
  explainError: (error: unknown) => string;
  getSelectedCountry: () => CountrySummary | null;
  isConfiguredCountryPack: (
    countrySlug: string
  ) => boolean;
  render: () => void;
  restoreCountryShellScroll: (
    snapshot: CountryShellScrollSnapshot
  ) => void;
  draftStore: CountryDraftStore;
};

export function createCountryDraftLifecycleController(
  dependencies: CountryDraftLifecycleDependencies
) {
  const {
    appendUnconfirmedRegionCandidates,
    captureCountryShellScroll,
    countryDraftClient,
    createCountryPackStarterMap,
    ensureCountryPack,
    explainError,
    getSelectedCountry,
    isConfiguredCountryPack,
    render,
    restoreCountryShellScroll,
    draftStore
  } = dependencies;

  async function requestCountryDraft(
    country: CountrySummary,
    {
      force = false,
      preserveScroll = false
    }: {
      force?: boolean;
      preserveScroll?: boolean;
    } = {}
  ): Promise<boolean> {
    const existing = draftStore.get(country.slug);
    if (
      existing?.status === "loading" ||
      existing?.isSending
    ) {
      return false;
    }
    const scrollSnapshot = preserveScroll
      ? captureCountryShellScroll()
      : null;
    const messages = force
      ? []
      : existing?.messages ?? [];
    const confirmation = force
      ? null
      : existing?.confirmation ?? null;

    draftStore.set(country.slug, {
      status: "loading",
      messages,
      confirmation,
      draft: preserveScroll
        ? existing?.draft ?? null
        : null
    });
    renderWithOptionalScroll(scrollSnapshot);
    try {
      const { draft } = await countryDraftClient.load(
        country.slug,
        { force }
      );
      draftStore.set(country.slug, {
        status: "ready",
        draft,
        messages,
        confirmation
      });
      renderWithOptionalScroll(scrollSnapshot);
      return true;
    } catch (error) {
      draftStore.set(country.slug, {
        status: "failed",
        error: explainError(error)
      });
      renderWithOptionalScroll(scrollSnapshot);
      return false;
    }
  }

  async function loadStoredCountryDraft(
    country: CountrySummary
  ): Promise<void> {
    if (
      draftStore.hasCheckedStoredDraft(country.slug) ||
      draftStore.has(country.slug)
    ) {
      return;
    }

    draftStore.markStoredDraftChecked(country.slug);
    try {
      if (isConfiguredCountryPack(country.slug)) {
        await loadSourceControlledDraft(country);
        return;
      }
      const { draft } = await countryDraftClient.load(
        country.slug,
        { generate: false }
      );
      if (
        !draft ||
        getSelectedCountry()?.slug !== country.slug
      ) {
        return;
      }
      const existing =
        draftStore.get(country.slug);
      if (
        existing?.status === "loading" ||
        existing?.isSending
      ) {
        return;
      }
      draftStore.set(country.slug, {
        status: "ready",
        draft,
        messages: existing?.messages ?? []
      });
      render();
    } catch {
      // Stored starter maps are optional runtime artifacts.
    }
  }

  async function loadSourceControlledDraft(
    country: CountrySummary
  ): Promise<void> {
    // Runtime data may add unconfirmed candidates, but cannot replace the curated source tree.
    const countryPack = await ensureCountryPack(country.slug);
    if (
      !countryPack ||
      getSelectedCountry()?.slug !== country.slug
    ) {
      return;
    }
    const sourceDraft =
      createCountryPackStarterMap(countryPack);
    draftStore.set(country.slug, {
      status: "ready",
      draft: sourceDraft,
      messages: []
    });
    render();

    const { draft: storedDraft } =
      await countryDraftClient.load(country.slug, {
        generate: false
      });
    if (
      !storedDraft ||
      getSelectedCountry()?.slug !== country.slug
    ) {
      return;
    }
    for (const region of sourceDraft.regions ?? []) {
      if (!region.name) continue;
      appendUnconfirmedRegionCandidates(
        sourceDraft,
        region.name,
        storedDraft
      );
    }
    sourceDraft.changeNote = "";
    draftStore.set(country.slug, {
      status: "ready",
      draft: sourceDraft,
      messages:
        draftStore.get(country.slug)?.messages ??
        []
    });
    render();
  }

  function renderWithOptionalScroll(
    scrollSnapshot: CountryShellScrollSnapshot | null
  ): void {
    render();
    if (scrollSnapshot) {
      restoreCountryShellScroll(scrollSnapshot);
    }
  }

  return {
    loadStoredCountryDraft,
    requestCountryDraft
  };
}
