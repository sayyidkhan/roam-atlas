import {
  useCallback,
  useSyncExternalStore
} from "react";

import type {
  CountryDraftState,
  CountryDraftStore
} from "./countryDraftTypes";

export function useCountryDraftState(
  store: CountryDraftStore,
  countrySlug: string
): CountryDraftState | undefined {
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(countrySlug, listener),
    [countrySlug, store]
  );
  const getSnapshot = useCallback(
    () => store.get(countrySlug),
    [countrySlug, store]
  );
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => undefined
  );
}
