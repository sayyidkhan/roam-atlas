export function parseDraftReviewTarget(target) {
  const value = String(target ?? "").trim();
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return null;

  const kind = value.slice(0, separatorIndex);
  const name = value.slice(separatorIndex + 1).trim();
  if (!name || !["region", "theme"].includes(kind)) return null;

  return { kind, name };
}

export function isDraftItemApproved(item) {
  return item?.confidence === "confirmed" || item?.reviewStatus === "human_approved";
}

export function approveDraftItem(draft, target, { sourceUrl = null } = {}) {
  const parsed = parseDraftReviewTarget(target);
  if (!parsed || !draft) {
    return { draft, changed: false, error: "Unknown review target." };
  }

  const item = findDraftItem(draft, parsed);
  if (!item) {
    return { draft, changed: false, error: "Could not find that starter-map item." };
  }

  const resolvedSourceUrl = String(sourceUrl ?? item.sourceUrl ?? "").trim() || null;
  item.reviewStatus = "human_approved";
  item.reviewedAt = new Date().toISOString();
  // This is an explicit curator decision. The UI must reflect that decision as
  // Curated even when a source URL is added later.
  item.confidence = "confirmed";
  if (resolvedSourceUrl) {
    item.sourceUrl = resolvedSourceUrl;
  }

  if (parsed.kind === "region" && Array.isArray(item.children)) {
    for (const child of item.children) {
      child.reviewStatus = item.reviewStatus;
      child.reviewedAt = item.reviewedAt;
      child.confidence = item.confidence;
      if (resolvedSourceUrl && !child.sourceUrl) {
        child.sourceUrl = resolvedSourceUrl;
      }
    }
  }

  draft.changeNote = `Marked ${parsed.name} as curated.`;
  return { draft, changed: true, item, confidence: item.confidence };
}

export function unapproveDraftItem(draft, target) {
  const parsed = parseDraftReviewTarget(target);
  if (!parsed || !draft) {
    return { draft, changed: false, error: "Unknown review target." };
  }

  const item = findDraftItem(draft, parsed);
  if (!item) {
    return { draft, changed: false, error: "Could not find that starter-map item." };
  }

  delete item.reviewStatus;
  delete item.reviewedAt;
  item.confidence = item.sourceUrl ? "likely" : "unconfirmed";

  if (parsed.kind === "region" && Array.isArray(item.children)) {
    for (const child of item.children) {
      delete child.reviewStatus;
      delete child.reviewedAt;
      child.confidence = child.sourceUrl ? "likely" : "unconfirmed";
    }
  }

  draft.changeNote = `Returned ${parsed.name} to needs-review status.`;
  return { draft, changed: true, item, confidence: item.confidence };
}

function findDraftItem(draft, { kind, name }) {
  if (kind === "region") {
    return (draft.regions ?? []).find((region) => region.name === name) ?? null;
  }
  return (draft.themes ?? []).find((theme) => theme.label === name) ?? null;
}
