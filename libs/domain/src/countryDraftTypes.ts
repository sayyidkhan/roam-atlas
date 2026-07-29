export type CountryDraftConfidence =
  | "confirmed"
  | "likely"
  | "unconfirmed";

export type CountryDraftCountry = {
  code: string;
  name: string;
  slug: string;
  [key: string]: unknown;
};

export type CountryDraftGroundingSnippet = {
  text?: unknown;
  title?: unknown;
  url?: unknown;
  [key: string]: unknown;
};

export type CountryDraftChild = {
  children: CountryDraftChild[];
  confidence: CountryDraftConfidence;
  kind: string;
  name: string;
  reviewedAt?: string;
  reviewStatus?: "human_approved";
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type CountryDraftRegion = CountryDraftChild & {
  why: string;
};

export type CountryDraftTheme = {
  confidence: CountryDraftConfidence;
  label: string;
  note: string;
  reviewedAt?: string;
  reviewStatus?: "human_approved";
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type CountryDraft = {
  changeNote: string;
  confidence: CountryDraftConfidence;
  countryCode: string;
  countryName: string;
  countrySlug: string;
  factBoundary: string;
  generatedAt: string;
  generationStatus: string;
  mode: string;
  model: string | null;
  regions: CountryDraftRegion[];
  reviewChecklist: string[];
  sourceType: string;
  summary: string;
  themes: CountryDraftTheme[];
  unavailableReason: string | null;
  warnings: string[];
  [key: string]: unknown;
};

export type CountryPackFact = {
  text?: unknown;
  [key: string]: unknown;
};

export type CountryPackNode = {
  childIds?: readonly string[];
  facts?: readonly CountryPackFact[];
  id?: string;
  tags?: readonly string[];
  title: string;
  type: string;
  [key: string]: unknown;
};

export type CountryPackInput = {
  confidence?: unknown;
  countryCode: string;
  countrySlug: string;
  factBoundary?: string;
  nodes: Record<string, CountryPackNode>;
  rootNodeId: string;
  scenes: Record<string, unknown>;
  title: string;
  [key: string]: unknown;
};

export type CountryDraftGenerationOptions = {
  generatedAt?: string;
  generationStatus?: string;
  groundingSnippets?: unknown;
  mode?: string;
  model?: string | null;
  preserveConfirmed?: boolean;
  unavailableReason?: string | null;
};

export type CountryDraftPromptOptions = {
  groundingSnippets?: unknown;
};

export type CountryDraftStarterMapOptions = {
  generatedAt?: string;
};
