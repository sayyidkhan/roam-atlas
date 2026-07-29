import type {
  CountryRuntimeCacheState
} from "./runtimeCacheTypes";

type Listener = () => void;

export type CountryRuntimeCacheStore = {
  getSnapshot: (
    countrySlug: string
  ) => CountryRuntimeCacheState | null;
  set: (
    countrySlug: string,
    state: CountryRuntimeCacheState
  ) => void;
  clear: (countrySlug: string) => void;
  subscribe: (
    countrySlug: string,
    listener: Listener
  ) => () => void;
};

/**
 * Feature-owned external store for country cache operations.
 *
 * Cache progress is presentation state. Keeping it here lets React subscribe
 * to one country without routing transient notices through ApplicationState.
 */
export function createCountryRuntimeCacheStore(): CountryRuntimeCacheStore {
  const stateByCountry = new Map<
    string,
    CountryRuntimeCacheState
  >();
  const listenersByCountry = new Map<string, Set<Listener>>();

  function notify(countrySlug: string): void {
    listenersByCountry
      .get(countrySlug)
      ?.forEach((listener) => listener());
  }

  return {
    getSnapshot(countrySlug) {
      return stateByCountry.get(countrySlug) ?? null;
    },

    set(countrySlug, state) {
      stateByCountry.set(countrySlug, state);
      notify(countrySlug);
    },

    clear(countrySlug) {
      if (!stateByCountry.delete(countrySlug)) return;
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
