export function createCountryDraftClient({ fetchFn = fetch } = {}) {
  return {
    load(countrySlug, { force = false, generate = true } = {}) {
      const query = new URLSearchParams({ countrySlug, generate: String(generate) });
      if (force) query.set("force", "true");
      return requestJson(fetchFn, `/api/country-draft?${query}`, { cache: "no-store" }, "Starter map failed");
    },
    influence(payload) {
      return postJson(fetchFn, "/api/country-draft/influence", payload, "Starter map update failed");
    },
    approve(payload) {
      return postJson(fetchFn, "/api/country-draft/approve-item", payload, "Starter map approval failed");
    },
    reorder(payload) {
      return postJson(fetchFn, "/api/country-draft/reorder", payload, "Starter map reorder failed");
    },
    confirm(payload) {
      return postJson(fetchFn, "/api/country-draft/confirm", payload, "Starter map confirmation failed");
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
    throw new Error(await readResponseError(response, fallback));
  }
  return response.json();
}

async function readResponseError(response, fallback) {
  const body = await response.text().catch(() => "");
  let serverMessage;
  try {
    serverMessage = JSON.parse(body)?.error ?? "";
  } catch {
    serverMessage = body;
  }
  return serverMessage ? `${fallback}: ${serverMessage}` : `${fallback}: ${response.status}`;
}
