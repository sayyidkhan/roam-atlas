import type {
  CountryDraftCountry,
  CountryDraftGroundingSnippet
} from "@roamatlas/domain/countryDraft.js";

export const EXA_MIN_SNIPPET_TEXT_LENGTH =
  200;

const RESEARCH_QUERIES = [
  {
    kind: "regions",
    build: (countryName: string) =>
      `${countryName} official tourism itineraries destination guides major cities islands heritage areas`
  },
  {
    kind: "attractions",
    build: (countryName: string) =>
      `${countryName} official tourism attractions culture heritage nature`
  },
  {
    kind: "transport",
    build: (countryName: string) =>
      `${countryName} official public transport visitor travel`
  }
] as const;

type ExaCountryGroundingProviderOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, "warn">;
};

export function createExaCountryGroundingProvider({
  apiKey,
  fetchFn = fetch,
  logger = console
}: ExaCountryGroundingProviderOptions) {
  return {
    async search(
      country: CountryDraftCountry
    ): Promise<CountryDraftGroundingSnippet[]> {
      if (!apiKey) return [];
      const batches = await Promise.all(
        RESEARCH_QUERIES.map(async ({ kind, build }) => {
          const query = build(country.name);
          let response: Response;
          try {
            response = await fetchFn(
          "https://api.exa.ai/search",
          {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              query,
              type: "auto",
              numResults: 6,
              contents: {
                text: { maxCharacters: 1600 }
              }
            })
          }
        );
          } catch (error) {
            logger.warn(
              `Exa ${kind} search failed for ${country.name}: ${errorMessage(error)}`
            );
            return [];
          }

          if (!response.ok) {
            logger.warn(
              `Exa ${kind} search failed for ${country.name}: ` +
                `${response.status} ${await response.text()}`
            );
            return [];
          }

          let payload: unknown;
          try {
            payload = (await response.json()) as unknown;
          } catch {
            return [];
          }

          return readResults(payload)
            .map((result) => ({
              title: normalizeText(result.title),
              url: normalizeText(result.url),
              text: normalizeText(result.text),
              researchKind: kind
            }))
            .filter(
              (snippet) =>
                Boolean(snippet.url) &&
                snippet.text.length >=
                  EXA_MIN_SNIPPET_TEXT_LENGTH
            );
        })
      );
      return deduplicateByUrl(batches.flat()).slice(0, 18);
    }
  };
}

function deduplicateByUrl(
  snippets: CountryDraftGroundingSnippet[]
): CountryDraftGroundingSnippet[] {
  const seen = new Set<string>();
  return snippets.filter((snippet) => {
    const url = normalizeText(snippet.url);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function readResults(
  value: unknown
): Record<string, unknown>[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.results)
  ) {
    return [];
  }
  return value.results.filter(isRecord);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
