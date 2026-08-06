import type { RuntimePack } from "../../app/browserRuntime";

export type ExplorerBreadcrumbItem = {
  label: string;
  nodeId: string;
};

export function buildExplorerBreadcrumbs({
  currentNodeId,
  pack
}: {
  currentNodeId: string | null | undefined;
  pack: RuntimePack | null;
}): ExplorerBreadcrumbItem[] {
  if (!currentNodeId || !pack?.nodes[currentNodeId]) return [];

  const lineage: ExplorerBreadcrumbItem[] = [];
  const visited = new Set<string>();
  let nodeId: string | null | undefined = currentNodeId;

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node: RuntimePack["nodes"][string] | undefined =
      pack.nodes[nodeId];
    if (!node) break;
    lineage.push({
      label: node.title ?? nodeId,
      nodeId
    });
    nodeId = node.parentId;
  }

  return lineage.reverse().slice(0, -1);
}
