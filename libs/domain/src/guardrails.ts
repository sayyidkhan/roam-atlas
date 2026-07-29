export type FactConfidence =
  | "confirmed"
  | "likely"
  | "general"
  | "unconfirmed";

type FactRecord = {
  confidence?: unknown;
  id?: unknown;
  sourceType?: unknown;
};

const GENERATED_SOURCE_TYPES = new Set(["ai_generated"]);

export function assertGeneratedImagesAreNotFactSources(
  nodes: Record<string, unknown>
): void {
  for (const node of Object.values(nodes)) {
    if (!isRecord(node)) continue;
    const facts = Array.isArray(node.facts) ? node.facts : [];
    for (const fact of facts) {
      if (
        isFactRecord(fact) &&
        typeof fact.sourceType === "string" &&
        GENERATED_SOURCE_TYPES.has(fact.sourceType)
      ) {
        throw new Error(
          `Generated images cannot be fact sources: ${String(node.id)}/${String(fact.id)}`
        );
      }
    }
  }
}

export function factConfidenceLabel(
  confidence: unknown
): string {
  const labels: Record<FactConfidence, string> = {
    confirmed: "Confirmed",
    likely: "Likely",
    general: "General",
    unconfirmed: "Unconfirmed"
  };

  return isFactConfidence(confidence)
    ? labels[confidence]
    : "Unconfirmed";
}

export function hasUnconfirmedNodeFacts(
  node: unknown
): boolean {
  if (!isRecord(node) || !Array.isArray(node.facts)) {
    return false;
  }
  return node.facts.some(
    (fact) =>
      isFactRecord(fact) &&
      (fact.confidence === "unconfirmed" ||
        fact.sourceType === "ai_generated")
  );
}

export function isTravelSensitiveFact(text: string): boolean {
  return /\b(opening|ticket|price|closed|closure|live|currently|today|transport time)\b/i.test(
    text
  );
}

function isFactConfidence(
  value: unknown
): value is FactConfidence {
  return (
    value === "confirmed" ||
    value === "likely" ||
    value === "general" ||
    value === "unconfirmed"
  );
}

function isFactRecord(value: unknown): value is FactRecord {
  return isRecord(value);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
