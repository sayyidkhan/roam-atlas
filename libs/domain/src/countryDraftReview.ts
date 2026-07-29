import type {
  CountryDraftConfidence
} from "./countryDraftTypes.ts";

export type DraftReviewTarget =
  | {
      kind: "node";
      path: number[];
    }
  | {
      kind: "region";
      name: string;
    }
  | {
      kind: "theme";
      name: string;
    };

export type DraftReviewItem = {
  children?: DraftReviewItem[];
  confidence?: CountryDraftConfidence | string;
  kind?: string;
  label?: string;
  name?: string;
  reviewedAt?: string;
  reviewStatus?: string;
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type DraftReviewDocument = {
  changeNote?: string;
  regions?: DraftReviewItem[];
  themes?: DraftReviewItem[];
  [key: string]: unknown;
};

export type DraftReviewResult<
  Draft extends DraftReviewDocument
> = {
  additions?: DraftReviewItem[];
  changed: boolean;
  confidence?: CountryDraftConfidence | string;
  draft: Draft | null;
  error?: string;
  item?: DraftReviewItem;
};

type DraftReviewOptions = {
  recursive?: boolean;
  sourceUrl?: string | null;
};

export function parseDraftReviewTarget(
  target: unknown
): DraftReviewTarget | null {
  const value = String(target ?? "").trim();
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return null;

  const kind = value.slice(0, separatorIndex);
  const name = value.slice(separatorIndex + 1).trim();
  if (!name) return null;
  if (kind === "node") {
    const path = name
      .split(".")
      .map((part) => Number(part));
    if (
      !path.length ||
      path.some(
        (part) =>
          !Number.isInteger(part) || part < 1
      )
    ) {
      return null;
    }
    return { kind, path };
  }
  if (kind !== "region" && kind !== "theme") {
    return null;
  }

  return { kind, name };
}

export function isDraftItemApproved(
  item: DraftReviewItem | null | undefined
): boolean {
  return (
    item?.confidence === "confirmed" ||
    item?.reviewStatus === "human_approved"
  );
}

export function approveDraftItem<
  Draft extends DraftReviewDocument
>(
  draft: Draft | null,
  target: unknown,
  {
    sourceUrl = null,
    recursive = false
  }: DraftReviewOptions = {}
): DraftReviewResult<Draft> {
  const parsed = parseDraftReviewTarget(target);
  if (!parsed || !draft) {
    return {
      draft,
      changed: false,
      error: "Unknown review target."
    };
  }

  const item = findDraftItem(draft, parsed);
  if (!item) {
    return {
      draft,
      changed: false,
      error:
        "Could not find that starter-map item."
    };
  }

  const resolvedSourceUrl =
    String(sourceUrl ?? item.sourceUrl ?? "").trim() ||
    null;
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
      if (
        resolvedSourceUrl &&
        !child.sourceUrl
      ) {
        child.sourceUrl = resolvedSourceUrl;
      }
    });
  }

  draft.changeNote =
    `Marked ${item.name ?? item.label ?? "item"}` +
    `${recursive ? " and its nested nodes" : ""} as curated.`;
  return {
    draft,
    changed: true,
    item,
    confidence: item.confidence
  };
}

export function unapproveDraftItem<
  Draft extends DraftReviewDocument
>(
  draft: Draft | null,
  target: unknown,
  {
    recursive = false
  }: Pick<DraftReviewOptions, "recursive"> = {}
): DraftReviewResult<Draft> {
  const parsed = parseDraftReviewTarget(target);
  if (!parsed || !draft) {
    return {
      draft,
      changed: false,
      error: "Unknown review target."
    };
  }

  const item = findDraftItem(draft, parsed);
  if (!item) {
    return {
      draft,
      changed: false,
      error:
        "Could not find that starter-map item."
    };
  }

  delete item.reviewStatus;
  delete item.reviewedAt;
  item.confidence = item.sourceUrl
    ? "likely"
    : "unconfirmed";

  if (recursive) {
    forEachDraftDescendant(item, (child) => {
      delete child.reviewStatus;
      delete child.reviewedAt;
      child.confidence = child.sourceUrl
        ? "likely"
        : "unconfirmed";
    });
  }

  draft.changeNote =
    `Returned ${item.name ?? item.label ?? "item"}` +
    `${recursive ? " and its nested nodes" : ""} to needs-review status.`;
  return {
    draft,
    changed: true,
    item,
    confidence: item.confidence
  };
}

export function appendUnconfirmedRegionCandidates<
  Draft extends DraftReviewDocument
>(
  draft: Draft,
  regionName: string,
  proposedDraft: DraftReviewDocument
): DraftReviewResult<Draft> {
  const region =
    (draft.regions ?? []).find(
      (item) => item.name === regionName
    ) ?? null;
  const proposal =
    (proposedDraft.regions ?? []).find(
      (item) => item.name === regionName
    ) ?? null;
  if (!region || !proposal) {
    return {
      draft,
      changed: false,
      error:
        "Could not find the selected region in the proposed update."
    };
  }

  const existingNames = new Set(
    (region.children ?? [])
      .map((child) => normalizeName(child.name))
      .filter(Boolean)
  );
  const additions = (proposal.children ?? [])
    .filter(
      (child) =>
        normalizeName(child.name) &&
        !existingNames.has(normalizeName(child.name))
    )
    .map(toUnconfirmedCandidate);
  if (!additions.length) {
    return {
      draft,
      changed: false,
      error:
        "No new candidate places were returned for this region."
    };
  }

  region.children = [
    ...(region.children ?? []),
    ...additions
  ];
  draft.changeNote =
    `Added ${additions.length} unconfirmed candidate` +
    `${additions.length === 1 ? "" : "s"} to ${region.name ?? regionName}.`;
  return {
    draft,
    changed: true,
    item: region,
    additions
  };
}

function findDraftItem(
  draft: DraftReviewDocument,
  target: DraftReviewTarget
): DraftReviewItem | null {
  if (target.kind === "region") {
    return (
      (draft.regions ?? []).find(
        (region) => region.name === target.name
      ) ?? null
    );
  }
  if (target.kind === "theme") {
    return (
      (draft.themes ?? []).find(
        (theme) => theme.label === target.name
      ) ?? null
    );
  }

  let current: DraftReviewItem | null =
    (draft.regions ?? [])[target.path[0] - 1] ??
    null;
  for (const index of target.path.slice(1)) {
    current =
      current?.children?.[index - 1] ?? null;
  }
  return current;
}

function forEachDraftDescendant(
  item: DraftReviewItem,
  callback: (child: DraftReviewItem) => void
): void {
  for (const child of item.children ?? []) {
    callback(child);
    forEachDraftDescendant(child, callback);
  }
}

function toUnconfirmedCandidate(
  item: DraftReviewItem
): DraftReviewItem {
  return {
    name: item.name,
    kind: item.kind,
    confidence: "unconfirmed",
    children: (item.children ?? []).map(
      toUnconfirmedCandidate
    )
  };
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
