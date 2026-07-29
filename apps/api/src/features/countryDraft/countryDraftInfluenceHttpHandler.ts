import {
  createCountryPackStarterMap,
  normalizeCountryDraftInstruction
} from "@roamatlas/domain/countryDraft.js";
import {
  appendUnconfirmedRegionCandidates,
  parseDraftReviewTarget
} from "@roamatlas/domain/countryDraftReview.js";
import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  readRequestObject,
  sendUnknownCountry,
  type CountryDraftHttpContext
} from "./countryDraftHttpContext.ts";
import type {
  CountryDraftHttpHandlers
} from "./countryDraftHttpTypes.ts";

export function createCountryDraftInfluenceHttpHandler<
  CountryPack extends {
    confidence?: unknown;
  }
>(
  context: CountryDraftHttpContext<CountryPack>
): Pick<
  CountryDraftHttpHandlers,
  "handleInfluenceRequest"
> {
  return {
    async handleInfluenceRequest(request) {
      const body = await readRequestObject(
        request
      );
      const country = context.findCountry(
        body.countrySlug
      );
      if (!country) {
        return sendUnknownCountry(
          body.countrySlug
        );
      }
      const countryPack = context.getCountryPack(
        country.slug
      );
      const target = String(
        body.target ?? "starter-map"
      ).trim();

      if (
        context.isSourceReviewedCountryPack(
          countryPack
        )
      ) {
        const parsedTarget =
          parseDraftReviewTarget(target);
        if (
          parsedTarget?.kind !== "region"
        ) {
          return jsonResponse(
            {
              error:
                `${country.name} only supports append-only GenAI candidates within a selected region. ` +
                "Source-reviewed facts cannot be edited here."
            },
            409
          );
        }
        const currentDraft =
          (await context.loadCurrentDraft(
            body,
            country
          )) ??
          createCountryPackStarterMap(
            countryPack
          );
        const proposedDraft =
          await context.generateCountryDraft(
            country,
            {
              instruction:
                normalizeCountryDraftInstruction(
                  body.instruction
                ),
              currentDraft,
              appendOnlyRegionName:
                parsedTarget.name
            }
          );
        const appended =
          appendUnconfirmedRegionCandidates(
            currentDraft,
            parsedTarget.name,
            proposedDraft
          );
        if (!appended.changed) {
          return jsonResponse(
            { error: appended.error },
            422
          );
        }

        const additionCount =
          appended.additions?.length ?? 0;
        context.countryDraftCache.set(
          country.slug,
          currentDraft
        );
        await context.writeStoredCountryDraft(
          country,
          currentDraft
        );
        return jsonResponse({
          draft: currentDraft,
          message: {
            role: "assistant",
            text:
              `${additionCount} unconfirmed candidate` +
              `${additionCount === 1 ? "" : "s"} added to ${parsedTarget.name}.`
          }
        });
      }

      const instruction =
        normalizeCountryDraftInstruction(
          body.instruction
        );
      if (!instruction) {
        return jsonResponse(
          {
            error:
              "Starter map instruction is required."
          },
          400
        );
      }
      const currentDraft =
        await context.loadCurrentDraft(
          body,
          country
        );
      const draft =
        await context.generateCountryDraft(
          country,
          {
            instruction,
            currentDraft
          }
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
        message: {
          role: "assistant",
          text:
            draft.changeNote ||
            "Starter map updated. All candidates remain unconfirmed."
        }
      });
    }
  };
}
