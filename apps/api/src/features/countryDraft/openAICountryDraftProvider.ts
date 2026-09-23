import {
  extractOpenAIText,
  parseJsonObject,
  type JsonObject
} from "../../platform/openai/responseParsing.ts";
import type {
  RecordProviderUsage
} from "../usage/usageService.ts";

export type CountryDraftProviderResult =
  | {
      payload: JsonObject;
      status: "ready";
    }
  | {
      reason: string;
      status:
        | "provider_missing"
        | "provider_error"
        | "parse_error";
    };

type OpenAICountryDraftProviderOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  model: string;
  recordUsage?: RecordProviderUsage;
  serviceTier?: "fast";
};

export function createOpenAICountryDraftProvider({
  apiKey,
  model,
  recordUsage,
  serviceTier,
  fetchFn = fetch
}: OpenAICountryDraftProviderOptions) {
  return {
    isConfigured: Boolean(apiKey),
    model,

    async generate(
      prompt: string
    ): Promise<CountryDraftProviderResult> {
      if (!apiKey) {
        return {
          status: "provider_missing",
          reason:
            "OPENAI_API_KEY is not configured."
        };
      }

      let response: Response;
      const requestStartedAt = Date.now();
      try {
        response = await fetchFn(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              ...(serviceTier ? { service_tier: serviceTier } : {}),
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
              ]
            })
          }
        );
      } catch (error) {
        return {
          status: "provider_error",
          reason:
            "OpenAI starter map update failed: " +
            errorMessage(error)
        };
      }

      if (!response.ok) {
        return {
          status: "provider_error",
          reason:
            "OpenAI starter map update failed: " +
            `${response.status} ${await response.text()}`
        };
      }

      const responsePayload = await response.json() as unknown;
      recordUsage?.({
        durationMs: Date.now() - requestStartedAt,
        feature: "country_draft",
        model,
        serviceTier,
        usage: readUsage(responsePayload)
      });
      const payload = parseJsonObject(
        extractOpenAIText(responsePayload)
      );
      if (!payload) {
        return {
          status: "parse_error",
          reason:
            "OpenAI returned a non-JSON starter map."
        };
      }

      return { status: "ready", payload };
    }
  };
}

function readUsage(payload: unknown): unknown {
  return typeof payload === "object" && payload !== null &&
    "usage" in payload
    ? payload.usage
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}
