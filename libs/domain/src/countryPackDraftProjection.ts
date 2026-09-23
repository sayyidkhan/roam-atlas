import {
  isInternalThemeTag,
  isRecord,
  safeText,
  slugifyDraftId,
  titleCase
} from "./countryDraftTextPolicy.ts";
import type {
  CountryDraft,
  CountryDraftChild,
  CountryDraftConfidence,
  CountryDraftRegion,
  CountryDraftStarterMapOptions,
  CountryDraftTheme,
  CountryPackInput,
  CountryPackNode
} from "./countryDraftTypes.ts";

const MAX_PACK_CHILD_DEPTH = 4;

type PackThemeSummary = {
  label: string;
  nodeTitles: string[];
};

export function refreshCuratedPackSnapshotThemes<
  Draft
>(draft: Draft, pack: unknown): Draft {
  if (
    !isRecord(draft) ||
    draft.mode !== "curated_pack_snapshot" ||
    !isCountryPackInput(pack)
  ) {
    return draft;
  }
  return {
    ...draft,
    themes: buildPackThemeDraftItems(pack)
  };
}

export function createCountryPackStarterMap(
  pack: unknown,
  options: CountryDraftStarterMapOptions = {}
): CountryDraft {
  const countryPack = requireCountryPack(pack);
  const childNodes = getPackChildNodes(countryPack);
  const isConfirmedPack =
    countryPack.confidence !== "unconfirmed";
  const confidence: CountryDraftConfidence =
    isConfirmedPack ? "confirmed" : "unconfirmed";
  const sourceType = isConfirmedPack
    ? "curated"
    : "ai_generated";
  const packLabel = isConfirmedPack
    ? "curated"
    : "starter";

  return {
    countryCode: countryPack.countryCode,
    countrySlug: countryPack.countrySlug,
    countryName: countryPack.title,
    mode: "curated_pack_snapshot",
    generationStatus: "ready",
    confidence,
    sourceType,
    sourceRegistry: [],
    factBoundary:
      countryPack.factBoundary ??
      `This starter map is derived from the ${packLabel} RoamAtlas country pack.`,
    summary:
      `${countryPack.title} is backed by a ${packLabel} ` +
      `RoamAtlas country pack with ${
        Object.keys(countryPack.nodes).length
      } nodes and ${
        Object.keys(countryPack.scenes).length
      } scenes.`,
    regions: childNodes.slice(0, 8).map(
      (node): CountryDraftRegion => ({
        name: node.title,
        kind: packNodeKind(node.type),
        why: countryPackNodeReason(node, {
          isConfirmedPack
        }),
        confidence,
        children: collectPackNodeChildren(
          node,
          countryPack,
          confidence
        )
      })
    ),
    themes: buildPackThemeDraftItems(
      countryPack,
      childNodes
    ),
    reviewChecklist: isConfirmedPack
      ? [
          "Keep source URLs beside each accepted fact.",
          "Update curated nodes before changing verified user-facing claims.",
          "Regenerate visual assets only after factual data changes are reviewed."
        ]
      : [
          "Replace ai_generated facts with source-backed facts.",
          "Keep confidence unconfirmed until official or curated sources are added.",
          "Do not use starter facts for verified itinerary claims."
        ],
    warnings: isConfirmedPack
      ? [
          "This file is a runtime snapshot of curated data, not the source of truth.",
          `Edit the country pack source files to change confirmed ${countryPack.title} data.`
        ]
      : [
          "This file is a runtime snapshot of starter country-pack data.",
          "Facts remain unconfirmed until source review."
        ],
    changeNote: "",
    generatedAt:
      options.generatedAt ?? new Date().toISOString(),
    model: null,
    unavailableReason: null
  };
}

export function createCountryPackDraftFromStarterMap(
  draft: CountryDraft,
  options: CountryDraftStarterMapOptions = {}
) {
  const countrySlug = draft.countrySlug;
  const regionNodes = (draft.regions ?? []).map(
    (region) => {
      const id =
        `${countrySlug}-${slugifyDraftId(region.name)}`;
      const sourceUrl = region.sourceUrl ?? null;
      return {
        id,
        type: "district",
        title: region.name,
        parentId: countrySlug,
        childIds: [],
        tags: [region.kind, "starter-map"].filter(
          Boolean
        ),
        facts: [
          {
            id: `${id}-starter-note`,
            text: region.why,
            sourceType: sourceUrl
              ? "exa_grounded"
              : "ai_generated",
            confidence:
              region.confidence === "likely"
                ? "likely"
                : "unconfirmed",
            sourceUrl
          }
        ],
        promotionStatus: "pending_source_review"
      };
    }
  );

  return {
    countryCode: draft.countryCode,
    countrySlug,
    countryName: draft.countryName,
    status: "pending_source_review",
    sourceStarterMapMode: draft.mode,
    sourceType: draft.sourceType,
    confidence: "unconfirmed",
    factBoundary:
      "This generated country-pack draft is not registered as curated data until sources are reviewed.",
    generatedAt:
      options.generatedAt ?? new Date().toISOString(),
    rootNodeId: countrySlug,
    overviewSceneId: `${countrySlug}-overview`,
    nodes: [
      {
        id: countrySlug,
        type: "country",
        title: draft.countryName,
        childIds: regionNodes.map((node) => node.id),
        tags: ["starter-map"],
        facts: [
          {
            id: `${countrySlug}-starter-summary`,
            text: draft.summary,
            sourceType: "ai_generated",
            confidence: "unconfirmed",
            sourceUrl: null
          }
        ],
        promotionStatus: "pending_source_review"
      },
      ...regionNodes
    ],
    themes: (draft.themes ?? []).map((theme) => ({
      label: theme.label,
      note: theme.note,
      confidence:
        theme.confidence === "likely"
          ? "likely"
          : "unconfirmed",
      sourceType: theme.sourceUrl
        ? "exa_grounded"
        : "ai_generated",
      sourceUrl: theme.sourceUrl ?? null
    })),
    reviewChecklist: [
      "Verify each candidate against official tourism, state, city, or operator sources.",
      "Replace ai_generated facts with sourced facts before registering this as a country pack.",
      "Add scenes and routes only after node ids and source-backed facts are reviewed."
    ]
  };
}

export function summarizePackThemes(
  nodes: readonly unknown[],
  countrySlug = ""
): PackThemeSummary[] {
  const themeNodes = new Map<string, string[]>();
  for (const value of nodes) {
    if (!isCountryPackNode(value)) continue;
    for (const tag of value.tags ?? []) {
      if (isInternalThemeTag(tag, countrySlug)) {
        continue;
      }
      const normalized = String(tag)
        .trim()
        .toLowerCase();
      const nodeTitles =
        themeNodes.get(normalized) ?? [];
      if (!themeNodes.has(normalized)) {
        themeNodes.set(normalized, nodeTitles);
      }
      nodeTitles.push(value.title);
    }
  }

  return [...themeNodes.entries()]
    .map(([label, nodeTitles]) => ({
      label,
      nodeTitles
    }))
    .sort(
      (a, b) =>
        b.nodeTitles.length - a.nodeTitles.length ||
        a.label.localeCompare(b.label)
    );
}

function getPackChildNodes(
  pack: CountryPackInput
): CountryPackNode[] {
  const rootNode = pack.nodes[pack.rootNodeId];
  return (rootNode?.childIds ?? [])
    .map((nodeId) => pack.nodes[nodeId])
    .filter(
      (node): node is CountryPackNode =>
        node !== undefined
    );
}

function buildPackThemeDraftItems(
  pack: CountryPackInput,
  childNodes = getPackChildNodes(pack)
): CountryDraftTheme[] {
  const themeSummaries = summarizePackThemes(
    childNodes,
    pack.countrySlug
  );
  const isConfirmedPack =
    pack.confidence !== "unconfirmed";
  const confidence: CountryDraftConfidence =
    isConfirmedPack ? "confirmed" : "unconfirmed";
  return themeSummaries.slice(0, 6).map((theme) => ({
    label: titleCase(theme.label),
    note: packThemeNote(theme, pack.title, {
      isConfirmedPack
    }),
    confidence
  }));
}

function collectPackNodeChildren(
  node: CountryPackNode,
  pack: CountryPackInput,
  confidence: CountryDraftConfidence,
  depth = 0
): CountryDraftChild[] {
  if (depth >= MAX_PACK_CHILD_DEPTH) return [];
  return (node.childIds ?? [])
    .map((childId) => pack.nodes[childId])
    .filter(
      (child): child is CountryPackNode =>
        child !== undefined
    )
    .map((child) => ({
      name: child.title,
      kind: child.type,
      confidence,
      children: collectPackNodeChildren(
        child,
        pack,
        confidence,
        depth + 1
      )
    }));
}

function countryPackNodeReason(
  node: CountryPackNode,
  {
    isConfirmedPack
  }: { isConfirmedPack: boolean }
): string {
  const childCount = node.childIds?.length ?? 0;
  const childText =
    childCount === 1
      ? "1 curated child node"
      : `${childCount} curated child nodes`;
  if (isConfirmedPack) {
    return (
      `${node.title} is part of the curated ` +
      `RoamAtlas graph with ${childText}.`
    );
  }

  const primaryFact = firstMeaningfulStarterFact(node);
  if (primaryFact) return primaryFact;

  const candidateLens = (node.tags ?? [])
    .filter(
      (tag) =>
        ![
          "starter-map",
          "unconfirmed",
          "overview",
          node.title.toLowerCase()
        ].includes(tag)
    )
    .slice(0, 2)
    .map(titleCase)
    .join(" and ");
  const lensText = candidateLens
    ? ` as a ${candidateLens.toLowerCase()} chapter`
    : "";
  return (
    `Research ${node.title}${lensText}: identify the ` +
    "travel style, visual anchors, nearby clusters, " +
    "and source-backed facts before promotion."
  );
}

function firstMeaningfulStarterFact(
  node: CountryPackNode
): string | undefined {
  return (node.facts ?? [])
    .map((fact) => safeText(fact.text, "", 220))
    .find(
      (text) =>
        text && !isInternalPlaceholderText(text)
    );
}

function isInternalPlaceholderText(text: string): boolean {
  return /\b(?:starter[-\s]?map|starter RoamAtlas graph|source review|needs source review|replace this note|pending curation)\b/i.test(
    text
  );
}

function packThemeNote(
  theme: PackThemeSummary,
  countryName: string,
  { isConfirmedPack }: { isConfirmedPack: boolean }
): string {
  const nodeCount = theme.nodeTitles.length;
  const shownNodes = theme.nodeTitles
    .slice(0, 3)
    .join(", ");
  const remainingCount = Math.max(0, nodeCount - 3);
  const nodeList =
    remainingCount > 0
      ? `${shownNodes}, and ${remainingCount} more`
      : shownNodes;
  const sourceLabel = isConfirmedPack
    ? "curated parent"
    : "starter parent";
  const nodeLabel = nodeCount === 1 ? "node" : "nodes";
  return (
    `${titleCase(theme.label)} appears across ` +
    `${nodeCount} ${sourceLabel} ${nodeLabel} in ` +
    `${countryName}: ${nodeList}.`
  );
}

function packNodeKind(type: string): string {
  if (type === "district") return "region";
  if (type === "country") return "region";
  if (type === "attraction") return "area";
  return "area";
}

function requireCountryPack(
  value: unknown
): CountryPackInput {
  if (!isCountryPackInput(value)) {
    throw new TypeError(
      "Country pack must include typed country identity, nodes, and scenes."
    );
  }
  return value;
}

function isCountryPackInput(
  value: unknown
): value is CountryPackInput {
  return (
    isRecord(value) &&
    typeof value.countryCode === "string" &&
    typeof value.countrySlug === "string" &&
    typeof value.title === "string" &&
    typeof value.rootNodeId === "string" &&
    isRecord(value.nodes) &&
    Object.values(value.nodes).every(
      isCountryPackNode
    ) &&
    isRecord(value.scenes)
  );
}

function isCountryPackNode(
  value: unknown
): value is CountryPackNode {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.type === "string" &&
    (value.childIds === undefined ||
      (Array.isArray(value.childIds) &&
        value.childIds.every(
          (childId) => typeof childId === "string"
        ))) &&
    (value.tags === undefined ||
      (Array.isArray(value.tags) &&
        value.tags.every(
          (tag) => typeof tag === "string"
        ))) &&
    (value.facts === undefined ||
      (Array.isArray(value.facts) &&
        value.facts.every(isRecord)))
  );
}
