export type PlaceImageStrategy =
  | "landmark"
  | "metro"
  | "scene"
  | "mixed";

export type PlaceImageProfile = {
  queries: string[];
  strategy: PlaceImageStrategy;
  subject: string;
};

export type PlaceImageProfileInput = {
  context?: string;
  countryName: string;
  countrySlug?: string;
  kind?: string;
  place: string;
  tags?: string[];
};

export type PlaceImageCandidate = {
  imageUrl?: string | null;
  query?: string | null;
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type RankedPlaceImageCandidate<
  Candidate extends PlaceImageCandidate =
    PlaceImageCandidate
> = Candidate & {
  order: number;
  score: number;
};
