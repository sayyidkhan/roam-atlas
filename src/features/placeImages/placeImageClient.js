export function createPlaceImageClient({ fetchFn = fetch } = {}) {
  return {
    reset(payload) {
      return postJson(fetchFn, "/api/place-image/reset", payload, "Reference photo reset failed");
    },
    submitFeedback(payload) {
      return postJson(fetchFn, "/api/place-image/feedback", payload, "Reference photo feedback failed");
    },
    requestSuggestions(payload) {
      return postJson(fetchFn, "/api/place-image/suggestions", payload, "Prompt suggestions failed");
    },
    loadHistory({ countrySlug, place }) {
      const query = new URLSearchParams({ countrySlug, place });
      return requestJson(fetchFn, `/api/place-image/history?${query}`, undefined, "Reference photo history failed");
    },
    selectHistoryEntry(payload) {
      return postJson(fetchFn, "/api/place-image/history/select", payload, "Saved reference photo selection failed");
    },
    deleteHistoryEntry(payload) {
      return postJson(fetchFn, "/api/place-image/history/delete", payload, "Saved reference photo deletion failed");
    }
  };
}

async function postJson(fetchFn, path, payload, fallback) {
  return requestJson(
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

async function requestJson(fetchFn, path, options, fallback) {
  const response = await fetchFn(path, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${fallback}: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
  }
  return response.json();
}
