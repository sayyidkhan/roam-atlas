import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const CountryPackSummarySchema = z.object({
  countryCode: nonEmptyText,
  countrySlug: nonEmptyText,
  title: nonEmptyText,
  rootNodeId: nonEmptyText,
  overviewSceneId: nonEmptyText,
  confidence: z.enum(["confirmed", "likely", "general", "unconfirmed"]),
  registration: z.enum(["source_controlled", "runtime_draft", "unregistered"])
}).passthrough();

export const CountryPackRegistryResponseSchema = z.object({
  defaultCountrySlug: nonEmptyText,
  countryPacks: z.record(nonEmptyText, CountryPackSummarySchema)
});

export const CountryPackResponseSchema = z.object({
  countrySlug: nonEmptyText,
  countryPack: CountryPackSummarySchema
});
