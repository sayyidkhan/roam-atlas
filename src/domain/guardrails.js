const GENERATED_SOURCE_TYPES = new Set(["ai_generated"]);

export function assertGeneratedImagesAreNotFactSources(nodes) {
  for (const node of Object.values(nodes)) {
    for (const fact of node.facts ?? []) {
      if (GENERATED_SOURCE_TYPES.has(fact.sourceType)) {
        throw new Error(
          `Generated images cannot be fact sources: ${node.id}/${fact.id}`
        );
      }
    }
  }
}

export function factConfidenceLabel(confidence) {
  const labels = {
    confirmed: "Confirmed",
    likely: "Likely",
    general: "General",
    unconfirmed: "Unconfirmed"
  };

  return labels[confidence] ?? "Unconfirmed";
}

export function isTravelSensitiveFact(text) {
  return /\b(opening|ticket|price|closed|closure|live|currently|today|transport time)\b/i.test(
    text
  );
}
