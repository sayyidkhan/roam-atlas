export type JsonObject = Record<string, unknown>;

export function extractOpenAIText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (!Array.isArray(payload.output)) return "";

  for (const outputItem of payload.output) {
    if (
      !isRecord(outputItem) ||
      !Array.isArray(outputItem.content)
    ) {
      continue;
    }
    for (const contentItem of outputItem.content) {
      if (
        isRecord(contentItem) &&
        typeof contentItem.text === "string"
      ) {
        return contentItem.text;
      }
    }
  }
  return "";
}

export function parseJsonObject(
  text: unknown
): JsonObject | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const exact = tryParseJsonObject(unfenced);
  if (exact !== undefined) return exact;

  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return (
    tryParseJsonObject(
      unfenced.slice(start, end + 1)
    ) ?? null
  );
}

function tryParseJsonObject(
  text: string
): JsonObject | null | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return undefined;
  }
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
