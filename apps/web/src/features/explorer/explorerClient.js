export function createExplorerClient({ fetchFn = fetch } = {}) {
  return {
    async resolveFlipbookClick(payload, { signal } = {}) {
      return requestJson(
        fetchFn,
        "/api/flipbook/click",
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        },
        "Flipbook click failed"
      );
    },
    async getEnvironmentPlan(environmentUrl) {
      return requestJson(fetchFn, environmentUrl, { cache: "no-store" }, "Environment plan failed");
    }
  };
}

async function requestJson(fetchFn, path, options, fallback) {
  const response = await fetchFn(path, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(`${fallback}: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
