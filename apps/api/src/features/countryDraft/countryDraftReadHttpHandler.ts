import {
  createCountryPackStarterMap
} from "@roamatlas/domain/countryDraft.js";
import {
  appendUnconfirmedRegionCandidates
} from "@roamatlas/domain/countryDraftReview.js";
import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  sendUnknownCountry,
  type CountryDraftHttpContext
} from "./countryDraftHttpContext.ts";
import type {
  CountryDraftHttpHandlers
} from "./countryDraftHttpTypes.ts";

export function createCountryDraftReadHttpHandler<
  CountryPack extends {
    confidence?: unknown;
  }
>(
  context: CountryDraftHttpContext<CountryPack>
): Pick<
  CountryDraftHttpHandlers,
  "handleDraftRequest"
> {
  return {
    async handleDraftRequest(url) {
      const countrySlug = String(
        url.searchParams.get("countrySlug") ?? ""
      )
        .trim()
        .toLowerCase();
      const forceGenerate =
        url.searchParams.get("force") === "true";
      const shouldGenerate =
        forceGenerate ||
        url.searchParams.get("generate") !==
          "false";
      const country =
        context.findCountry(countrySlug);
      if (!country) {
        return sendUnknownCountry(countrySlug);
      }

      const countryPack = context.getCountryPack(
        country.slug
      );
      if (
        context.isSourceControlledCountryPack(
          countryPack
        )
      ) {
        const packSnapshot =
          createCountryPackStarterMap(
            countryPack
          );
        // Checked-in packs are authoritative. Runtime data can only append
        // unconfirmed candidates; it cannot replace curated source data.
        if (!forceGenerate) {
          const storedPackSnapshot =
            await context.readStoredCountryDraft(
              country
            );
          if (
            storedPackSnapshot?.mode ===
            "curated_pack_snapshot"
          ) {
            for (const region of
              packSnapshot.regions) {
              appendUnconfirmedRegionCandidates(
                packSnapshot,
                region.name,
                storedPackSnapshot
              );
            }
            packSnapshot.changeNote = "";
          }
        }
        context.countryDraftCache.set(
          country.slug,
          packSnapshot
        );
        await context.writeStoredCountryDraft(
          country,
          packSnapshot
        );
        return jsonResponse({
          draft: packSnapshot,
          cached: false,
          persisted: true,
          regenerated: forceGenerate,
          source: "country_pack"
        });
      }

      if (!forceGenerate) {
        const cachedDraft =
          context.countryDraftCache.get(
            country.slug
          );
        if (cachedDraft) {
          const draft =
            context.withFreshPackThemes(
              cachedDraft,
              country
            ) ?? cachedDraft;
          context.countryDraftCache.set(
            country.slug,
            draft
          );
          return jsonResponse({
            draft,
            cached: true
          });
        }
        const storedDraft =
          await context.readStoredCountryDraft(
            country
          );
        if (storedDraft) {
          const draft =
            context.withFreshPackThemes(
              storedDraft,
              country
            ) ?? storedDraft;
          context.countryDraftCache.set(
            country.slug,
            draft
          );
          return jsonResponse({
            draft,
            cached: true,
            persisted: true
          });
        }
      }

      if (!shouldGenerate) {
        return jsonResponse({
          draft: null,
          cached: false,
          persisted: false
        });
      }

      const draft =
        await context.generateCountryDraft(
          country
        );
      if (
        draft.generationStatus === "ready"
      ) {
        context.countryDraftCache.set(
          country.slug,
          draft
        );
        await context.writeStoredCountryDraft(
          country,
          draft
        );
      }
      return jsonResponse({
        draft,
        cached: false,
        regenerated: forceGenerate
      });
    }
  };
}
