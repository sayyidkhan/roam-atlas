import { randomUUID } from "node:crypto";

import type {
  UsageFeature,
  UsageRecord,
  UsageSummary
} from "@roamatlas/contracts/usageContract.js";

type UsagePricing = {
  cachedInput: number;
  imageInput?: number;
  imageOutput?: number;
  input: number;
  output: number;
};

const PRICE_PER_MILLION_TOKENS: Record<string, UsagePricing> = {
  "gpt-5.6-sol:fast": {
    input: 8,
    cachedInput: 0.8,
    output: 40
  },
  "gpt-5.6-terra:fast": {
    input: 4,
    cachedInput: 0.4,
    output: 24
  },
  "gpt-image-2.5-flare-2026-09-08:standard": {
    input: 5,
    cachedInput: 1.25,
    output: 0,
    imageInput: 8,
    imageOutput: 30
  },
  "gpt-image-2.5-sunburst-2026-09-08:standard": {
    input: 5,
    cachedInput: 1.25,
    output: 0,
    imageInput: 8,
    imageOutput: 30
  },
  "gpt-image-2:standard": {
    input: 2.5,
    cachedInput: 0.625,
    output: 0,
    imageInput: 4,
    imageOutput: 15
  }
};

export const USAGE_PRICING_NOTE =
  "Estimated from OpenAI token rates configured on 2026-09-22; excludes taxes, account discounts, and requests that return no usage.";

export function createUsageRecord({
  feature,
  model,
  serviceTier = null,
  usage,
  durationMs,
  timestamp = new Date()
}: {
  feature: UsageFeature;
  model: string;
  serviceTier?: string | null;
  usage: unknown;
  durationMs: number;
  timestamp?: Date;
}): UsageRecord {
  const normalized = normalizeProviderUsage(usage);
  const pricing =
    PRICE_PER_MILLION_TOKENS[
      `${model}:${serviceTier ?? "standard"}`
    ];
  return {
    id: randomUUID(),
    timestamp: timestamp.toISOString(),
    feature,
    model,
    serviceTier,
    ...normalized,
    estimatedCostUsd: pricing
      ? estimateCost(normalized, pricing)
      : 0,
    durationMs: Math.max(0, Math.round(durationMs))
  };
}

export function summarizeUsage(
  records: UsageRecord[]
): UsageSummary {
  return records.reduce<UsageSummary>(
    (summary, record) => ({
      requests: summary.requests + 1,
      inputTokens: summary.inputTokens + record.inputTokens,
      cachedInputTokens:
        summary.cachedInputTokens + record.cachedInputTokens,
      outputTokens: summary.outputTokens + record.outputTokens,
      imageInputTokens:
        summary.imageInputTokens + record.imageInputTokens,
      imageOutputTokens:
        summary.imageOutputTokens + record.imageOutputTokens,
      estimatedCostUsd:
        summary.estimatedCostUsd + record.estimatedCostUsd
    }),
    {
      requests: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      imageInputTokens: 0,
      imageOutputTokens: 0,
      estimatedCostUsd: 0
    }
  );
}

function normalizeProviderUsage(usage: unknown) {
  const record = asRecord(usage);
  const inputDetails = asRecord(
    record.input_tokens_details ??
      record.inputTokensDetails
  );
  const outputDetails = asRecord(
    record.output_tokens_details ??
      record.outputTokensDetails
  );
  const imageInputTokens = readCount(
    inputDetails.image_tokens ??
      record.image_input_tokens
  );
  const imageOutputTokens = readCount(
    outputDetails.image_tokens ??
      record.image_output_tokens
  );
  const totalInputTokens = readCount(
    record.input_tokens ?? record.inputTokens
  );
  const totalOutputTokens = readCount(
    record.output_tokens ?? record.outputTokens
  );
  return {
    inputTokens: Math.max(
      0,
      totalInputTokens - imageInputTokens
    ),
    cachedInputTokens: readCount(
      inputDetails.cached_tokens ??
        record.cached_input_tokens
    ),
    outputTokens: Math.max(
      0,
      totalOutputTokens - imageOutputTokens
    ),
    imageInputTokens,
    imageOutputTokens
  };
}

function estimateCost(
  usage: ReturnType<typeof normalizeProviderUsage>,
  pricing: UsagePricing
): number {
  const uncachedInput = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens
  );
  const cost =
    uncachedInput * pricing.input +
    usage.cachedInputTokens * pricing.cachedInput +
    usage.outputTokens * pricing.output +
    usage.imageInputTokens *
      (pricing.imageInput ?? pricing.input) +
    usage.imageOutputTokens *
      (pricing.imageOutput ?? pricing.output);
  return Number((cost / 1_000_000).toFixed(8));
}

function readCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
}
