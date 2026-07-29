import {
  getUsableGroundingSnippets
} from "./countryDraftGroundingPolicy.ts";
import {
  asArray,
  isInternalThemeTag,
  isRecord,
  safeText
} from "./countryDraftTextPolicy.ts";
import type {
  CountryDraft,
  CountryDraftChild,
  CountryDraftCountry,
  CountryDraftGenerationOptions,
  CountryDraftRegion,
  CountryDraftTheme
} from "./countryDraftTypes.ts";

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
  'Promote sourceUrl-backed candidates to confidence "confirmed" only after human source review.',
  "Separate cities, states, attractions, and itinerary items before promotion.",
  "Do not add opening hours, prices, or route timing without fresh sources."
];

const GROUNDED_WARNINGS = [
  "This draft includes candidates grounded by external search results (Exa), not a curated RoamAtlas country pack.",
  "sourceUrl fields point to third-party search results; verify each one before treating it as an official source.",
  "Generated candidates are not available to verified itinerary or fact flows yet."
];

export const COUNTRY_DRAFT_FACT_BOUNDARY =
  "AI starter maps are planning scaffolds only. They are not confirmed travel facts.";

export function normalizeCountryDraftPayload(
  payload: unknown,
  country: CountryDraftCountry,
  options: CountryDraftGenerationOptions = {}
): CountryDraft {
  const source = isRecord(payload) ? payload : {};
  const generationStatus =
    options.generationStatus ?? "ready";
  const summary = safeText(
    source.summary,
    `${country.name} has no curated RoamAtlas graph yet; this draft only suggests areas for review.`,
    220
  );
  const allowedSourceUrls = buildAllowedSourceUrlSet(
    options.groundingSnippets
  );
  const preserveConfirmed =
    options.preserveConfirmed === true;
  const regions = normalizeRegions(
    source.regions,
    allowedSourceUrls,
    preserveConfirmed
  );
  const themes = normalizeThemes(
    source.themes,
    allowedSourceUrls,
    country.slug,
    preserveConfirmed
  );
  const isGrounded = allowedSourceUrls.size > 0;
  const hasGroundedFact =
    regions.some(
      (region) => region.confidence === "likely"
    ) ||
    themes.some(
      (theme) => theme.confidence === "likely"
    );

  return {
    countryCode: country.code,
    countrySlug: country.slug,
    countryName: country.name,
    mode: options.mode ?? "ai_draft",
    generationStatus,
    confidence: "unconfirmed",
    sourceType: isGrounded
      ? "exa_grounded"
      : "ai_generated",
    factBoundary: COUNTRY_DRAFT_FACT_BOUNDARY,
    summary,
    regions,
    themes,
    reviewChecklist: hasGroundedFact
      ? GROUNDED_REVIEW_CHECKLIST
      : DEFAULT_REVIEW_CHECKLIST,
    warnings: isGrounded
      ? GROUNDED_WARNINGS
      : DEFAULT_WARNINGS,
    changeNote: safeText(source.changeNote, "", 180),
    generatedAt:
      options.generatedAt ?? new Date().toISOString(),
    model: options.model ?? null,
    unavailableReason:
      options.unavailableReason ?? null
  };
}

export function createCountryDraftFallback(
  country: CountryDraftCountry,
  reason: string,
  options: CountryDraftGenerationOptions = {}
): CountryDraft {
  return normalizeCountryDraftPayload(
    {
      summary: `${country.name} does not have a starter map yet.`,
      regions: [],
      themes: []
    },
    country,
    {
      ...options,
      generationStatus:
        options.generationStatus ?? "unavailable",
      unavailableReason: reason
    }
  );
}

function buildAllowedSourceUrlSet(
  groundingSnippets: unknown
): Set<string> {
  const urls = getUsableGroundingSnippets(
    groundingSnippets
  )
    .map((snippet) => String(snippet.url ?? "").trim())
    .filter(Boolean);
  return new Set(urls);
}

function normalizeRegions(
  regions: unknown,
  allowedSourceUrls: ReadonlySet<string> = new Set(),
  preserveConfirmed = false
): CountryDraftRegion[] {
  return asArray(regions)
    .map((item): CountryDraftRegion | null => {
      if (!isRecord(item)) return null;
      const name = safeText(item.name, "", 80);
      if (!name) return null;
      const sourceUrl = normalizeSourceUrl(
        item.sourceUrl,
        allowedSourceUrls
      );
      const isApproved =
        item.reviewStatus === "human_approved" ||
        (preserveConfirmed &&
          item.confidence === "confirmed");
      const region: CountryDraftRegion = {
        name,
        kind: normalizeRegionKind(item.kind),
        why: safeText(
          item.why,
          "Review this candidate against official sources before adding it to RoamAtlas.",
          180
        ),
        confidence: isApproved
          ? "confirmed"
          : sourceUrl
            ? "likely"
            : "unconfirmed",
        sourceUrl,
        children: normalizeDraftChildNodes(
          item.children,
          allowedSourceUrls,
          preserveConfirmed
        )
      };
      if (isApproved) {
        region.reviewStatus = "human_approved";
        region.reviewedAt =
          safeText(item.reviewedAt, "", 80) ||
          undefined;
      }
      return region;
    })
    .filter(
      (region): region is CountryDraftRegion =>
        region !== null
    )
    .slice(0, 10);
}

function normalizeDraftChildNodes(
  children: unknown,
  allowedSourceUrls: ReadonlySet<string> = new Set(),
  preserveConfirmed = false
): CountryDraftChild[] {
  return asArray(children)
    .map((item): CountryDraftChild | null => {
      if (!isRecord(item)) return null;
      const name = safeText(item.name, "", 80);
      if (!name) return null;
      const sourceUrl = normalizeSourceUrl(
        item.sourceUrl,
        allowedSourceUrls
      );
      const isApproved =
        item.reviewStatus === "human_approved" ||
        (preserveConfirmed &&
          item.confidence === "confirmed");
      const child: CountryDraftChild = {
        name,
        kind: normalizeRegionKind(item.kind),
        confidence: isApproved
          ? "confirmed"
          : sourceUrl
            ? "likely"
            : "unconfirmed",
        sourceUrl,
        children: normalizeDraftChildNodes(
          item.children,
          allowedSourceUrls,
          preserveConfirmed
        )
      };
      if (item.reviewStatus === "human_approved") {
        child.reviewStatus = "human_approved";
        child.reviewedAt =
          safeText(item.reviewedAt, "", 80) ||
          undefined;
      }
      return child;
    })
    .filter(
      (child): child is CountryDraftChild =>
        child !== null
    )
    .slice(0, 20);
}

function normalizeThemes(
  themes: unknown,
  allowedSourceUrls: ReadonlySet<string> = new Set(),
  countrySlug = "",
  preserveConfirmed = false
): CountryDraftTheme[] {
  return asArray(themes)
    .map((item): CountryDraftTheme | null => {
      if (!isRecord(item)) return null;
      const label = safeText(item.label, "", 60);
      if (
        !label ||
        isInternalThemeTag(label, countrySlug)
      ) {
        return null;
      }
      const sourceUrl = normalizeSourceUrl(
        item.sourceUrl,
        allowedSourceUrls
      );
      const isApproved =
        item.reviewStatus === "human_approved" ||
        (preserveConfirmed &&
          item.confidence === "confirmed");
      const theme: CountryDraftTheme = {
        label,
        note: safeText(
          item.note,
          "Use this theme only as a research lead.",
          160
        ),
        confidence: isApproved
          ? "confirmed"
          : sourceUrl
            ? "likely"
            : "unconfirmed",
        sourceUrl
      };
      if (isApproved) {
        theme.reviewStatus = "human_approved";
        theme.reviewedAt =
          safeText(item.reviewedAt, "", 80) ||
          undefined;
      }
      return theme;
    })
    .filter(
      (theme): theme is CountryDraftTheme =>
        theme !== null
    )
    .slice(0, 8);
}

function normalizeSourceUrl(
  value: unknown,
  allowedSourceUrls: ReadonlySet<string>
): string | null {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  return allowedSourceUrls.has(candidate)
    ? candidate
    : null;
}

function normalizeRegionKind(kind: unknown): string {
  const value = String(kind ?? "")
    .trim()
    .toLowerCase();
  return ["city", "state", "region", "area"].includes(
    value
  )
    ? value
    : "region";
}
