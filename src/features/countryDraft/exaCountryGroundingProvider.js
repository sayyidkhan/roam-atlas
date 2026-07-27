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

export const EXA_MIN_SNIPPET_TEXT_LENGTH = 200;

export function createExaCountryGroundingProvider({
  apiKey,
  fetchFn = fetch,
  logger = console
}) {
  return {
    async search(country) {
      if (!apiKey) return [];
      const query = `Official tourism attractions, districts, and regions in ${country.name}`;
      let response;
      try {
        response = await fetchFn("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query,
            numResults: 8,
            includeDomains: EXA_GROUNDING_DOMAINS,
            contents: { text: { maxCharacters: 2000 } }
          })
        });
      } catch (error) {
        logger.warn(
          `Exa grounding search failed for ${country.name}: ${String(error?.message ?? error)}`
        );
        return [];
      }

      if (!response.ok) {
        logger.warn(
          `Exa grounding search failed for ${country.name}: ${response.status} ${await response.text()}`
        );
        return [];
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        return [];
      }

      return (Array.isArray(payload?.results) ? payload.results : [])
        .map((result) => ({
          title: String(result?.title ?? "").trim(),
          url: String(result?.url ?? "").trim(),
          text: String(result?.text ?? "").trim()
        }))
        .filter(
          (snippet) =>
            snippet.url && snippet.text.length >= EXA_MIN_SNIPPET_TEXT_LENGTH
        );
    }
  };
}
