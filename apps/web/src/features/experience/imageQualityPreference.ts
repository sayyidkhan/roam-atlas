type ImageQualityPreferenceDependencies = {
  normalizeImageQuality: (value: unknown) => string;
  storageKey: string;
  fallbackValue: string;
};

/**
 * Browser persistence for the illustration-quality preference.
 *
 * Keeping storage access behind this adapter lets the React migration consume
 * the same policy without depending on the legacy application runtime.
 */
export function createImageQualityPreference({
  normalizeImageQuality,
  storageKey,
  fallbackValue
}: ImageQualityPreferenceDependencies) {
  function load(): string {
    try {
      return normalizeImageQuality(window.localStorage.getItem(storageKey));
    } catch {
      return fallbackValue;
    }
  }

  function hasStoredValue(): boolean {
    try {
      return Boolean(window.localStorage.getItem(storageKey));
    } catch {
      return false;
    }
  }

  function store(value: string): void {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // The in-memory selection remains active when storage is unavailable.
    }
  }

  return { hasStoredValue, load, store };
}
