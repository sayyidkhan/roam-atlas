import type {
  PlaceImageHistoryResult,
  PlaceImageSuggestionPayload
} from "./placeImageTypes";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export function createPlaceImageClient({
  fetchFn = fetch
}: { fetchFn?: FetchFn } = {}) {
  return {
    reset(payload: unknown): Promise<unknown> {
      return postJson<unknown>(fetchFn, "/api/place-image/reset", payload, "Reference photo reset failed");
    },
    submitFeedback(payload: unknown): Promise<unknown> {
      return postJson<unknown>(fetchFn, "/api/place-image/feedback", payload, "Reference photo feedback failed");
    },
    requestSuggestions(payload: unknown): Promise<PlaceImageSuggestionPayload> {
      return postJson<PlaceImageSuggestionPayload>(fetchFn, "/api/place-image/suggestions", payload, "Prompt suggestions failed");
    },
    loadHistory({
      countrySlug,
      place
    }: {
      countrySlug: string;
      place: string;
    }): Promise<PlaceImageHistoryResult> {
      const query = new URLSearchParams({ countrySlug, place });
      return requestJson(fetchFn, `/api/place-image/history?${query}`, undefined, "Reference photo history failed");
    },
    selectHistoryEntry(payload: unknown): Promise<unknown> {
      return postJson<unknown>(fetchFn, "/api/place-image/history/select", payload, "Saved reference photo selection failed");
    },
    deleteHistoryEntry(payload: unknown): Promise<PlaceImageHistoryResult> {
      return postJson<PlaceImageHistoryResult>(fetchFn, "/api/place-image/history/delete", payload, "Saved reference photo deletion failed");
    }
  };
}

async function postJson<T>(
  fetchFn: FetchFn,
  path: string,
  payload: unknown,
  fallback: string
): Promise<T> {
  return requestJson<T>(
    fetchFn,
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    fallback
  );
}

async function requestJson<T>(
  fetchFn: FetchFn,
  path: string,
  options: RequestInit | undefined,
  fallback: string
): Promise<T> {
  const response = await fetchFn(path, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${fallback}: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
  }
  return response.json() as Promise<T>;
}
