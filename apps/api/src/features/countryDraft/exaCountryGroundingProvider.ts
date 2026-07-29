import type {
  CountryDraftCountry,
  CountryDraftGroundingSnippet
} from "@roamatlas/domain/countryDraft.js";

const EXA_GROUNDING_DOMAINS = [
  "visitsingapore.com",
  "stb.gov.sg",
  "mandai.com",
  "malaysia.travel",
  "tourism.gov.my",
  "wikipedia.org",
  "gov.sg",
  "gov.my"
];

export const EXA_MIN_SNIPPET_TEXT_LENGTH =
  200;

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
      const query =
        "Official tourism attractions, districts, " +
        `and regions in ${country.name}`;
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
              numResults: 8,
              includeDomains:
                EXA_GROUNDING_DOMAINS,
              contents: {
                text: { maxCharacters: 2000 }
              }
            })
          }
        );
      } catch (error) {
        logger.warn(
          `Exa grounding search failed for ${country.name}: ${errorMessage(error)}`
        );
        return [];
      }

      if (!response.ok) {
        logger.warn(
          `Exa grounding search failed for ${country.name}: ` +
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
          text: normalizeText(result.text)
        }))
        .filter(
          (snippet) =>
            Boolean(snippet.url) &&
            snippet.text.length >=
              EXA_MIN_SNIPPET_TEXT_LENGTH
        );
    }
  };
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
