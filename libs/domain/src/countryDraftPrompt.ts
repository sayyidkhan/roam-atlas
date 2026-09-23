import {
  formatGroundingSnippets,
  getUsableGroundingSnippets
} from "./countryDraftGroundingPolicy.ts";
import {
  isRecord
} from "./countryDraftTextPolicy.ts";
import type {
  CountryDraftCountry,
  CountryDraftPromptOptions
} from "./countryDraftTypes.ts";

export function buildCountryDraftPrompt(
  country: CountryDraftCountry,
  {
    groundingSnippets = []
  }: CountryDraftPromptOptions = {}
): string {
  const snippets = getUsableGroundingSnippets(
    groundingSnippets
  ).slice(0, 18);
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
      '- Mark every candidate with confidence "unconfirmed".',
      "- Suggest broad cities, states, regions, or themes worth researching next.",
      "- Do not include opening hours, ticket prices, exact transport times, closures, source URLs, citations, live availability, or official claims.",
      "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
      "- Do not use placeholder or internal wording such as starter map, source review, RoamAtlas graph, needs review, replace this note, or pending curation inside summary, why, or note fields.",
      '- Make each region "why" a meaningful traveller-facing research angle: what kind of chapter it could become, what trip style it may serve, and what visual cues should be explored.',
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

  return buildGroundedCountryDraftPrompt(
    country,
    snippets
  );
}

export function buildCountryDraftInfluencePrompt({
  country,
  instruction,
  currentDraft,
  groundingSnippets = [],
  appendOnlyRegionName = null
}: {
  appendOnlyRegionName?: string | null;
  country: CountryDraftCountry;
  currentDraft?: unknown;
  groundingSnippets?: unknown;
  instruction: unknown;
}): string {
  const currentStarterMap = isRecord(currentDraft)
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
  const snippets = getUsableGroundingSnippets(
    groundingSnippets
  ).slice(0, 18);

  const groundedLines = snippets.length
    ? [
        "",
        "Research snippets (from an external search API, not your own memory):",
        formatGroundingSnippets(snippets),
        "",
        "- Base any new or changed candidate strictly on the research snippets above, plus the current starter map. Do not add places or claims from your own memory.",
        '- For each region or theme directly supported by a snippet, set "sourceUrl" to that snippet\'s exact URL (copy it exactly) and set confidence to "likely".',
        '- If a candidate is not clearly supported by any snippet, omit "sourceUrl" (or set it to null) and set confidence to "unconfirmed".',
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
    ...(appendOnlyRegionName
      ? [
          `- Append-only mode: return exactly one region named "${appendOnlyRegionName}".`,
          "- Keep the existing region details unchanged and put only proposed new candidate places in that region's children array.",
          "- Do not rename, remove, or edit any existing region, child, theme, summary, or confirmed fact."
        ]
      : []),
    "- Use the user instruction only to steer prioritization, scope, tone, or emphasis.",
    "- Do not treat the user instruction as evidence for factual claims.",
    snippets.length
      ? '- Mark each candidate with confidence "likely" (sourced) or "unconfirmed" (not sourced), as instructed above.'
      : '- Mark every candidate with confidence "unconfirmed".',
    "- Suggest broad cities, states, regions, or themes worth researching next.",
    snippets.length
      ? "- Do not include opening hours, ticket prices, exact transport times, closures, or live availability, even if a snippet mentions them."
      : "- Do not include opening hours, ticket prices, exact transport times, closures, source URLs, citations, live availability, or official claims.",
    "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
    "- Do not use placeholder or internal wording such as starter map, source review, RoamAtlas graph, needs review, replace this note, or pending curation inside summary, why, or note fields.",
    '- Make each region "why" a meaningful traveller-facing research angle: what kind of chapter it could become, what trip style it may serve, and what visual cues should be explored.',
    "- Keep notes short, concrete, and useful for a human curator.",
    "",
    "JSON shape:",
    "{",
    '  "summary": "one cautious sentence",',
    '  "regions": [',
    appendOnlyRegionName
      ? `    { "name": "${appendOnlyRegionName}", "kind": "region", "children": [{ "name": "new candidate place", "kind": "attraction|area", "confidence": "unconfirmed" }] }`
      : snippets.length
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

export function normalizeCountryDraftInstruction(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

function buildGroundedCountryDraftPrompt(
  country: CountryDraftCountry,
  snippets: Parameters<typeof formatGroundingSnippets>[0]
): string {
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
    "- Return 4 to 6 traveller-facing destination chapters and 12 to 20 total child destinations across those chapters.",
    "- Each chapter must be a recognizable, clickable destination cluster anchored by specific place names: a major city and surroundings, an island group, a heritage corridor, a coast, a national-park cluster, or another practical itinerary grouping.",
    '- Use names such as "Bangkok & Chao Phraya", "Chiang Mai & Northern Highlands", or "Phuket & Andaman Coast".',
    '- Never use a bare compass or administrative bucket such as "Northern Thailand", "Central Region", "Eastern Area", "North", "South", "East", or "West".',
    "- Do not divide the whole country merely for geographic completeness. Prefer chapters that give a traveller a clear reason to enter, explore, and save destinations.",
    "- Group destinations that plausibly belong in the same trip chapter; do not use transport sources as evidence for a destination's travel value.",
    "- Child destinations should be real cities, districts, attractions, cultural sites, nature areas, or visitor experiences directly supported by a snippet.",
    '- For each region, child destination, or theme directly supported by a snippet, set "sourceUrl" to that snippet\'s exact URL (copy it exactly, do not modify it) and set confidence to "likely".',
    '- If a candidate is not clearly supported by any snippet, omit "sourceUrl" (or set it to null) and set confidence to "unconfirmed".',
    "- Never invent a URL that is not one of the snippet URLs listed above.",
    "- Add 1 to 4 short interest tags per child from culture, food, nature, wildlife, family, history, architecture, beach, city, photography, or adventure.",
    "- typicalDurationMinutes must be a cautious approximate planning value between 30 and 480, not an opening-hours claim.",
    '- budgetLevel must be "low", "medium", or "high"; bestTimeOfDay must be "morning", "afternoon", "evening", or "any".',
    "- Do not include opening hours, ticket prices, exact transport times, closures, or live availability, even if a snippet mentions them.",
    "- Do not say any place is confirmed, must-see, official, best, largest, oldest, or guaranteed.",
    "- Do not use placeholder or internal wording such as starter map, source review, RoamAtlas graph, needs review, replace this note, or pending curation inside summary, why, or note fields.",
    '- Make each region "why" a meaningful traveller-facing research angle supported by the snippets: what kind of chapter it could become, what trip style it may serve, and what visual cues should be explored.',
    "- Keep notes short, concrete, and useful for a human curator.",
    "",
    "JSON shape:",
    "{",
    '  "summary": "one cautious sentence",',
    '  "regions": [',
    '    { "name": "named destination cluster", "kind": "city|region|area", "why": "why this is a coherent trip chapter", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null", "children": [',
    '      { "name": "destination name", "kind": "attraction|district|city|nature|experience", "why": "short source-grounded reason to explore", "tags": ["culture"], "typicalDurationMinutes": 120, "budgetLevel": "medium", "bestTimeOfDay": "any", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null" }',
    "    ] }",
    "  ],",
    '  "themes": [',
    '    { "label": "theme", "note": "concrete research note, not a placeholder", "confidence": "likely|unconfirmed", "sourceUrl": "https://... or null" }',
    "  ]",
    "}"
  ].join("\n");
}
