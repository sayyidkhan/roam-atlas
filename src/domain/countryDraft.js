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

const GROUNDED_REVIEW_CHECKLIST = [
  "Open each sourceUrl and confirm it actually supports the linked candidate.",
  "Promote sourceUrl-backed candidates to confidence \"confirmed\" only after human source review.",
  "Separate cities, states, attractions, and itinerary items before promotion.",
  "Do not add opening hours, prices, or route timing without fresh sources."
];

const GROUNDED_WARNINGS = [
  "This draft includes candidates grounded by external search results (Exa), not a curated RoamAtlas country pack.",
  "sourceUrl fields point to third-party search results; verify each one before treating it as an official source.",
  "Generated candidates are not available to verified itinerary or fact flows yet."
];

// Require at least this many usable research snippets before treating a draft as
// "grounded". A single stray search result is not enough evidence to switch the
// prompt and confidence model into grounded mode; fall back to the plain
// ungrounded path instead, which is the safer default.
const MIN_GROUNDING_SNIPPETS = 3;

function getUsableGroundingSnippets(groundingSnippets) {
  const snippets = asArray(groundingSnippets).filter((snippet) => String(snippet?.url ?? "").trim());
  return snippets.length >= MIN_GROUNDING_SNIPPETS ? snippets : [];
}

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

export function buildCountryDraftPrompt(country, { groundingSnippets = [] } = {}) {
  const snippets = getUsableGroundingSnippets(groundingSnippets).slice(0, 8);
  if (!snippets.length) {
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
      "- Do not use placeholder or internal wording such as starter map, source review, RoamAtlas graph, needs review, replace this note, or pending curation inside summary, why, or note fields.",
      "- Make each region \"why\" a meaningful traveller-facing research angle: what kind of chapter it could become, what trip style it may serve, and what visual cues should be explored.",
      "- Keep notes short, concrete, and useful for a human curator.",
      "",
      "JSON shape:",
      "{",
      '  "summary": "one cautious sentence",',
      '  "regions": [',
      '    { "name": "candidate name", "kind": "city|state|region|area", "why": "traveller-facing research angle, not a placeholder", "confidence": "unconfirmed" }',
      "  ],",
      '  "themes": [',
      '    { "label": "theme", "note": "concrete research note, not a placeholder", "confidence": "unconfirmed" }',
      "  ]",
      "}"
    ].join("\n");
  }

  return buildGroundedCountryDraftPrompt(country, snippets);
}

function buildGroundedCountryDraftPrompt(country, snippets) {
  return [
    "You are drafting a RoamAtlas country expansion scaffold using ONLY the research snippets provided below.",
    "The output is only for planning future curation. It is not verified user-facing travel data.",
    `Country: ${country.name}`,
    `ISO code: ${country.code}`,
    `Route slug: ${country.slug}`,
    "",
    "Research snippets (from an external search API, not your own memory):",
    formatGroundingSnippets(snippets),
    "",
    "Rules:",
    "- Return JSON only.",
    "- Base every candidate strictly on the research snippets above. Do not add places or claims from your own memory.",
    "- For each region or theme that is directly supported by a snippet, set \"sourceUrl\" to that snippet's exact URL (copy it exactly, do not modify it) and set confidence to \"likely\".",
    "- If a candidate is not clearly supported by any snippet, omit \"sourceUrl\" (or set it to null) and set confidence to \"unconfirmed\".",
    "- Never invent a URL that is not one of the snippet URLs listed above.",
    "- Do not include opening hours, ticket prices, exact transport times, closures, or live availability, even if a snippet mentions them.",
    "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
    "- Do not use placeholder or internal wording such as starter map, source review, RoamAtlas graph, needs review, replace this note, or pending curation inside summary, why, or note fields.",
    "- Make each region \"why\" a meaningful traveller-facing research angle supported by the snippets: what kind of chapter it could become, what trip style it may serve, and what visual cues should be explored.",
    "- Keep notes short, concrete, and useful for a human curator.",
    "",
    "JSON shape:",
    "{",
    '  "summary": "one cautious sentence",',
    '  "regions": [',
    '    { "name": "candidate name", "kind": "city|state|region|area", "why": "traveller-facing research angle, not a placeholder", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null" }',
    "  ],",
    '  "themes": [',
    '    { "label": "theme", "note": "concrete research note, not a placeholder", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null" }',
    "  ]",
    "}"
  ].join("\n");
}

function formatGroundingSnippets(snippets) {
  return snippets
    .map((snippet, index) => {
      const title = truncatePromptText(snippet?.title, "Untitled source", 120);
      const url = truncatePromptText(snippet?.url, "", 300);
      const text = truncatePromptText(snippet?.text, "", 2000);
      return `[${index + 1}] ${title}\nURL: ${url}\n${text}`;
    })
    .join("\n\n");
}

function truncatePromptText(value, fallback, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

export function buildCountryDraftInfluencePrompt({ country, instruction, currentDraft, groundingSnippets = [] }) {
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
  const snippets = getUsableGroundingSnippets(groundingSnippets).slice(0, 8);

  const groundedLines = snippets.length
    ? [
        "",
        "Research snippets (from an external search API, not your own memory):",
        formatGroundingSnippets(snippets),
        "",
        "- Base any new or changed candidate strictly on the research snippets above, plus the current starter map. Do not add places or claims from your own memory.",
        "- For each region or theme directly supported by a snippet, set \"sourceUrl\" to that snippet's exact URL (copy it exactly) and set confidence to \"likely\".",
        "- If a candidate is not clearly supported by any snippet, omit \"sourceUrl\" (or set it to null) and set confidence to \"unconfirmed\".",
        "- Never invent a URL that is not one of the snippet URLs listed above."
      ]
    : [];

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
    ...groundedLines,
    "",
    "Rules:",
    "- Return JSON only.",
    "- Use the user instruction only to steer prioritization, scope, tone, or emphasis.",
    "- Do not treat the user instruction as evidence for factual claims.",
    snippets.length
      ? "- Mark each candidate with confidence \"likely\" (sourced) or \"unconfirmed\" (not sourced), as instructed above."
      : "- Mark every candidate with confidence \"unconfirmed\".",
    "- Suggest broad cities, states, regions, or themes worth researching next.",
    snippets.length
      ? "- Do not include opening hours, ticket prices, exact transport times, closures, or live availability, even if a snippet mentions them."
      : "- Do not include opening hours, ticket prices, exact transport times, closures, source URLs, citations, live availability, or official claims.",
    "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
    "- Do not use placeholder or internal wording such as starter map, source review, RoamAtlas graph, needs review, replace this note, or pending curation inside summary, why, or note fields.",
    "- Make each region \"why\" a meaningful traveller-facing research angle: what kind of chapter it could become, what trip style it may serve, and what visual cues should be explored.",
    "- Keep notes short, concrete, and useful for a human curator.",
    "",
    "JSON shape:",
    "{",
    '  "summary": "one cautious sentence",',
    '  "regions": [',
    snippets.length
      ? '    { "name": "candidate name", "kind": "city|state|region|area", "why": "traveller-facing research angle, not a placeholder", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null" }'
      : '    { "name": "candidate name", "kind": "city|state|region|area", "why": "traveller-facing research angle, not a placeholder", "confidence": "unconfirmed" }',
    "  ],",
    '  "themes": [',
    snippets.length
      ? '    { "label": "theme", "note": "concrete research note, not a placeholder", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null" }'
      : '    { "label": "theme", "note": "concrete research note, not a placeholder", "confidence": "unconfirmed" }',
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

function getPackChildNodes(pack) {
  const rootNode = pack.nodes[pack.rootNodeId];
  return (rootNode?.childIds ?? [])
    .map((nodeId) => pack.nodes[nodeId])
    .filter(Boolean);
}

function buildPackThemeDraftItems(pack, childNodes = getPackChildNodes(pack)) {
  const themeSummaries = summarizePackThemes(childNodes, pack.countrySlug);
  const isConfirmedPack = pack.confidence !== "unconfirmed";
  const confidence = isConfirmedPack ? "confirmed" : "unconfirmed";
  return themeSummaries.slice(0, 6).map((theme) => ({
    label: titleCase(theme.label),
    note: packThemeNote(theme, pack.title, { isConfirmedPack }),
    confidence
  }));
}

export function refreshCuratedPackSnapshotThemes(draft, pack) {
  if (draft?.mode !== "curated_pack_snapshot" || !pack) return draft;
  return {
    ...draft,
    themes: buildPackThemeDraftItems(pack)
  };
}

export function createCountryPackStarterMap(pack, options = {}) {
  const childNodes = getPackChildNodes(pack);
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
      confidence,
      children: collectPackNodeChildren(node, pack, confidence)
    })),
    themes: buildPackThemeDraftItems(pack, childNodes),
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
    const sourceUrl = region.sourceUrl ?? null;
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
          sourceType: sourceUrl ? "exa_grounded" : "ai_generated",
          confidence: region.confidence === "likely" ? "likely" : "unconfirmed",
          sourceUrl
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
      confidence: theme.confidence === "likely" ? "likely" : "unconfirmed",
      sourceType: theme.sourceUrl ? "exa_grounded" : "ai_generated",
      sourceUrl: theme.sourceUrl ?? null
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
  const allowedSourceUrls = buildAllowedSourceUrlSet(options.groundingSnippets);
  const regions = normalizeRegions(payload?.regions, allowedSourceUrls);
  const themes = normalizeThemes(payload?.themes, allowedSourceUrls, country.slug);
  const isGrounded = allowedSourceUrls.size > 0;
  const hasGroundedFact =
    regions.some((region) => region.confidence === "likely") ||
    themes.some((theme) => theme.confidence === "likely");

  return {
    countryCode: country.code,
    countrySlug: country.slug,
    countryName: country.name,
    mode: "ai_draft",
    generationStatus,
    confidence: "unconfirmed",
    sourceType: isGrounded ? "exa_grounded" : "ai_generated",
    factBoundary: COUNTRY_DRAFT_FACT_BOUNDARY,
    summary,
    regions,
    themes,
    reviewChecklist: hasGroundedFact
      ? GROUNDED_REVIEW_CHECKLIST
      : DEFAULT_REVIEW_CHECKLIST,
    warnings: isGrounded ? GROUNDED_WARNINGS : DEFAULT_WARNINGS,
    changeNote: safeText(payload?.changeNote, "", 180),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    model: options.model ?? null,
    unavailableReason: options.unavailableReason ?? null
  };
}

function buildAllowedSourceUrlSet(groundingSnippets) {
  const urls = getUsableGroundingSnippets(groundingSnippets)
    .map((snippet) => String(snippet?.url ?? "").trim())
    .filter(Boolean);
  return new Set(urls);
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

function normalizeRegions(regions, allowedSourceUrls = new Set()) {
  return asArray(regions)
    .map((item) => {
      const name = safeText(item?.name, "", 80);
      if (!name) return null;
      const sourceUrl = normalizeSourceUrl(item?.sourceUrl, allowedSourceUrls);
      return {
        name,
        kind: normalizeRegionKind(item?.kind),
        why: safeText(
          item?.why,
          "Review this candidate against official sources before adding it to RoamAtlas.",
          180
        ),
        confidence: sourceUrl ? "likely" : "unconfirmed",
        sourceUrl
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeSourceUrl(value, allowedSourceUrls) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  return allowedSourceUrls.has(candidate) ? candidate : null;
}

function normalizeThemes(themes, allowedSourceUrls = new Set(), countrySlug = "") {
  return asArray(themes)
    .map((item) => {
      const label = safeText(item?.label, "", 60);
      if (!label || isInternalThemeTag(label, countrySlug)) return null;
      const sourceUrl = normalizeSourceUrl(item?.sourceUrl, allowedSourceUrls);
      return {
        label,
        note: safeText(
          item?.note,
          "Use this theme only as a research lead.",
          160
        ),
        confidence: sourceUrl ? "likely" : "unconfirmed",
        sourceUrl
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

const MAX_PACK_CHILD_DEPTH = 4;

function collectPackNodeChildren(node, pack, confidence, depth = 0) {
  if (depth >= MAX_PACK_CHILD_DEPTH) return [];
  return (node.childIds ?? [])
    .map((childId) => pack.nodes[childId])
    .filter(Boolean)
    .map((child) => ({
      name: child.title,
      kind: child.type,
      confidence,
      children: collectPackNodeChildren(child, pack, confidence, depth + 1)
    }));
}

function countryPackNodeReason(node, { isConfirmedPack }) {
  const childCount = node.childIds?.length ?? 0;
  const childText = childCount === 1 ? "1 curated child node" : `${childCount} curated child nodes`;
  if (isConfirmedPack) {
    return `${node.title} is part of the curated RoamAtlas graph with ${childText}.`;
  }

  const primaryFact = firstMeaningfulStarterFact(node);
  if (primaryFact) return primaryFact;

  const candidateLens = (node.tags ?? [])
    .filter((tag) => !["starter-map", "unconfirmed", "overview", node.title.toLowerCase()].includes(tag))
    .slice(0, 2)
    .map(titleCase)
    .join(" and ");
  const lensText = candidateLens ? ` as a ${candidateLens.toLowerCase()} chapter` : "";
  return `Research ${node.title}${lensText}: identify the travel style, visual anchors, nearby clusters, and source-backed facts before promotion.`;
}

function firstMeaningfulStarterFact(node) {
  return (node.facts ?? [])
    .map((fact) => safeText(fact?.text, "", 220))
    .find((text) => text && !isInternalPlaceholderText(text));
}

function isInternalPlaceholderText(text) {
  return /\b(?:starter[-\s]?map|starter RoamAtlas graph|source review|needs source review|replace this note|pending curation)\b/i.test(
    text
  );
}

const INTERNAL_THEME_TAGS = new Set([
  "starter-map",
  "unconfirmed",
  "overview",
  "worldwide",
  "confirmed",
  "likely",
  "general",
  "pending",
  "pending_source_review"
]);

function isInternalThemeTag(tag, countrySlug = "") {
  const normalized = normalizeThemeTag(tag);
  if (!normalized) return true;
  if (INTERNAL_THEME_TAGS.has(normalized)) return true;
  const normalizedCountrySlug = normalizeThemeTag(countrySlug);
  return Boolean(normalizedCountrySlug && normalized === normalizedCountrySlug);
}

function normalizeThemeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

export function summarizePackThemes(nodes, countrySlug = "") {
  const themeNodes = new Map();
  for (const node of nodes) {
    for (const tag of node.tags ?? []) {
      if (isInternalThemeTag(tag, countrySlug)) continue;
      const normalized = String(tag).trim().toLowerCase();
      if (!themeNodes.has(normalized)) themeNodes.set(normalized, []);
      themeNodes.get(normalized).push(node.title);
    }
  }

  return [...themeNodes.entries()]
    .map(([label, nodeTitles]) => ({ label, nodeTitles }))
    .sort((a, b) => b.nodeTitles.length - a.nodeTitles.length || a.label.localeCompare(b.label));
}

function packThemeNote(theme, countryName, { isConfirmedPack }) {
  const nodeCount = theme.nodeTitles.length;
  const shownNodes = theme.nodeTitles.slice(0, 3).join(", ");
  const remainingCount = Math.max(0, nodeCount - 3);
  const nodeList = remainingCount > 0
    ? `${shownNodes}, and ${remainingCount} more`
    : shownNodes;
  const sourceLabel = isConfirmedPack ? "curated parent" : "starter parent";
  const nodeLabel = nodeCount === 1 ? "node" : "nodes";
  return `${titleCase(theme.label)} appears across ${nodeCount} ${sourceLabel} ${nodeLabel} in ${countryName}: ${nodeList}.`;
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
