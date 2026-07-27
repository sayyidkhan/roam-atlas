import {
  RuntimeCacheFlushRequestSchema,
  RuntimeCacheFlushResponseSchema
} from "./runtimeCacheContract.js";

/**
 * Transport boundary for country-scoped runtime artifact cleanup. The runtime
 * supplies the two destructive operations; this feature limits callers to a
 * known country and either the visual-only or full-cache scope.
 */
export async function handleRuntimeCacheFlushHttpRequest({
  request,
  response,
  readJson,
  getCountryBySlug,
  flushVisualCache,
  flushRuntimeCache
}) {
  const parsed = RuntimeCacheFlushRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    sendJson(response, 400, { error: "A country slug is required and scope must be visuals or all." });
    return;
  }
  const countrySlug = parsed.data.countrySlug.toLowerCase();
  const scope = parsed.data.scope ?? "all";
  const country = getCountryBySlug(countrySlug);
  if (!country) {
    sendJson(response, 404, { error: `Unknown country: ${countrySlug}` });
    return;
  }

  const result = scope === "visuals"
    ? await flushVisualCache(country.slug)
    : await flushRuntimeCache(country.slug);
  sendJson(response, 200, RuntimeCacheFlushResponseSchema.parse({
    countrySlug: country.slug,
    countryName: country.name,
    scope,
    ...result
  }));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
