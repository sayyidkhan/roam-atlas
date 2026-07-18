function normalizedNodeIds(candidates = []) {
  return candidates
    .map((candidate) => String(candidate?.nodeId ?? "").trim())
    .filter(Boolean);
}

export function boundsOverlap(first, second) {
  if (!first || !second) return false;
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function validateEnvironmentTargets({ targets = [], targetCandidates = [] } = {}) {
  const expectedNodeIds = normalizedNodeIds(targetCandidates);
  const expectedNodeIdSet = new Set(expectedNodeIds);
  const receivedNodeIds = targets.map((target) => String(target?.nodeId ?? "").trim());
  const receivedNodeIdSet = new Set(receivedNodeIds);

  if (expectedNodeIds.length === 0) {
    return {
      valid: targets.length === 0,
      reason: targets.length === 0 ? null : "This page has no curated child targets."
    };
  }

  if (targets.length !== expectedNodeIds.length) {
    return {
      valid: false,
      reason: `Expected ${expectedNodeIds.length} AI-located targets but received ${targets.length}.`
    };
  }

  if (receivedNodeIdSet.size !== receivedNodeIds.length) {
    return { valid: false, reason: "AI returned a duplicate destination target." };
  }

  if (receivedNodeIds.some((nodeId) => !expectedNodeIdSet.has(nodeId))) {
    return { valid: false, reason: "AI returned a destination outside the curated child list." };
  }

  if (expectedNodeIds.some((nodeId) => !receivedNodeIdSet.has(nodeId))) {
    return { valid: false, reason: "AI omitted one or more curated child targets." };
  }

  for (const target of targets) {
    if (!target?.visualBounds || !target?.labelBounds) {
      return { valid: false, reason: "AI returned a target without both required bounds." };
    }
  }

  for (let firstIndex = 0; firstIndex < targets.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < targets.length; secondIndex += 1) {
      const first = targets[firstIndex];
      const second = targets[secondIndex];
      if (boundsOverlap(first.visualBounds, second.visualBounds)) {
        return { valid: false, reason: "AI visual target regions overlap." };
      }
      if (boundsOverlap(first.labelBounds, second.labelBounds)) {
        return { valid: false, reason: "AI compact label target regions overlap." };
      }
    }
  }

  return { valid: true, reason: null };
}
