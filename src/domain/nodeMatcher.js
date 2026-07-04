export function matchClickPhraseToNode({ phrase, candidates, nodes }) {
  const normalizedPhrase = normalize(phrase);
  const scored = candidates
    .map((candidate) => {
      const node = nodes[candidate.nodeId];
      if (!node) return null;
      const haystack = normalize(
        [node.id, node.title, ...(node.tags ?? []), candidate.label ?? ""].join(" ")
      );
      return {
        candidate,
        node,
        score: scoreMatch(normalizedPhrase, haystack)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 1) {
    return {
      status: "unmapped",
      nodeId: null,
      confidence: "unconfirmed",
      reason: "The VLM phrase did not match a curated RoamAtlas node."
    };
  }

  return {
    status: "matched",
    nodeId: best.node.id,
    confidence: best.candidate.confidence,
    action: best.candidate.action,
    reason: `Matched VLM phrase "${phrase}" to curated node ${best.node.id}.`
  };
}

function scoreMatch(needle, haystack) {
  const tokens = needle
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

const STOPWORDS = new Set([
  "and",
  "the",
  "with",
  "near",
  "into",
  "from"
]);

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
