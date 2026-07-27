export type DraftTreeNode = {
  children?: DraftTreeNode[];
  [key: string]: unknown;
};

export type CountryDraftTree = {
  regions?: DraftTreeNode[];
  [key: string]: unknown;
};

export function getDraftNodeAtPath(draft: CountryDraftTree | null | undefined, value: unknown) {
  const path = parseDraftPath(value);
  if (!path) return null;
  let node = draft?.regions?.[path[0] - 1] ?? null;
  for (const index of path.slice(1)) node = node?.children?.[index - 1] ?? null;
  return node;
}

export function removeDraftNodeAtPath(
  draft: CountryDraftTree | null | undefined,
  value: unknown
) {
  const path = parseDraftPath(value);
  if (!draft || !path) return null;

  const regions = removeNodeAtIndices(draft.regions ?? [], path);
  return regions ? { ...draft, regions } : null;
}

export function reorderArray<T>(items: T[], fromIndex: number, insertionIndex: number) {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    insertionIndex < 0 ||
    insertionIndex > items.length
  ) {
    return null;
  }
  const nextInsertionIndex = fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
  if (fromIndex === nextInsertionIndex) return null;
  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(nextInsertionIndex, 0, moved);
  return nextItems;
}

function parseDraftPath(value: unknown) {
  const path = String(value ?? "").split(".").map(Number);
  if (!path.length || path.some((index) => !Number.isInteger(index) || index < 1)) return null;
  return path;
}

function removeNodeAtIndices(nodes: DraftTreeNode[], path: number[]): DraftTreeNode[] | null {
  const [head, ...tail] = path;
  const nodeIndex = head - 1;
  if (nodeIndex < 0 || nodeIndex >= nodes.length) return null;

  if (tail.length === 0) {
    return nodes.filter((_, index) => index !== nodeIndex);
  }

  const node = nodes[nodeIndex];
  if (!Array.isArray(node.children)) return null;
  const children = removeNodeAtIndices(node.children, tail);
  if (!children) return null;
  return nodes.map((item, index) => index === nodeIndex ? { ...item, children } : item);
}
