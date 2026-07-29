import {
  createContext,
  useContext,
  useRef,
  type PropsWithChildren
} from "react";

type RegisterLoadedPhoto = (url: string) => boolean;

const DraftReferencePhotoRegistryContext =
  createContext<RegisterLoadedPhoto>(() => true);

export function DraftReferencePhotoRegistry({
  children
}: PropsWithChildren) {
  const loadedUrls = useRef(new Set<string>());

  function registerLoadedPhoto(url: string): boolean {
    const normalizedUrl = normalizeLoadedDraftPhotoUrl(url);
    if (loadedUrls.current.has(normalizedUrl)) return false;
    loadedUrls.current.add(normalizedUrl);
    return true;
  }

  return (
    <DraftReferencePhotoRegistryContext.Provider
      value={registerLoadedPhoto}
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
