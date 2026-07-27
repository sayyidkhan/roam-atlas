import {
  buildPlaceImageSearchQueries,
  isUsablePlaceImageUrl,
  rankPlaceImageCandidates
} from "../../domain/placeImageSelection.js";

export function createExaPlaceImageProvider({
  apiKey,
  fetchFn = fetch,
  logger = console
}) {
  return {
    available: Boolean(apiKey),

    async search(profile) {
      if (!apiKey) return [];
      const candidates = [];
      const seen = new Set();

      for (const query of buildPlaceImageSearchQueries(profile)) {
        const batch = await searchQuery({ apiKey, fetchFn, logger, query });
        for (const candidate of batch) {
          if (seen.has(candidate.imageUrl)) continue;
          seen.add(candidate.imageUrl);
          candidates.push({ ...candidate, query });
        }
        if (candidates.length >= 10) break;
      }

      return rankPlaceImageCandidates(candidates, profile).slice(0, 8);
    }
  };
}

async function searchQuery({ apiKey, fetchFn, logger, query }) {
  let response;
  try {
    response = await fetchFn("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        contents: { extras: { imageLinks: 2 } }
      })
    });
  } catch (error) {
    logger.warn(`Exa place image search failed for ${query}: ${String(error?.message ?? error)}`);
    return [];
  }

  if (!response.ok) {
    logger.warn(`Exa place image search failed for ${query}: ${response.status} ${await response.text()}`);
    return [];
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return [];
  }

  const candidates = [];
  for (const result of Array.isArray(payload?.results) ? payload.results : []) {
    const sourceUrl = String(result?.url ?? "").trim();
    const imageUrls = [
      result?.image,
      ...(Array.isArray(result?.extras?.imageLinks) ? result.extras.imageLinks : [])
    ];
    for (const imageUrl of imageUrls) {
      if (isUsablePlaceImageUrl(imageUrl)) {
        candidates.push({ imageUrl: String(imageUrl).trim(), sourceUrl });
      }
    }
  }
  return candidates;
}
