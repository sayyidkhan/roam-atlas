import type {
  CountryArtworkQualityLock
} from "./artworkQualityLockClient";

export type CountryArtworkQualityLockState =
  | { status: "idle" | "loading" }
  | {
      status: "ready";
      lock: CountryArtworkQualityLock;
    }
  | { status: "failed"; message: string };

type Listener = () => void;

const IDLE_STATE: CountryArtworkQualityLockState = Object.freeze({
  status: "idle"
});

export type CountryArtworkQualityLockStore = {
  clear: (countrySlug: string) => void;
  getSnapshot: (
    countrySlug: string
  ) => CountryArtworkQualityLockState;
  set: (
    countrySlug: string,
    state: CountryArtworkQualityLockState
  ) => void;
  subscribe: (
    countrySlug: string,
    listener: Listener
  ) => () => void;
};

/** Remote configuration state for one country's generated-artwork policy. */
export function createCountryArtworkQualityLockStore(): CountryArtworkQualityLockStore {
  const stateByCountry = new Map<
    string,
    CountryArtworkQualityLockState
  >();
  const listenersByCountry = new Map<string, Set<Listener>>();

  function notify(countrySlug: string): void {
    listenersByCountry.get(countrySlug)?.forEach((listener) => listener());
  }

  return {
    clear(countrySlug) {
      if (!stateByCountry.delete(countrySlug)) return;
      notify(countrySlug);
    },
    getSnapshot(countrySlug) {
      return stateByCountry.get(countrySlug) ?? IDLE_STATE;
    },
    set(countrySlug, state) {
      stateByCountry.set(countrySlug, state);
      notify(countrySlug);
    },
    subscribe(countrySlug, listener) {
      const listeners =
        listenersByCountry.get(countrySlug) ?? new Set<Listener>();
      listeners.add(listener);
      listenersByCountry.set(countrySlug, listeners);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) listenersByCountry.delete(countrySlug);
      };
    }
  };
}
