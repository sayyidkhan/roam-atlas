export type LeafStudyFact = {
  confidence?: unknown;
  id?: unknown;
  label?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  text?: unknown;
};

export type LeafStudyNode = {
  childIds?: readonly unknown[] | null;
  facts?: readonly LeafStudyFact[] | null;
  id?: unknown;
  parentId?: unknown;
  tags?: readonly unknown[] | null;
  title?: unknown;
};

export type LeafStudyTopic = {
  confidence: string;
  id: string;
  label: string;
  sourceType: string | null;
  sourceUrl: string | null;
  text: string;
};

/**
 * Interactive topics for a page that has no child places.
 * Each topic keeps its own curated fact. A single sentence is not split
 * into sections that would all repeat that sentence.
 */
export function createLeafStudyTopics(
  node: unknown
): LeafStudyTopic[] {
  if (!isStudyNode(node) || hasChildren(node.childIds)) return [];
  const facts = uniqueFacts(readFacts(node.facts));
  if (!facts.length) return [];

  return facts.slice(0, 6).map((fact, index) =>
    createTopic(fact, labelFor(fact, node, facts.length), index)
  );
}

function isStudyNode(value: unknown): value is LeafStudyNode {
  return Boolean(value) && typeof value === "object";
}

function hasChildren(childIds: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(childIds) && childIds.length > 0;
}

function readFacts(value: readonly LeafStudyFact[] | null | undefined): LeafStudyFact[] {
  if (!Array.isArray(value)) return [];
  return value.filter((fact) => readText(fact.text).length > 0);
}

function uniqueFacts(facts: LeafStudyFact[]): LeafStudyFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = readText(fact.text).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function labelFor(
  fact: LeafStudyFact,
  node: LeafStudyNode,
  factCount: number
): string {
  const explicit = normalizeLabel(readText(fact.label));
  if (explicit.length >= 3 && explicit.length <= 42) return explicit;
  if (factCount === 1) return readTitle(node.title) || "This place";
  const words = readText(fact.text).split(/\s+/).slice(0, 4).join(" ");
  return words.length > 42 ? `${words.slice(0, 41).trim()}...` : words;
}

function createTopic(
  fact: LeafStudyFact,
  label: string,
  index: number
): LeafStudyTopic {
  const text = readText(fact.text);
  return {
    id: readText(fact.id) || `fact-${index + 1}`,
    label,
    text,
    confidence: readText(fact.confidence) || "unconfirmed",
    sourceType: readText(fact.sourceType) || null,
    sourceUrl: readHttpsUrl(fact.sourceUrl)
  };
}

function normalizeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function readTitle(value: unknown): string {
  return readText(value);
}

function readText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function readHttpsUrl(value: unknown): string | null {
  const url = readText(value);
  return /^https:\/\/\S+$/i.test(url) ? url : null;
}
