import type { FlipbookResult } from "./explorerNavigationTypes";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type EnvironmentPlan = {
  layers?: unknown[];
  retryAt?: number;
  status?: string;
  targets?: unknown[];
  version?: string;
  [key: string]: unknown;
};

export function createExplorerClient({
  fetchFn = fetch
}: { fetchFn?: FetchFn } = {}) {
  return {
    async resolveFlipbookClick(
      payload: Record<string, unknown>,
      { signal }: { signal?: AbortSignal } = {}
    ): Promise<FlipbookResult> {
      return requestJson<FlipbookResult>(
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
    async getEnvironmentPlan(
      environmentUrl: string
    ): Promise<EnvironmentPlan> {
      return requestJson<EnvironmentPlan>(fetchFn, environmentUrl, { cache: "no-store" }, "Environment plan failed");
    }
  };
}

async function requestJson<T>(
  fetchFn: FetchFn,
  path: string,
  options: RequestInit,
  fallback: string
): Promise<T> {
  const response = await fetchFn(path, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(
      `${fallback}: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}
