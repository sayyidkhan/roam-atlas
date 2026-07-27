import { z } from "zod";

export const RuntimeCacheFlushRequestSchema = z.object({
  countrySlug: z.string().trim().min(1).max(80),
  scope: z.enum(["visuals", "all"]).optional()
});

export const RuntimeCacheFlushResponseSchema = z.object({
  countrySlug: z.string().min(1),
  countryName: z.string().min(1),
  scope: z.enum(["visuals", "all"]),
  flushed: z.boolean()
}).passthrough();
