import {
  useCallback,
  useSyncExternalStore
} from "react";

import type {
  CountryArtworkQualityLockStore,
  CountryArtworkQualityLockState
} from "./countryArtworkQualityLockStore";

export function useCountryArtworkQualityLock(
  store: CountryArtworkQualityLockStore,
  countrySlug: string
): CountryArtworkQualityLockState {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(countrySlug, listener),
    [countrySlug, store]
  );
  const getSnapshot = useCallback(
    () => store.getSnapshot(countrySlug),
    [countrySlug, store]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
