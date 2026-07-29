import type { DraftNode } from "./countryDraftTypes";
import { isDraftItemApproved } from "./CountryDraftMetadata";
import type { CountryDraftList } from "./countryDraftViewModel";
import type { DraftDropTarget } from "./useCountryDraftDrag";

export function areDraftDescendantsApproved(
  item: DraftNode
): boolean {
  const children = item.children ?? [];
  return (
    children.length > 0 &&
    children.every(
      (child) =>
        isDraftItemApproved(child) &&
        isChildTreeApproved(child)
    )
  );
}

function isChildTreeApproved(item: DraftNode): boolean {
  return (item.children ?? []).every(
    (child) =>
      isDraftItemApproved(child) &&
      isChildTreeApproved(child)
  );
}

export function draftDropClass(
  dropTarget: DraftDropTarget | null,
  list: CountryDraftList,
  index: number
): string {
  const classes = ["draft-item"];
  if (dropTarget?.list === list && dropTarget.index === index) {
    classes.push(
      dropTarget.insertAfter
        ? "is-drop-after"
        : "is-drop-before"
    );
  }
  return classes.join(" ");
}

export function safeExternalSourceUrl(
  value: unknown
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
