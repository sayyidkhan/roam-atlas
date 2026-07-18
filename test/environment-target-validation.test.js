import assert from "node:assert/strict";
import test from "node:test";
import {
  boundsOverlap,
  validateEnvironmentTargets
} from "../src/domain/environmentTargetValidation.js";

const candidates = [{ nodeId: "marina" }, { nodeId: "heritage" }];

function target(nodeId, x, y) {
  return {
    nodeId,
    visualBounds: { x, y, width: 0.2, height: 0.2 },
    labelBounds: { x, y, width: 0.1, height: 0.08 }
  };
}

test("environment target plans require exactly one AI region per curated child", () => {
  const valid = validateEnvironmentTargets({
    targetCandidates: candidates,
    targets: [target("marina", 0.05, 0.1), target("heritage", 0.65, 0.7)]
  });
  const partial = validateEnvironmentTargets({
    targetCandidates: candidates,
    targets: [target("marina", 0.05, 0.1)]
  });
  const duplicate = validateEnvironmentTargets({
    targetCandidates: candidates,
    targets: [target("marina", 0.05, 0.1), target("marina", 0.65, 0.7)]
  });

  assert.equal(valid.valid, true);
  assert.equal(partial.valid, false);
  assert.match(partial.reason, /Expected 2/);
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.reason, /duplicate/i);
});

test("environment target plans reject overlapping visual or compact label targets", () => {
  const visualOverlap = validateEnvironmentTargets({
    targetCandidates: candidates,
    targets: [target("marina", 0.05, 0.1), target("heritage", 0.2, 0.1)]
  });
  const labelOverlap = validateEnvironmentTargets({
    targetCandidates: candidates,
    targets: [
      target("marina", 0.05, 0.1),
      {
        ...target("heritage", 0.65, 0.7),
        labelBounds: { x: 0.1, y: 0.12, width: 0.1, height: 0.08 }
      }
    ]
  });

  assert.equal(visualOverlap.valid, false);
  assert.match(visualOverlap.reason, /visual.*overlap/i);
  assert.equal(labelOverlap.valid, false);
  assert.match(labelOverlap.reason, /label.*overlap/i);
  assert.equal(boundsOverlap(target("marina", 0, 0).visualBounds, target("heritage", 0.2, 0).visualBounds), false);
});
