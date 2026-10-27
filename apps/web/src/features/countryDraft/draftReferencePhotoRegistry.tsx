import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren
} from "react";

type PhotoRegistry = {
  register: (url: string, owner: string) => boolean;
  release: (owner: string) => void;
};

const DraftReferencePhotoRegistryContext =
  createContext<PhotoRegistry>({ register: () => true, release: () => {} });

export function DraftReferencePhotoRegistry({
  children
}: PropsWithChildren) {
  const loadedUrls = useRef(new Map<string, string>());

  const register = useCallback((url: string, owner: string): boolean => {
    const normalizedUrl = normalizeLoadedDraftPhotoUrl(url);
    const existingOwner = loadedUrls.current.get(normalizedUrl);
    if (existingOwner && existingOwner !== owner) return false;
    loadedUrls.current.set(normalizedUrl, owner);
    return true;
  }, []);

  const release = useCallback((owner: string) => {
    for (const [url, registeredOwner] of loadedUrls.current) {
      if (registeredOwner === owner) loadedUrls.current.delete(url);
    }
  }, []);
  const registry = useMemo(() => ({ register, release }), [register, release]);

  return (
    <DraftReferencePhotoRegistryContext.Provider
      value={registry}
    >
      {children}
    </DraftReferencePhotoRegistryContext.Provider>
  );
}

export function useDraftReferencePhotoRegistry() {
  return useContext(DraftReferencePhotoRegistryContext);
}

export function normalizeLoadedDraftPhotoUrl(
  value: string
): string {
  try {
    const parsed = new URL(value, window.location.origin);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}
