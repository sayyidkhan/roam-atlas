import {
  getPlaceImageRecordClaimKey,
  normalizePlaceImageClaimPlace
} from "./placeImageMediaPolicy.ts";
import type {
  PlaceImagePaths,
  PlaceImageRepository
} from "./placeImageServiceTypes.ts";

type PlaceImageClaimRegistryOptions = {
  repository: Pick<
    PlaceImageRepository,
    "listStoredRecords"
  >;
  selectionVersion: string;
};

/**
 * Owns country-scoped reference-photo claim identity.
 *
 * Claims prevent one remote image from being silently presented as multiple
 * different mapped places. They are runtime selection policy, never factual
 * evidence about either place.
 */
export function createPlaceImageClaimRegistry({
  repository,
  selectionVersion
}: PlaceImageClaimRegistryOptions) {
  const claimsByCountry =
    new Map<string, Map<string, string>>();

  async function isClaimedByAnotherPlace(
    paths: PlaceImagePaths,
    place: string,
    claimKey: string
  ): Promise<boolean> {
    if (!claimKey) return false;
    const normalizedPlace =
      normalizePlaceImageClaimPlace(place);
    const memoryClaim = claimsByCountry
      .get(paths.countrySlug)
      ?.get(claimKey);
    if (memoryClaim && memoryClaim !== normalizedPlace) {
      return true;
    }

    const records = await repository.listStoredRecords(
      paths.countryCacheRoot
    );
    return records.some((record) => {
      if (record.selectionVersion !== selectionVersion) {
        return false;
      }
      if (
        normalizePlaceImageClaimPlace(record.place) ===
        normalizedPlace
      ) {
        return false;
      }
      return getPlaceImageRecordClaimKey(record) === claimKey;
    });
  }

  function reserve(
    countrySlug: string,
    place: string,
    claimKey: string
  ): void {
    if (!claimKey) return;
    let claims = claimsByCountry.get(countrySlug);
    if (!claims) {
      claims = new Map<string, string>();
      claimsByCountry.set(countrySlug, claims);
    }
    claims.set(
      claimKey,
      normalizePlaceImageClaimPlace(place)
    );
  }

  function release(
    countrySlug: string,
    place: string,
    claimKey: string
  ): void {
    if (!claimKey) return;
    const claims = claimsByCountry.get(countrySlug);
    if (
      claims?.get(claimKey) ===
      normalizePlaceImageClaimPlace(place)
    ) {
      claims.delete(claimKey);
    }
  }

  function clearCountry(countrySlug: string): void {
    claimsByCountry.delete(countrySlug);
  }

  function clearPlace(
    countrySlug: string,
    place: string,
    claimKey = ""
  ): void {
    if (claimKey) release(countrySlug, place, claimKey);
    const normalizedPlace =
      normalizePlaceImageClaimPlace(place);
    const claims = claimsByCountry.get(countrySlug);
    if (!claims || !normalizedPlace) return;
    for (const [storedClaimKey, claimedPlace] of claims) {
      if (claimedPlace === normalizedPlace) {
        claims.delete(storedClaimKey);
      }
    }
  }

  return {
    clearCountry,
    clearPlace,
    isClaimedByAnotherPlace,
    release,
    reserve
  };
}
