import type { CountrySummary } from "../../app/applicationRuntimeTypes";
import {
  replaceLatestProcessingMessage
} from "../countrySetup/countryExperiencePolicy";
import { scopedDraftMessage } from "./countryDraftChatPolicy";
import type {
  CountryDraftClient,
  CountryDraftStore
} from "./countryDraftTypes";

type CountryDraftInfluenceDependencies = {
  countryDraftClient: Pick<
    CountryDraftClient,
    "influence"
  >;
  explainError: (error: unknown) => string;
  render: () => void;
  draftStore: CountryDraftStore;
};

export function createCountryDraftInfluenceController(
  dependencies: CountryDraftInfluenceDependencies
) {
  const {
    countryDraftClient,
    explainError,
    render,
    draftStore
  } = dependencies;

  async function requestCountryDraftInfluence(
    country: CountrySummary,
    rawInstruction: unknown,
    { target = "starter-map" }: { target?: string } = {}
  ): Promise<void> {
    const instruction = String(
      rawInstruction ?? ""
    ).trim();
    if (!instruction) return;

    const existing = draftStore.get(country.slug);
    if (
      existing?.status === "loading" ||
      existing?.isSending
    ) {
      return;
    }

    const userMessage = scopedDraftMessage(
      { role: "user", text: instruction },
      target
    );
    const processingMessage = scopedDraftMessage(
      {
        role: "assistant",
        status: "processing",
        text:
          "Processing your instruction and updating the unconfirmed starter map."
      },
      target
    );
    const messages = [
      ...(existing?.messages ?? []),
      userMessage,
      processingMessage
    ].slice(-12);
    draftStore.set(country.slug, {
      ...existing,
      status: existing?.draft ? "ready" : "loading",
      isSending: true,
      messages
    });
    render();

    try {
      const { draft, message } =
        await countryDraftClient.influence({
          countrySlug: country.slug,
          instruction,
          target,
          currentDraft: existing?.draft ?? null
        });
      const assistantMessage = scopedDraftMessage(
        {
          ...(message ?? {
            role: "assistant",
            text:
              "Starter map updated. All candidates remain unconfirmed."
          }),
          status: "done"
        },
        target
      );
      draftStore.set(country.slug, {
        status: "ready",
        draft,
        isSending: false,
        confirmation: null,
        messages: replaceLatestProcessingMessage(
          messages,
          assistantMessage,
          target
        ).slice(-12)
      });
    } catch (error) {
      const message = explainError(error);
      const errorMessage = scopedDraftMessage(
        {
          role: "assistant",
          status: "error",
          text: message
        },
        target
      );
      draftStore.set(country.slug, {
        ...existing,
        status: existing?.draft ? "ready" : "failed",
        isSending: false,
        confirmation: existing?.confirmation ?? null,
        messages: replaceLatestProcessingMessage(
          messages,
          errorMessage,
          target
        ).slice(-12),
        error: message
      });
    }
    render();
  }

  return { requestCountryDraftInfluence };
}
