import {
  createCountryPackDraftFromStarterMap
} from "@roamatlas/domain/countryDraft.js";
import {
  approveDraftItem,
  unapproveDraftItem
} from "@roamatlas/domain/countryDraftReview.js";
import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  approvalMessage,
  readRequestObject,
  sendUnknownCountry,
  type CountryDraftHttpContext
} from "./countryDraftHttpContext.ts";
import type {
  CountryDraftHttpHandlers
} from "./countryDraftHttpTypes.ts";

type ReviewHandlers = Pick<
  CountryDraftHttpHandlers,
  | "handleApprovalRequest"
  | "handleConfirmRequest"
  | "handleReorderRequest"
>;

export function createCountryDraftReviewHttpHandlers<
  CountryPack extends {
    confidence?: unknown;
  }
>(
  context: CountryDraftHttpContext<CountryPack>
): ReviewHandlers {
  return {
    async handleApprovalRequest(request) {
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
      const target = String(
        body.target ?? ""
      ).trim();
      const approved =
        body.approved !== false;
      const recursive =
        body.recursive === true;
      const sourceUrl =
        String(body.sourceUrl ?? "").trim() ||
        null;
      const currentDraft =
        await context.loadCurrentDraft(
          body,
          country
        );
      if (!currentDraft) {
        return jsonResponse(
          {
            error:
              "Build a starter map before approving items."
          },
          400
        );
      }

      const result = approved
        ? approveDraftItem(
            currentDraft,
            target,
            { sourceUrl, recursive }
          )
        : unapproveDraftItem(
            currentDraft,
            target,
            { recursive }
          );
      if (!result.changed || !result.draft) {
        return jsonResponse(
          {
            error:
              result.error ??
              "Approval update failed."
          },
          400
        );
      }

      context.countryDraftCache.set(
        country.slug,
        result.draft
      );
      await context.writeStoredCountryDraft(
        country,
        result.draft
      );
      return jsonResponse({
        draft: result.draft,
        target,
        approved,
        confidence: result.confidence,
        message: {
          role: "assistant",
          text: approvalMessage({
            approved,
            confidence: result.confidence,
            target
          })
        }
      });
    },

    async handleReorderRequest(request) {
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
      const draft =
        context.normalizeCurrentCountryDraft(
          body.currentDraft,
          country
        );
      if (!draft) {
        return jsonResponse(
          {
            error:
              "Build a starter map before sorting records."
          },
          400
        );
      }

      context.countryDraftCache.set(
        country.slug,
        draft
      );
      await context.writeStoredCountryDraft(
        country,
        draft
      );
      return jsonResponse({
        draft,
        message: {
          role: "assistant",
          text:
            "Starter map order saved. Records still need source review before promotion."
        }
      });
    },

    async handleConfirmRequest(request) {
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
      if (
        context.isSourceControlledCountryPack(
          context.getCountryPack(
            country.slug
          )
        )
      ) {
        return jsonResponse(
          {
            error:
              `${country.name} is already registered as a country pack. ` +
              "Confirm-for-curation only creates draft artifacts for countries that are not registered yet. " +
              `For ${country.name}, move reviewed changes into the source-controlled country pack instead.`
          },
          409
        );
      }

      const currentDraft =
        await context.loadCurrentDraft(
          body,
          country
        );
      if (!currentDraft) {
        return jsonResponse(
          {
            error:
              "Build a starter map before confirming it for curation."
          },
          400
        );
      }
      const confirmation =
        context.createStarterMapConfirmation(
          country,
          currentDraft
        );
      const countryPackDraft =
        createCountryPackDraftFromStarterMap(
          currentDraft
        );
      const paths =
        await context.writeStoredCountryPromotion({
          country,
          confirmation,
          countryPackDraft
        });
      return jsonResponse({
        confirmation,
        countryPackDraft,
        paths: {
          confirmationUrl:
            paths.starterMapConfirmationUrl,
          countryPackDraftUrl:
            paths.countryPackDraftUrl
        }
      });
    }
  };
}
