import { describe, expect, it } from "vitest";

import type { RuntimePack } from "../../apps/web/src/app/browserRuntime";
import { buildExplorerBreadcrumbs } from "../../apps/web/src/features/explorer/explorerBreadcrumbPolicy";

const pack: RuntimePack = {
  countrySlug: "singapore",
  overviewSceneId: "singapore-overview",
  rootNodeId: "singapore",
  title: "Singapore",
  nodes: {
    singapore: {
      childIds: ["marina-bay"],
      id: "singapore",
      title: "Singapore"
    },
    "marina-bay": {
      childIds: ["merlion-park"],
      id: "marina-bay",
      parentId: "singapore",
      title: "Marina Bay and Civic District"
    },
    "merlion-park": {
      childIds: [],
      id: "merlion-park",
      parentId: "marina-bay",
      title: "Merlion Park"
    }
  },
  scenes: {}
};

describe("explorer breadcrumb policy", () => {
  it("derives ordered ancestors without duplicating the current title", () => {
    expect(
      buildExplorerBreadcrumbs({
        currentNodeId: "merlion-park",
        pack
      })
    ).toEqual([
      { label: "Singapore", nodeId: "singapore" },
      {
        label: "Marina Bay and Civic District",
        nodeId: "marina-bay"
      }
    ]);
  });

  it("handles roots and malformed parent cycles safely", () => {
    expect(
      buildExplorerBreadcrumbs({
        currentNodeId: "singapore",
        pack
      })
    ).toEqual([]);

    const cyclicPack: RuntimePack = {
      ...pack,
      nodes: {
        ...pack.nodes,
        "marina-bay": {
          ...pack.nodes["marina-bay"],
          parentId: "merlion-park"
        }
      }
    };
    expect(
      buildExplorerBreadcrumbs({
        currentNodeId: "merlion-park",
        pack: cyclicPack
      })
    ).toHaveLength(1);
  });
});
