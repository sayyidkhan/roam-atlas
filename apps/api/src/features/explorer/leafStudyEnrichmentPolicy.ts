export type LeafStudyCuratedTopic = {
  id: string;
  text: string;
};

export type LeafStudyEnrichedNote = {
  id: string;
  text: string;
};

const FORBIDDEN_CLAIM =
  /(?:[$€£]|rm\s?\d|\b\d{1,2}:\d{2}\b|\b\d+(?:\.\d+)?\s?(?:km|minutes?|hours?)\b|\b(?:opening hours|ticket|tickets|price|priced|admission|closure|closed)\b|\bguaranteed\b|\bcurrently on display\b)/i;

/**
 * Keeps model notes that match a requested topic and do not add a
 * travel claim the curated fact did not authorize.
 */
export function normalizeLeafStudyNotes(
  topics: readonly LeafStudyCuratedTopic[],
  value: unknown
): LeafStudyEnrichedNote[] {
  const curated = new Map(
    topics.map((topic) => [topic.id, topic.text.toLowerCase()])
  );
  const notes = readNotes(value);
  const used = new Set<string>();
  const accepted: LeafStudyEnrichedNote[] = [];

  for (const note of notes) {
    const id = readText(note.id);
    const text = readText(note.text);
    if (!curated.has(id) || used.has(id)) continue;
    if (text.length < 40 || text.length > 320) continue;
    if (text.toLowerCase() === curated.get(id)) continue;
    if (FORBIDDEN_CLAIM.test(text)) continue;
    used.add(id);
    accepted.push({ id, text });
  }

  return accepted;
}

function readNotes(value: unknown): Array<Record<string, unknown>> {
  const record = isRecord(value) ? value : null;
  const notes = Array.isArray(value)
    ? value
    : record && Array.isArray(record.notes)
      ? record.notes
      : [];
  return notes.filter(isRecord);
}

function readText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
