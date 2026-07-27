const FAILED_ARTWORK_STATUSES = new Set(["failed", "cancelled", "timed_out", "error"]);

export type ArtworkJobLike = {
  status?: string | null;
} | null | undefined;

export type ArtworkPageIdentity = {
  id?: string | null;
  nodeId?: string | null;
} | null | undefined;

export function getPageArtworkJobKey(page: ArtworkPageIdentity) {
  return `page:${page?.id ?? page?.nodeId ?? "unknown"}`;
}

export function getPageArtworkCacheKey(page: ArtworkPageIdentity) {
  return page?.nodeId ? `node:${page.nodeId}` : `page:${page?.id ?? "unknown"}`;
}

export function isArtworkJobFailed(job: ArtworkJobLike) {
  return FAILED_ARTWORK_STATUSES.has(job?.status ?? "");
}

export function isArtworkJobPending(job: ArtworkJobLike) {
  return Boolean(job) && job?.status !== "ready" && !isArtworkJobFailed(job);
}

export function getPageReadinessLabel(status: string | null | undefined, hasImage: boolean) {
  if (hasImage) return "facts + illustration ready";
  if (isArtworkJobFailed({ status }) || status === "artwork_failed") {
    return "facts ready · illustration unavailable";
  }
  return "facts ready · illustration loading";
}

export function getArtworkFailureMessage(error: unknown) {
  const originalMessage = String(error ?? "");
  const message = originalMessage.toLowerCase();
  if (message.includes("the factual page remains available")) return originalMessage;
  if (message.includes("401") || message.includes("api key") || message.includes("authentication")) {
    return "The illustration service is not configured right now. The factual page remains available.";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("capacity")) {
    return "The illustration service is busy. The factual page remains available; retry shortly.";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("taking longer")) {
    return "The illustration is taking longer than expected. The factual page remains available.";
  }
  return "We could not finish this illustration. The factual page remains available; retry when ready.";
}
