import type {
  PlaceImageCandidate,
  PlaceImageProfile,
  RankedPlaceImageCandidate
} from "./placeImageSelectionTypes.ts";

const POSTER_PENALTY_PATTERN =
  /(?:^|[^a-z])(?:poster|brochure|banner|flyer|logo|logotype|favicon|sprite|icon|emblem|coat[- ]of[- ]arms|flag|infographic|promo|campaign|visit[-_.]|tourism[-_.]?board|travel[-_.]?fair|expo|thumbnail[-_.]?logo|brand[-_.]?guide|hero[-_.]?image|cover[-_.]?photo|header[-_.]?image|welcome[-_.]|discover[-_.]|official[-_.]?site|text[-_.]?overlay|watermark|creative[-_.]?commons|cc[-_.]?(?:by|zero|0)|rights[-_.]?(?:reserved|managed)|copyright|license[-_.]?badge)(?:[^a-z]|$)/i;

const PHOTO_BOOST_PATTERN =
  /(?:photo|photograph|gallery|image|skyline|cityscape|beach|coast|harbour|harbor|landscape|view|aerial|island|waterfall|rainforest|bay|lagoon|street|heritage|downtown|skyscraper|monument|temple|mosque|cathedral|fort|palace|landmark|attraction|waterfront|old town|geopark|cable car|skybridge|sky bridge)/i;

const LANDMARK_BOOST_PATTERN =
  /(?:landmark|attraction|monument|heritage|old town|waterfront|skybridge|sky bridge|cable car|waterfall|beach|mosque|temple|palace|fort|geopark|harbour|harbor|square|viewpoint|national park)/i;

export function scorePlaceImageCandidate(
  candidate: PlaceImageCandidate,
  profile: Pick<PlaceImageProfile, "strategy">
): number {
  const haystack =
    `${candidate.imageUrl ?? ""} ` +
    `${candidate.sourceUrl ?? ""} ` +
    `${candidate.query ?? ""}`;
  const normalizedHaystack = haystack.toLowerCase();
  let score = 0;

  if (
    POSTER_PENALTY_PATTERN.test(
      normalizedHaystack
    )
  ) {
    score -= 45;
  }
  if (
    /\.(?:svg|ico|gif)(?:$|[?#])/i.test(
      normalizedHaystack
    )
  ) {
    score -= 50;
  }
  if (
    PHOTO_BOOST_PATTERN.test(normalizedHaystack)
  ) {
    score += 10;
  }
  if (
    /upload\.wikimedia\.org|commons\.wikimedia\.org/i.test(
      normalizedHaystack
    )
  ) {
    score += 8;
  }
  if (
    LANDMARK_BOOST_PATTERN.test(
      normalizedHaystack
    )
  ) {
    score += 14;
  }

  if (profile.strategy === "landmark") {
    if (
      LANDMARK_BOOST_PATTERN.test(
        normalizedHaystack
      )
    ) {
      score += 20;
    }
    if (
      /(?:poster|brochure|banner|logo|flag|visit[-_.]|tourism[-_.]?board|hero[-_.]?image|cover[-_.]?photo)/i.test(
        normalizedHaystack
      )
    ) {
      score -= 35;
    }
  }

  if (
    profile.strategy === "metro" ||
    profile.strategy === "mixed"
  ) {
    if (
      /(?:landmark|heritage|old town|monument|mosque|temple|waterfront|attraction)/i.test(
        normalizedHaystack
      )
    ) {
      score += 20;
    }
    if (
      /(?:skyline|cityscape|downtown|urban|capital|skyscraper)/i.test(
        normalizedHaystack
      )
    ) {
      score += 12;
    }
    if (
      /(?:poster|brochure|banner|logo|flag)/i.test(
        normalizedHaystack
      )
    ) {
      score -= 25;
    }
  }

  if (
    profile.strategy === "scene" ||
    profile.strategy === "mixed"
  ) {
    if (
      /(?:beach|island|coast|landscape|view|aerial|waterfall|rainforest|bay|lagoon|harbour|harbor|landmark|attraction)/i.test(
        normalizedHaystack
      )
    ) {
      score += 16;
    }
    if (
      /(?:poster|brochure|banner|logo|flag|visit[-_.]|tourism[-_.]?board|hero[-_.]?image|cover[-_.]?photo)/i.test(
        normalizedHaystack
      )
    ) {
      score -= 30;
    }
  }

  return score;
}

export function rankPlaceImageCandidates<
  Candidate extends PlaceImageCandidate
>(
  candidates: readonly Candidate[],
  profile: Pick<PlaceImageProfile, "strategy">
): Array<RankedPlaceImageCandidate<Candidate>> {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      score: scorePlaceImageCandidate(
        candidate,
        profile
      ),
      order: index
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.order - right.order
    );
}

export function isUsablePlaceImageUrl(
  value: unknown
): boolean {
  const imageUrl = String(value ?? "").trim();
  if (!imageUrl) return false;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const pathname = parsed.pathname.toLowerCase();
    if (/\.(?:svg|ico|gif)$/.test(pathname)) {
      return false;
    }
    if (POSTER_PENALTY_PATTERN.test(imageUrl)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
