import type { RuntimeCacheScope } from "./runtimeCacheTypes";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function flushCountryRuntimeCache({
  countrySlug,
  scope,
  fetchFn = fetch
}: {
  countrySlug: string;
  scope: RuntimeCacheScope;
  fetchFn?: FetchFn;
}): Promise<unknown> {
  const response = await fetchFn("/api/runtime-cache/flush", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countrySlug, scope })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Cache flush failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
  }
  return response.json();
}
