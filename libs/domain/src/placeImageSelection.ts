// Bump whenever eligibility changes so old, low-quality cached selections are
// re-evaluated rather than surviving indefinitely in the local runtime cache.
export const PLACE_IMAGE_SELECTION_VERSION = "v5";

export {
  buildPlaceImageSearchQueries,
  formatExaPlaceImageQuery,
  inferPlaceImageProfile
} from "./placeImageProfile.ts";
export {
  isUsablePlaceImageUrl,
  rankPlaceImageCandidates,
  scorePlaceImageCandidate
} from "./placeImageCandidateRanking.ts";
export type {
  PlaceImageCandidate,
  PlaceImageProfile,
  PlaceImageProfileInput,
  PlaceImageStrategy,
  RankedPlaceImageCandidate
} from "./placeImageSelectionTypes.ts";
