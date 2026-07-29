export type DraftMessage = {
  hidden?: boolean;
  role?: string;
  status?: string;
  target?: string;
  text?: string;
  [key: string]: unknown;
};

export function scopeInstructionToCandidate(
  target: string,
  instruction: string
): string {
  const separatorIndex = target.indexOf(":");
  const kind =
    target.slice(0, separatorIndex) === "theme"
      ? "research theme"
      : "candidate region";
  const name = target.slice(separatorIndex + 1);
  return `Only change the ${kind} "${name}". Keep every other candidate unchanged. ${instruction}`;
}

export function replaceLatestProcessingMessage<T extends DraftMessage>(
  messages: readonly T[] | null | undefined,
  replacement: T,
  target: string
): T[] {
  const nextMessages = [...(messages ?? [])];
  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    const message = nextMessages[index];
    if (
      message.role === "assistant" &&
      message.status === "processing" &&
      message.target === target
    ) {
      nextMessages[index] = replacement;
      return nextMessages;
    }
  }
  return [...nextMessages, replacement];
}

export function appendPlaceImageHistoryRequest(
  imageUrl: string,
  entryId: string,
  requestSession: string
): string {
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}history=${encodeURIComponent(entryId)}&view=${requestSession}`;
}
