import { createLeafStudyTopics } from "@roamatlas/domain/leafStudyPlate.js";
import { buildLeafStudyPrompt } from "@roamatlas/prompts/buildLeafStudyPrompt.js";

import type { CompiledCountryPack } from "../../data/countryPacks/serverRegistry.ts";
import {
  extractOpenAIText,
  parseJsonObject
} from "../../platform/openai/responseParsing.ts";
import type { RecordProviderUsage } from "../usage/usageService.ts";
import {
  normalizeLeafStudyNotes,
  type LeafStudyEnrichedNote
} from "./leafStudyEnrichmentPolicy.ts";

type OpenAILeafStudyEnricherOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  getCountryPack: (countrySlug: string) => CompiledCountryPack | null;
  model: string;
  recordUsage?: RecordProviderUsage;
  serviceTier?: "fast";
};

export function createOpenAILeafStudyEnricher({
  apiKey,
  fetchFn = fetch,
  getCountryPack,
  model,
  recordUsage,
  serviceTier
}: OpenAILeafStudyEnricherOptions) {
  const cache = new Map<string, LeafStudyEnrichedNote[]>();

  return async function enrichLeafStudy({
    countrySlug,
    nodeId
  }: {
    countrySlug: string;
    nodeId: string;
  }): Promise<LeafStudyEnrichedNote[]> {
    const pack = getCountryPack(countrySlug);
    const node = pack?.nodes[nodeId];
    const topics = createLeafStudyTopics(node);
    if (!pack || !node || !topics.length || !apiKey) return [];

    const cacheKey = [
      countrySlug,
      nodeId,
      model,
      ...topics.map((topic) => `${topic.id}:${topic.text}`)
    ].join("|");
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const prompt = buildLeafStudyPrompt({
      countryName: pack.title,
      placeTitle: String(node.title ?? "This place"),
      topics
    });
    const requestStartedAt = Date.now();
    let response: Response;
    try {
      response = await fetchFn("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          ...(serviceTier ? { service_tier: serviceTier } : {}),
          input: [{
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }]
        })
      });
    } catch {
      return [];
    }

    if (!response.ok) return [];
    const payload = await response.json() as unknown;
    recordUsage?.({
      durationMs: Date.now() - requestStartedAt,
      feature: "leaf_study",
      model,
      serviceTier,
      usage: readUsage(payload)
    });
    const notes = normalizeLeafStudyNotes(
      topics,
      parseJsonObject(extractOpenAIText(payload))
    );
    if (notes.length) cache.set(cacheKey, notes);
    return notes;
  };
}

function readUsage(payload: unknown): unknown {
  return typeof payload === "object" && payload !== null && "usage" in payload
    ? payload.usage
    : null;
}
