import type {
  CountryArtworkQualityLockStore
} from "./countryArtworkQualityLockStore";
import type {
  CountryArtworkQualityLock
} from "./artworkQualityLockClient";

type CountryArtworkQualityLockControllerDependencies = {
  fetchCountryArtworkQualityLock: (input: {
    countrySlug: string;
  }) => Promise<CountryArtworkQualityLock>;
  qualityLockStore: CountryArtworkQualityLockStore;
  render: () => void;
};

export function createCountryArtworkQualityLockController({
  fetchCountryArtworkQualityLock,
  qualityLockStore,
  render
}: CountryArtworkQualityLockControllerDependencies) {
  async function load(countrySlug: string, force = false): Promise<void> {
    const current = qualityLockStore.getSnapshot(countrySlug);
    if (
      !force &&
      (current.status === "loading" || current.status === "ready")
    ) {
      return;
    }
    qualityLockStore.set(countrySlug, { status: "loading" });
    render();
    try {
      const lock = await fetchCountryArtworkQualityLock({ countrySlug });
      qualityLockStore.set(countrySlug, { status: "ready", lock });
    } catch (error) {
      qualityLockStore.set(countrySlug, {
        status: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
    }
    render();
  }

  function refresh(countrySlug: string): Promise<void> {
    return load(countrySlug, true);
  }

  return { load, refresh };
}
