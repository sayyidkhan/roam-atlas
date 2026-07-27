import { readFile } from "node:fs/promises";

import { mimeTypeForImagePath } from "../../platform/http/mediaTypes.js";
import {
  extractOpenAIText,
  parseJsonObject
} from "../../platform/openai/responseParsing.js";

export function createOpenAIEnvironmentPlanner({
  apiKey,
  model,
  getImagePathFromUrl,
  buildPrompt,
  getPromptContext,
  normalizePlan,
  createFallback,
  fetchFn = fetch
}) {
  return async function createEnvironmentPlan(page, { signal = null } = {}) {
    if (!apiKey) {
      return createFallback(page, "OPENAI_API_KEY is not configured.");
    }
    const imagePath = getImagePathFromUrl(page.imageUrl);
    if (!imagePath) {
      return createFallback(
        page,
        "Current page image path is outside the RoamAtlas workspace and runtime cache."
      );
    }

    const imageBytes = await readFile(imagePath);
    const promptContext = getPromptContext(page);
    let lastError = null;
    if (model) {
      const response = await fetchFn("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: createRequestSignal(signal, 90_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: buildPrompt(promptContext) },
              {
                type: "input_image",
                image_url:
                  `data:${mimeTypeForImagePath(imagePath)};base64,${imageBytes.toString("base64")}`,
                detail: "high"
              }
            ]
          }]
        })
      });
      if (!response.ok) {
        return createFallback(page, `${model}: ${await response.text()}`);
      }

      const parsed = parseJsonObject(extractOpenAIText(await response.json()));
      const plan = normalizePlan(parsed, page, {
        source: "openai-vlm",
        model
      });
      const hasRequiredTargets =
        promptContext.targetCandidates.length === 0 || plan.targets.length > 0;
      if (
        hasRequiredTargets &&
        (plan.layers.length > 0 || plan.targets.length > 0)
      ) {
        return plan;
      }
      lastError =
        promptContext.targetCandidates.length > 0
          ? `${model}: environment planner returned no usable destination targets.`
          : `${model}: environment planner returned no usable targets or safe layers.`;
    }

    return createFallback(
      page,
      lastError ?? "No environment planner model is configured."
    );
  };
}

function createRequestSignal(externalSignal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([externalSignal, timeoutSignal]);
  }
  const controller = new AbortController();
  const forwardAbort = (source) => {
    if (!controller.signal.aborted) controller.abort(source.reason);
  };
  for (const source of [externalSignal, timeoutSignal]) {
    if (source.aborted) {
      forwardAbort(source);
      break;
    }
    source.addEventListener("abort", () => forwardAbort(source), { once: true });
  }
  return controller.signal;
}
