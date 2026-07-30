import {
  useCallback,
  useSyncExternalStore
} from "react";

import type {
  CountryRuntimeCacheStore
} from "../runtimeCache/countryRuntimeCacheStore";
import type {
  CountryRuntimeCacheState
} from "../runtimeCache/runtimeCacheTypes";

export function useCountryRuntimeCacheState(
  store: CountryRuntimeCacheStore,
  countrySlug: string
): CountryRuntimeCacheState | null {
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(countrySlug, listener),
    [countrySlug, store]
  );
  const getSnapshot = useCallback(
    () => store.getSnapshot(countrySlug),
    [countrySlug, store]
  );
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null
  );
}
