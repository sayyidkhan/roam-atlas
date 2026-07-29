import type {
  CountryDraft,
  CountryDraftConfirmation
} from "./countryDraftTypes";
import type { DraftMessage } from "../countrySetup/countryExperiencePolicy";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type CountryDraftResponse = {
  draft?: CountryDraft | null;
  message?: DraftMessage;
};

type CountryDraftMutationResponse = {
  draft: CountryDraft;
  message?: DraftMessage;
};

type CountryDraftReorderResponse = {
  draft?: CountryDraft;
};

export function createCountryDraftClient({
  fetchFn = fetch
}: { fetchFn?: FetchFn } = {}) {
  return {
    load(
      countrySlug: string,
      {
        force = false,
        generate = true
      }: { force?: boolean; generate?: boolean } = {}
    ): Promise<CountryDraftResponse> {
      const query = new URLSearchParams({ countrySlug, generate: String(generate) });
      if (force) query.set("force", "true");
      return requestJson(fetchFn, `/api/country-draft?${query}`, { cache: "no-store" }, "Starter map failed");
    },
    influence(payload: unknown): Promise<CountryDraftMutationResponse> {
      return postJson<CountryDraftMutationResponse>(fetchFn, "/api/country-draft/influence", payload, "Starter map update failed");
    },
    approve(payload: unknown): Promise<CountryDraftMutationResponse> {
      return postJson<CountryDraftMutationResponse>(fetchFn, "/api/country-draft/approve-item", payload, "Starter map approval failed");
    },
    reorder(payload: unknown): Promise<CountryDraftReorderResponse> {
      return postJson<CountryDraftReorderResponse>(fetchFn, "/api/country-draft/reorder", payload, "Starter map reorder failed");
    },
    confirm(payload: unknown): Promise<CountryDraftConfirmation> {
      return postJson<CountryDraftConfirmation>(fetchFn, "/api/country-draft/confirm", payload, "Starter map confirmation failed");
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

async function requestJson<T = CountryDraftResponse>(
  fetchFn: FetchFn,
  path: string,
  options: RequestInit,
  fallback: string
): Promise<T> {
  const response = await fetchFn(path, options);
  if (!response.ok) {
    throw new Error(await readResponseError(response, fallback));
  }
  return response.json() as Promise<T>;
}

async function readResponseError(
  response: Response,
  fallback: string
): Promise<string> {
  const body = await response.text().catch(() => "");
  let serverMessage: string;
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    serverMessage = String(parsed.error ?? "");
  } catch {
    serverMessage = body;
  }
  return serverMessage ? `${fallback}: ${serverMessage}` : `${fallback}: ${response.status}`;
}
