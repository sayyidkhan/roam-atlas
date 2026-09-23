import { z } from "zod";

export const UsageFeatureSchema = z.enum([
  "country_draft",
  "environment_plan",
  "image_generation",
  "place_image_suggestion",
  "visual_click_resolution"
]);

export const UsageRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  feature: UsageFeatureSchema,
  model: z.string().min(1),
  serviceTier: z.string().nullable(),
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  imageInputTokens: z.number().int().nonnegative(),
  imageOutputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  durationMs: z.number().int().nonnegative()
});

export const UsageSummarySchema = z.object({
  requests: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  imageInputTokens: z.number().int().nonnegative(),
  imageOutputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative()
});

export const UsageResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  pricingNote: z.string().min(1),
  summary: UsageSummarySchema,
  records: z.array(UsageRecordSchema)
});

export type UsageFeature = z.infer<typeof UsageFeatureSchema>;
export type UsageRecord = z.infer<typeof UsageRecordSchema>;
export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type UsageSummary = z.infer<typeof UsageSummarySchema>;
