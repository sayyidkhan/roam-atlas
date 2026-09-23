import {
  UsageResponseSchema,
  type UsageFeature,
  type UsageResponse
} from "@roamatlas/contracts/usageContract.js";

import {
  createUsageRecord,
  summarizeUsage,
  USAGE_PRICING_NOTE
} from "./usagePolicy.ts";
import { createUsageRepository } from "./usageRepository.ts";

export type RecordProviderUsage = (input: {
  durationMs: number;
  feature: UsageFeature;
  model: string;
  serviceTier?: string | null;
  usage: unknown;
}) => void;

export function createUsageService({
  runtimeCacheRoot,
  logger = console
}: {
  runtimeCacheRoot: string;
  logger?: Pick<Console, "error">;
}) {
  const repository = createUsageRepository({
    runtimeCacheRoot
  });

  const record: RecordProviderUsage = (input) => {
    const usageRecord = createUsageRecord(input);
    void repository.append(usageRecord).catch((error) => {
      logger.error("Failed to persist OpenAI usage:", error);
    });
  };

  async function read(): Promise<UsageResponse> {
    const records = await repository.list();
    return UsageResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      pricingNote: USAGE_PRICING_NOTE,
      summary: summarizeUsage(records),
      records
    });
  }

  return { read, record };
}
