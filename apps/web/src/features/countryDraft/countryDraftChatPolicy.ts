import type { DraftMessage } from "../countrySetup/countryExperiencePolicy";
import type { CountryDraft } from "./countryDraftTypes";

export type CountryDraftEditContext = {
  label: string;
  note: string;
  placeholder: string;
  target: string;
  title: string;
};

export function getCountryDraftEditContext(
  draft: CountryDraft,
  target: string | null
): CountryDraftEditContext | null {
  if (!target) return null;
  if (target === "starter-map") {
    return {
      target,
      label: "starter map",
      title: "Steer the starter map",
      placeholder:
        "Example: make the candidate regions more family-friendly, or focus the themes on food and nature",
      note:
        "Edits only change the starter map direction. Sources are still required before promotion."
    };
  }

  const [kind, name = ""] = target.split(":");
  const isKnownRegion =
    kind === "region" &&
    (draft.regions ?? []).some((region) => region.name === name);
  const isKnownTheme =
    kind === "theme" &&
    (draft.themes ?? []).some((theme) => theme.label === name);
  if (!isKnownRegion && !isKnownTheme) return null;

  return {
    target,
    label: name,
    title: `Steer ${name}`,
    placeholder: `Example: rename ${name}, or change why it matters`,
    note:
      `This edit is scoped to ${name}. It only changes the starter map ` +
      "direction; sources are still required before promotion."
  };
}

export function draftMessagesForTarget(
  messages: DraftMessage[],
  target: string
): DraftMessage[] {
  if (target === "starter-map") {
    return messages.filter(
      (message) =>
        !message.target || message.target === "starter-map"
    );
  }
  return messages.filter((message) => message.target === target);
}

export function draftChatMessageLabel(
  message: DraftMessage
): string {
  if (message.status === "processing") return "Processing";
  if (message.status === "done") return "Done";
  if (message.status === "error") return "Error";
  return message.role === "user" ? "You" : "RoamAtlas";
}

export function scopedDraftMessage(
  message: DraftMessage,
  target: string
): DraftMessage {
  return { ...message, target };
}
