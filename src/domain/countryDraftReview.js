export function parseDraftReviewTarget(target) {
  const value = String(target ?? "").trim();
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return null;

  const kind = value.slice(0, separatorIndex);
  const name = value.slice(separatorIndex + 1).trim();
  if (!name) return null;
  if (kind === "node") {
    const path = name.split(".").map((part) => Number(part));
    if (!path.length || path.some((part) => !Number.isInteger(part) || part < 1)) return null;
    return { kind, path };
  }
  if (!["region", "theme"].includes(kind)) return null;

  return { kind, name };
}

export function isDraftItemApproved(item) {
  return item?.confidence === "confirmed" || item?.reviewStatus === "human_approved";
}

export function approveDraftItem(draft, target, { sourceUrl = null, recursive = false } = {}) {
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

  if (recursive) {
    forEachDraftDescendant(item, (child) => {
      child.reviewStatus = item.reviewStatus;
      child.reviewedAt = item.reviewedAt;
      child.confidence = item.confidence;
      if (resolvedSourceUrl && !child.sourceUrl) child.sourceUrl = resolvedSourceUrl;
    });
  }

  draft.changeNote = `Marked ${item.name ?? item.label ?? "item"}${recursive ? " and its nested nodes" : ""} as curated.`;
  return { draft, changed: true, item, confidence: item.confidence };
}

export function unapproveDraftItem(draft, target, { recursive = false } = {}) {
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

  if (recursive) {
    forEachDraftDescendant(item, (child) => {
      delete child.reviewStatus;
      delete child.reviewedAt;
      child.confidence = child.sourceUrl ? "likely" : "unconfirmed";
    });
  }

  draft.changeNote = `Returned ${item.name ?? item.label ?? "item"}${recursive ? " and its nested nodes" : ""} to needs-review status.`;
  return { draft, changed: true, item, confidence: item.confidence };
}

export function appendUnconfirmedRegionCandidates(draft, regionName, proposedDraft) {
  const region = (draft?.regions ?? []).find((item) => item.name === regionName) ?? null;
  const proposal = (proposedDraft?.regions ?? []).find((item) => item.name === regionName) ?? null;
  if (!region || !proposal) {
    return { draft, changed: false, error: "Could not find the selected region in the proposed update." };
  }

  const existingNames = new Set((region.children ?? []).map((child) => child.name.trim().toLowerCase()));
  const additions = (proposal.children ?? [])
    .filter((child) => child?.name && !existingNames.has(child.name.trim().toLowerCase()))
    .map(toUnconfirmedCandidate);
  if (!additions.length) {
    return { draft, changed: false, error: "No new candidate places were returned for this region." };
  }

  region.children = [...(region.children ?? []), ...additions];
  draft.changeNote = `Added ${additions.length} unconfirmed candidate${additions.length === 1 ? "" : "s"} to ${region.name}.`;
  return { draft, changed: true, item: region, additions };
}

function findDraftItem(draft, target) {
  const { kind, name } = target;
  if (kind === "region") {
    return (draft.regions ?? []).find((region) => region.name === name) ?? null;
  }
  if (kind === "theme") return (draft.themes ?? []).find((theme) => theme.label === name) ?? null;

  let current = (draft.regions ?? [])[target.path[0] - 1] ?? null;
  for (const index of target.path.slice(1)) {
    current = current?.children?.[index - 1] ?? null;
  }
  return current;
}

function forEachDraftDescendant(item, callback) {
  for (const child of item?.children ?? []) {
    callback(child);
    forEachDraftDescendant(child, callback);
  }
}

function toUnconfirmedCandidate(item) {
  return {
    name: item.name,
    kind: item.kind,
    confidence: "unconfirmed",
    children: (item.children ?? []).map(toUnconfirmedCandidate)
  };
}
