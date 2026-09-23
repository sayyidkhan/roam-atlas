import { readFile } from "node:fs/promises";

import { mimeTypeForImagePath } from "../../platform/http/mediaTypes.ts";
import {
  extractOpenAIText,
  parseJsonObject
} from "../../platform/openai/responseParsing.ts";
import type {
  EnvironmentPage,
  RawEnvironmentPlan
} from "./environmentPlanServerTypes.ts";
import type {
  RecordProviderUsage
} from "../usage/usageService.ts";

type EnvironmentPromptContext = {
  targetCandidates: unknown[];
};

type UsableEnvironmentPlan = {
  layers: unknown[];
  targets: unknown[];
};

type OpenAIEnvironmentPlannerDependencies<
  Page extends EnvironmentPage,
  Plan extends UsableEnvironmentPlan,
  PromptContext extends EnvironmentPromptContext
> = {
  apiKey?: string;
  buildPrompt: (context: PromptContext) => string;
  createFallback: (page: Page, reason: string) => Plan;
  fetchFn?: typeof fetch;
  getImagePathFromUrl: (imageUrl: string) => string | null;
  getPromptContext: (page: Page) => PromptContext;
  model?: string | null;
  recordUsage?: RecordProviderUsage;
  serviceTier?: "fast";
  normalizePlan: (
    rawPlan: RawEnvironmentPlan | null,
    page: Page,
    metadata: {
      model: string;
      source: "openai-vlm";
    }
  ) => Plan;
};

export function createOpenAIEnvironmentPlanner<
  Page extends EnvironmentPage,
  Plan extends UsableEnvironmentPlan,
  PromptContext extends EnvironmentPromptContext
>({
  apiKey,
  model,
  recordUsage,
  serviceTier,
  getImagePathFromUrl,
  buildPrompt,
  getPromptContext,
  normalizePlan,
  createFallback,
  fetchFn = fetch
}: OpenAIEnvironmentPlannerDependencies<
  Page,
  Plan,
  PromptContext
>) {
  return async function createEnvironmentPlan(
    page: Page,
    {
      signal = null
    }: {
      signal?: AbortSignal | null;
    } = {}
  ): Promise<Plan> {
    if (!apiKey) {
      return createFallback(page, "OPENAI_API_KEY is not configured.");
    }
    if (!page.imageUrl) {
      return createFallback(page, "Current page has no generated image.");
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
    let lastError: string | null = null;
    if (model) {
      const requestStartedAt = Date.now();
      const response = await fetchFn("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: createRequestSignal(signal, 90_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          ...(serviceTier ? { service_tier: serviceTier } : {}),
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

      const payload = await response.json();
      recordUsage?.({
        durationMs: Date.now() - requestStartedAt,
        feature: "environment_plan",
        model,
        serviceTier,
        usage: readUsage(payload)
      });
      const parsed = parseJsonObject(extractOpenAIText(payload));
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

function readUsage(payload: unknown): unknown {
  return typeof payload === "object" && payload !== null &&
    "usage" in payload
    ? payload.usage
    : null;
}

function createRequestSignal(
  externalSignal: AbortSignal | null,
  timeoutMs: number
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([externalSignal, timeoutSignal]);
  }
  const controller = new AbortController();
  const forwardAbort = (source: AbortSignal) => {
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
