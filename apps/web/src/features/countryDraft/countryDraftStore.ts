import type {
  CountryDraftState,
  CountryDraftStore
} from "./countryDraftTypes";

type Listener = () => void;

/**
 * Country-scoped starter-map workflow store.
 *
 * Generated drafts remain unconfirmed review artifacts. This store only owns
 * browser workflow state; it cannot promote generated content into facts.
 */
export function createCountryDraftStore(): CountryDraftStore {
  const drafts = new Map<string, CountryDraftState>();
  const checkedStoredDrafts = new Set<string>();
  const listenersByCountry = new Map<string, Set<Listener>>();

  function notify(countrySlug: string): void {
    listenersByCountry
      .get(countrySlug)
      ?.forEach((listener) => listener());
  }

  return {
    delete(countrySlug) {
      const removedDraft = drafts.delete(countrySlug);
      const removedCheck = checkedStoredDrafts.delete(countrySlug);
      if (removedDraft || removedCheck) notify(countrySlug);
    },

    get(countrySlug) {
      return drafts.get(countrySlug);
    },

    has(countrySlug) {
      return drafts.has(countrySlug);
    },

    hasCheckedStoredDraft(countrySlug) {
      return checkedStoredDrafts.has(countrySlug);
    },

    markStoredDraftChecked(countrySlug) {
      checkedStoredDrafts.add(countrySlug);
    },

    set(countrySlug, state) {
      drafts.set(countrySlug, state);
      notify(countrySlug);
    },

    subscribe(countrySlug, listener) {
      const listeners =
        listenersByCountry.get(countrySlug) ?? new Set<Listener>();
      listeners.add(listener);
      listenersByCountry.set(countrySlug, listeners);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          listenersByCountry.delete(countrySlug);
        }
      };
    }
  };
}
