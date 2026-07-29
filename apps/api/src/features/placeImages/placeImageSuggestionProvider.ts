import {
  buildPlaceImagePromptSuggestionFallbacks,
  normalizePlaceImagePromptSuggestions,
  type PlaceImageCountry
} from "./placeImageSuggestionPolicy.ts";
import type {
  PlaceImageSuggestionRequest,
  PlaceImageSuggestionResult
} from "./placeImageServiceTypes.ts";

type JsonObject = Record<string, unknown>;

type PlaceImageSuggestionProviderOptions = {
  apiKey?: string;
  extractText: (payload: unknown) => string;
  fetchFn?: typeof fetch;
  model: string;
  parseJson: (
    text: unknown
  ) => JsonObject | null;
};

export function createPlaceImageSuggestionProvider({
  apiKey,
  model,
  extractText,
  parseJson,
  fetchFn = fetch
}: PlaceImageSuggestionProviderOptions) {
  return {
    async suggest(
      country: PlaceImageCountry,
      {
        place,
        context = [],
        kind = "region",
        currentFeedback = ""
      }: PlaceImageSuggestionRequest
    ): Promise<PlaceImageSuggestionResult> {
      const fallback =
        buildPlaceImagePromptSuggestionFallbacks(
          country,
          {
            place,
            context,
            currentFeedback
          }
        );
      if (!apiKey) {
        return {
          suggestions: fallback,
          source: "curated-fallback"
        };
      }

      const prompt = buildSuggestionPrompt(
        country,
        {
          place,
          context,
          kind,
          currentFeedback
        }
      );
      try {
        const response = await fetchFn(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              input: [
                {
                  role: "user",
                  content: [
                    {
                      type: "input_text",
                      text: prompt
                    }
                  ]
                }
              ],
              temperature: 0.1
            })
          }
        );
        if (!response.ok) {
          return fallbackResult(fallback);
        }

        const parsed = parseJson(
          extractText(
            (await response.json()) as unknown
          )
        );
        const suggestions =
          normalizePlaceImagePromptSuggestions(
            parsed?.suggestions,
            { place, context }
          );
        return suggestions.length
          ? { suggestions, source: "llm" }
          : fallbackResult(fallback);
      } catch {
        return fallbackResult(fallback);
      }
    }
  };
}

function buildSuggestionPrompt(
  country: PlaceImageCountry,
  {
    place,
    context,
    kind,
    currentFeedback
  }: Required<PlaceImageSuggestionRequest>
): string {
  return [
    "You write short search prompts for selecting an unverified reference photo.",
    'Return JSON only with this exact shape: {"suggestions":["...","...","..."]}.',
    "Use only the supplied mapped location title and mapped child names. Do not invent places, landmarks, facts, opening hours, routes, or claims.",
    "Each suggestion must be a concise search instruction for a real photograph and should identify one supplied mapped location or the supplied region.",
    "Avoid generic Singapore landmarks that are not in the supplied mapped context.",
    "",
    `Country: ${country.name}`,
    `Mapped location: ${place}`,
    `Location type: ${kind}`,
    `Mapped child context: ${context.length ? context.join(" | ") : "None supplied"}`,
    `Current user feedback: ${currentFeedback || "None"}`
  ].join("\n");
}

function fallbackResult(
  suggestions: string[]
): PlaceImageSuggestionResult {
  return {
    suggestions,
    source: "curated-fallback"
  };
}
