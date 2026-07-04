const DEFAULT_REVIEW_CHECKLIST = [
  "Verify candidate places against official tourism or operator sources.",
  "Add source URLs beside each accepted fact.",
  "Separate cities, states, attractions, and itinerary items before promotion.",
  "Do not add opening hours, prices, or route timing without fresh sources."
];

const DEFAULT_WARNINGS = [
  "This is an AI-generated expansion draft, not a curated RoamAtlas country pack.",
  "Generated candidates are not available to verified itinerary or fact flows yet."
];

const FORBIDDEN_DETAIL_PATTERNS = [
  /\bopening hours?\b/i,
  /\bhours?\b/i,
  /\btickets?\b/i,
  /\bprices?\b/i,
  /\bfares?\b/i,
  /\bcosts?\b/i,
  /\bclosures?\b/i,
  /\bclosed\b/i,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s?(?:am|pm)\b/i,
  /https?:\/\//i,
  /\$\s?\d/
];

export const COUNTRY_DRAFT_FACT_BOUNDARY =
  "AI starter maps are planning scaffolds only. They are not confirmed travel facts.";

export function buildCountryDraftPrompt(country) {
  return [
    "You are drafting a RoamAtlas country expansion scaffold.",
    "The output is only for planning future curation. It is not verified user-facing travel data.",
    `Country: ${country.name}`,
    `ISO code: ${country.code}`,
    `Route slug: ${country.slug}`,
    "",
    "Rules:",
    "- Return JSON only.",
    "- Mark every candidate with confidence \"unconfirmed\".",
    "- Suggest broad cities, states, regions, or themes worth researching next.",
    "- Do not include opening hours, ticket prices, exact transport times, closures, source URLs, citations, live availability, or official claims.",
    "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
    "- Keep notes short and useful for a human curator.",
    "",
    "JSON shape:",
    "{",
    '  "summary": "one cautious sentence",',
    '  "regions": [',
    '    { "name": "candidate name", "kind": "city|state|region|area", "why": "short research reason", "confidence": "unconfirmed" }',
    "  ],",
    '  "themes": [',
    '    { "label": "theme", "note": "short research note", "confidence": "unconfirmed" }',
    "  ]",
    "}"
  ].join("\n");
}

export function buildCountryDraftInfluencePrompt({ country, instruction, currentDraft }) {
  const currentStarterMap = currentDraft
    ? JSON.stringify(
        {
          summary: currentDraft.summary,
          regions: currentDraft.regions,
          themes: currentDraft.themes
        },
        null,
        2
      )
    : "No current starter map exists yet.";

  return [
    "You are revising a RoamAtlas country expansion starter map.",
    "The output is only for planning future curation. It is not verified user-facing travel data.",
    `Country: ${country.name}`,
    `ISO code: ${country.code}`,
    `Route slug: ${country.slug}`,
    "",
    "Current starter map:",
    currentStarterMap,
    "",
    "User steering instruction:",
    normalizeCountryDraftInstruction(instruction),
    "",
    "Rules:",
    "- Return JSON only.",
    "- Use the user instruction only to steer prioritization, scope, tone, or emphasis.",
    "- Do not treat the user instruction as evidence for factual claims.",
    "- Mark every candidate with confidence \"unconfirmed\".",
    "- Suggest broad cities, states, regions, or themes worth researching next.",
    "- Do not include opening hours, ticket prices, exact transport times, closures, source URLs, citations, live availability, or official claims.",
    "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
    "- Keep notes short and useful for a human curator.",
    "",
    "JSON shape:",
    "{",
    '  "summary": "one cautious sentence",',
    '  "regions": [',
    '    { "name": "candidate name", "kind": "city|state|region|area", "why": "short research reason", "confidence": "unconfirmed" }',
    "  ],",
    '  "themes": [',
    '    { "label": "theme", "note": "short research note", "confidence": "unconfirmed" }',
    "  ],",
    '  "changeNote": "one short sentence describing what changed"',
    "}"
  ].join("\n");
}

export function normalizeCountryDraftInstruction(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

export function createCountryPackStarterMap(pack, options = {}) {
  const rootNode = pack.nodes[pack.rootNodeId];
  const childNodes = (rootNode?.childIds ?? [])
    .map((nodeId) => pack.nodes[nodeId])
    .filter(Boolean);
  const tags = countTags(childNodes);
  const isConfirmedPack = pack.confidence !== "unconfirmed";
  const confidence = isConfirmedPack ? "confirmed" : "unconfirmed";
  const sourceType = isConfirmedPack ? "curated" : "ai_generated";
  const packLabel = isConfirmedPack ? "curated" : "starter";

  return {
    countryCode: pack.countryCode,
    countrySlug: pack.countrySlug,
    countryName: pack.title,
    mode: "curated_pack_snapshot",
    generationStatus: "ready",
    confidence,
    sourceType,
    factBoundary:
      pack.factBoundary ??
      `This starter map is derived from the ${packLabel} RoamAtlas country pack.`,
    summary: `${pack.title} is backed by a ${packLabel} RoamAtlas country pack with ${Object.keys(pack.nodes).length} nodes and ${Object.keys(pack.scenes).length} scenes.`,
    regions: childNodes.slice(0, 8).map((node) => ({
      name: node.title,
      kind: packNodeKind(node.type),
      why: countryPackNodeReason(node, { isConfirmedPack }),
      confidence
    })),
    themes: tags.slice(0, 6).map(([label]) => ({
      label: titleCase(label),
      note: `${titleCase(packLabel)} ${pack.title} pack theme from mapped nodes.`,
      confidence
    })),
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
          `Edit the country pack source files to change confirmed ${pack.title} data.`
        ]
      : [
          "This file is a runtime snapshot of starter country-pack data.",
          "Facts remain unconfirmed until source review."
        ],
    changeNote: "",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    model: null,
    unavailableReason: null
  };
}

export function createCountryPackDraftFromStarterMap(draft, options = {}) {
  const countrySlug = draft.countrySlug;
  const regionNodes = (draft.regions ?? []).map((region) => {
    const id = `${countrySlug}-${slugifyDraftId(region.name)}`;
    return {
      id,
      type: region.kind === "city" ? "district" : "district",
      title: region.name,
      parentId: countrySlug,
      childIds: [],
      tags: [region.kind, "starter-map"].filter(Boolean),
      facts: [
        {
          id: `${id}-starter-note`,
          text: region.why,
          sourceType: "ai_generated",
          confidence: "unconfirmed",
          sourceUrl: null
        }
      ],
      promotionStatus: "pending_source_review"
    };
  });

  return {
    countryCode: draft.countryCode,
    countrySlug,
    countryName: draft.countryName,
    status: "pending_source_review",
    sourceStarterMapMode: draft.mode,
    sourceType: draft.sourceType,
    confidence: "unconfirmed",
    factBoundary: "This generated country-pack draft is not registered as curated data until sources are reviewed.",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
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
      confidence: "unconfirmed",
      sourceType: "ai_generated"
    })),
    reviewChecklist: [
      "Verify each candidate against official tourism, state, city, or operator sources.",
      "Replace ai_generated facts with sourced facts before registering this as a country pack.",
      "Add scenes and routes only after node ids and source-backed facts are reviewed."
    ]
  };
}

export function normalizeCountryDraftPayload(payload, country, options = {}) {
  const generationStatus = options.generationStatus ?? "ready";
  const summary = safeText(
    payload?.summary,
    `${country.name} has no curated RoamAtlas graph yet; this draft only suggests areas for review.`,
    220
  );

  return {
    countryCode: country.code,
    countrySlug: country.slug,
    countryName: country.name,
    mode: "ai_draft",
    generationStatus,
    confidence: "unconfirmed",
    sourceType: "ai_generated",
    factBoundary: COUNTRY_DRAFT_FACT_BOUNDARY,
    summary,
    regions: normalizeRegions(payload?.regions),
    themes: normalizeThemes(payload?.themes),
    reviewChecklist: DEFAULT_REVIEW_CHECKLIST,
    warnings: DEFAULT_WARNINGS,
    changeNote: safeText(payload?.changeNote, "", 180),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    model: options.model ?? null,
    unavailableReason: options.unavailableReason ?? null
  };
}

export function createCountryDraftFallback(country, reason, options = {}) {
  return normalizeCountryDraftPayload(
    {
      summary: `${country.name} does not have a starter map yet.`,
      regions: [],
      themes: []
    },
    country,
    {
      ...options,
      generationStatus: options.generationStatus ?? "unavailable",
      unavailableReason: reason
    }
  );
}

function normalizeRegions(regions) {
  return asArray(regions)
    .map((item) => {
      const name = safeText(item?.name, "", 80);
      if (!name) return null;
      return {
        name,
        kind: normalizeRegionKind(item?.kind),
        why: safeText(
          item?.why,
          "Review this candidate against official sources before adding it to RoamAtlas.",
          180
        ),
        confidence: "unconfirmed"
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeThemes(themes) {
  return asArray(themes)
    .map((item) => {
      const label = safeText(item?.label, "", 60);
      if (!label) return null;
      return {
        label,
        note: safeText(
          item?.note,
          "Use this theme only as a research lead.",
          160
        ),
        confidence: "unconfirmed"
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeRegionKind(kind) {
  const value = String(kind ?? "").trim().toLowerCase();
  return ["city", "state", "region", "area"].includes(value) ? value : "region";
}

function packNodeKind(type) {
  if (type === "district") return "region";
  if (type === "country") return "region";
  if (type === "attraction") return "area";
  return "area";
}

function countryPackNodeReason(node, { isConfirmedPack }) {
  const childCount = node.childIds?.length ?? 0;
  const childText = childCount === 1 ? "1 curated child node" : `${childCount} curated child nodes`;
  return isConfirmedPack
    ? `${node.title} is part of the curated RoamAtlas graph with ${childText}.`
    : `${node.title} is part of the starter RoamAtlas graph and needs source review.`;
}

function countTags(nodes) {
  const counts = new Map();
  for (const node of nodes) {
    for (const tag of node.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function titleCase(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugifyDraftId(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "candidate";
}

function safeText(value, fallback, maxLength) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || containsForbiddenTravelDetail(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function containsForbiddenTravelDetail(text) {
  return FORBIDDEN_DETAIL_PATTERNS.some((pattern) => pattern.test(text));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
