import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  readJsonRequest
} from "../../platform/http/readJsonRequest.ts";
import type {
  CountryDraft,
  CountryDraftCountry
} from "@roamatlas/domain/countryDraft.js";
import type {
  CountryDraftHttpDependencies
} from "./countryDraftHttpTypes.ts";

export type CountryDraftHttpContext<
  CountryPack extends {
    confidence?: unknown;
  }
> = CountryDraftHttpDependencies<CountryPack> & {
  findCountry: (
    countrySlug: unknown
  ) => CountryDraftCountry | null | undefined;
  isSourceReviewedCountryPack: (
    countryPack:
      | CountryPack
      | null
      | undefined
  ) => countryPack is CountryPack;
  loadCurrentDraft: (
    body: Record<string, unknown>,
    country: CountryDraftCountry
  ) => Promise<CountryDraft | null>;
};

export function createCountryDraftHttpContext<
  CountryPack extends {
    confidence?: unknown;
  }
>(
  dependencies:
    CountryDraftHttpDependencies<CountryPack>
): CountryDraftHttpContext<CountryPack> {
  return {
    ...dependencies,
    findCountry(countrySlug) {
      return dependencies.getCountryBySlug(
        String(countrySlug ?? "")
          .trim()
          .toLowerCase()
      );
    },
    async loadCurrentDraft(body, country) {
      return (
        dependencies.normalizeCurrentCountryDraft(
          body.currentDraft,
          country
        ) ??
        dependencies.countryDraftCache.get(
          country.slug
        ) ??
        (await dependencies.readStoredCountryDraft(
          country
        )) ??
        null
      );
    },
    isSourceReviewedCountryPack(
      countryPack
    ): countryPack is CountryPack {
      return Boolean(
        countryPack &&
          dependencies.isSourceControlledCountryPack(
            countryPack
          ) &&
          countryPack.confidence !==
            "unconfirmed"
      );
    }
  };
}

export function approvalMessage({
  approved,
  confidence,
  target
}: {
  approved: boolean;
  confidence: unknown;
  target: string;
}): string {
  const label =
    target.split(":")[1] ?? "Item";
  if (!approved) {
    return (
      `${label} returned to needs-review ` +
      "status."
    );
  }
  return confidence === "confirmed"
    ? `${label} marked as curated in the starter map. Update the country pack source file to make it permanent.`
    : `${label} approved for map preview. Add a source URL to mark it as curated.`;
}

export function sendUnknownCountry(
  countrySlug: unknown
): Response {
  return jsonResponse(
    {
      error: `Unknown country: ${String(countrySlug ?? "")}`
    },
    404
  );
}

export async function readRequestObject(
  request: Request
): Promise<Record<string, unknown>> {
  const value = await readJsonRequest(request);
  return isRecord(value) ? value : {};
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
