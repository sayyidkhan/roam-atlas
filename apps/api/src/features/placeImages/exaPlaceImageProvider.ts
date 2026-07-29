import {
  buildPlaceImageSearchQueries,
  isUsablePlaceImageUrl,
  rankPlaceImageCandidates,
  type PlaceImageProfile
} from "@roamatlas/domain/placeImageSelection.js";

import type {
  PlaceImageCandidate
} from "./placeImageServiceTypes.ts";

type ExaPlaceImageProviderOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, "warn">;
};

type ExaPlaceImageCandidate = PlaceImageCandidate & {
  imageUrl: string;
  sourceUrl: string;
};

export function createExaPlaceImageProvider({
  apiKey,
  fetchFn = fetch,
  logger = console
}: ExaPlaceImageProviderOptions) {
  return {
    available: Boolean(apiKey),

    async search(
      profile: PlaceImageProfile
    ): Promise<ExaPlaceImageCandidate[]> {
      if (!apiKey) return [];
      const candidates: ExaPlaceImageCandidate[] = [];
      const seen = new Set<string>();

      for (
        const query of
          buildPlaceImageSearchQueries(profile)
      ) {
        const batch = await searchQuery({
          apiKey,
          fetchFn,
          logger,
          query
        });
        for (const candidate of batch) {
          if (seen.has(candidate.imageUrl)) {
            continue;
          }
          seen.add(candidate.imageUrl);
          candidates.push({ ...candidate, query });
        }
        if (candidates.length >= 10) break;
      }

      return rankPlaceImageCandidates(
        candidates,
        profile
      ).slice(0, 8);
    }
  };
}

async function searchQuery({
  apiKey,
  fetchFn,
  logger,
  query
}: {
  apiKey: string;
  fetchFn: typeof fetch;
  logger: Pick<Console, "warn">;
  query: string;
}): Promise<ExaPlaceImageCandidate[]> {
  let response: Response;
  try {
    response = await fetchFn(
      "https://api.exa.ai/search",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          numResults: 5,
          contents: {
            extras: { imageLinks: 2 }
          }
        })
      }
    );
  } catch (error) {
    logger.warn(
      `Exa place image search failed for ${query}: ${errorMessage(error)}`
    );
    return [];
  }

  if (!response.ok) {
    logger.warn(
      `Exa place image search failed for ${query}: ` +
        `${response.status} ${await response.text()}`
    );
    return [];
  }

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    return [];
  }

  const candidates: ExaPlaceImageCandidate[] = [];
  for (const result of readExaResults(payload)) {
    const sourceUrl = normalizeString(
      result.url
    );
    const extras = isRecord(result.extras)
      ? result.extras
      : null;
    const imageUrls = [
      result.image,
      ...(Array.isArray(extras?.imageLinks)
        ? extras.imageLinks
        : [])
    ];
    for (const imageUrl of imageUrls) {
      if (!isUsablePlaceImageUrl(imageUrl)) {
        continue;
      }
      candidates.push({
        imageUrl: normalizeString(imageUrl),
        sourceUrl
      });
    }
  }
  return candidates;
}

function readExaResults(
  value: unknown
): Record<string, unknown>[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.results)
  ) {
    return [];
  }
  return value.results.filter(isRecord);
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
