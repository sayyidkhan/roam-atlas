export function extractOpenAIText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  const content = payload?.output?.flatMap((item) => item.content ?? []) ?? [];
  const textItem = content.find((item) => typeof item.text === "string");
  return textItem?.text ?? "";
}

export function parseJsonObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
