import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const ArtworkRequestQuerySchema = z.object({
  countrySlug: nonEmptyText.optional(),
  sceneId: nonEmptyText.optional(),
  nodeId: nonEmptyText.optional(),
  quality: z.enum(["low", "medium", "high", "auto"]).optional(),
  priority: z.enum(["interactive"]).optional(),
  prefetch: z.enum(["true", "priority"]).optional()
});

export const ArtworkPageSchema = z.object({
  id: nonEmptyText,
  countrySlug: nonEmptyText,
  sceneId: nonEmptyText,
  nodeId: nonEmptyText.nullable(),
  parentId: z.string().nullable().optional(),
  parentClick: z.unknown().nullable().optional(),
  status: nonEmptyText,
  imageUrl: z.string().min(1).nullable().optional(),
  environmentUrl: z.string().min(1).nullable().optional(),
  assetVersion: z.string().min(1).optional(),
  plan: z.object({
    title: nonEmptyText,
    factMode: nonEmptyText
  }).passthrough(),
  generated: z.object({
    jobUrl: z.string().min(1).optional(),
    environmentUrl: z.string().min(1).nullable().optional(),
    factBoundary: z.string().min(1).optional()
  }).passthrough().optional()
}).passthrough();

export const ArtworkResponseSchema = z.object({
  page: ArtworkPageSchema
});
