import {
  extractOpenAIText,
  parseJsonObject
} from "../../platform/openai/responseParsing.js";

export function createOpenAICountryDraftProvider({
  apiKey,
  model,
  fetchFn = fetch
}) {
  return {
    isConfigured: Boolean(apiKey),
    model,
    async generate(prompt) {
      if (!apiKey) {
        return {
          status: "provider_missing",
          reason: "OPENAI_API_KEY is not configured."
        };
      }

      let response;
      try {
        response = await fetchFn("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            input: [{
              role: "user",
              content: [{ type: "input_text", text: prompt }]
            }],
            temperature: 0.2
          })
        });
      } catch (error) {
        return {
          status: "provider_error",
          reason:
            `OpenAI starter map update failed: ${String(error?.message ?? error)}`
        };
      }

      if (!response.ok) {
        return {
          status: "provider_error",
          reason:
            `OpenAI starter map update failed: ${response.status} ${await response.text()}`
        };
      }

      const payload = parseJsonObject(
        extractOpenAIText(await response.json())
      );
      if (!payload) {
        return {
          status: "parse_error",
          reason: "OpenAI returned a non-JSON starter map."
        };
      }

      return { status: "ready", payload };
    }
  };
}
