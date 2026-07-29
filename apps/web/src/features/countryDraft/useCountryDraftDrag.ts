import {
  type DragEvent,
  useRef,
  useState
} from "react";

import type {
  CountryDraftCommands,
  CountryDraftList
} from "./countryDraftViewModel";

type DraftDragPayload = {
  countrySlug: string;
  fromIndex: number;
  list: CountryDraftList;
};

export type DraftDropTarget = {
  index: number;
  insertAfter: boolean;
  list: CountryDraftList;
};

export type CountryDraftDragBindings = {
  clearDrag: () => void;
  dropTarget: DraftDropTarget | null;
  finishDrop: (
    event: DragEvent<HTMLLIElement>,
    list: CountryDraftList,
    targetIndex: number
  ) => void;
  startDrag: (
    event: DragEvent<HTMLButtonElement>,
    list: CountryDraftList,
    fromIndex: number
  ) => void;
  updateDropTarget: (
    event: DragEvent<HTMLLIElement>,
    list: CountryDraftList,
    index: number
  ) => void;
};

export function useCountryDraftDrag(
  countrySlug: string,
  reorderItems: CountryDraftCommands["reorderItems"]
): CountryDraftDragBindings {
  const dragRef = useRef<DraftDragPayload | null>(null);
  const [dropTarget, setDropTarget] =
    useState<DraftDropTarget | null>(null);

  function startDrag(
    event: DragEvent<HTMLButtonElement>,
    list: CountryDraftList,
    fromIndex: number
  ) {
    const payload = { countrySlug, list, fromIndex };
    dragRef.current = payload;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify(payload)
    );
  }

  function updateDropTarget(
    event: DragEvent<HTMLLIElement>,
    list: CountryDraftList,
    index: number
  ) {
    if (dragRef.current?.list !== list) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({
      list,
      index,
      insertAfter:
        event.clientY > bounds.top + bounds.height / 2
    });
  }

  function finishDrop(
    event: DragEvent<HTMLLIElement>,
    list: CountryDraftList,
    targetIndex: number
  ) {
    const payload = dragRef.current;
    if (
      !payload ||
      payload.countrySlug !== countrySlug ||
      payload.list !== list
    ) {
      return;
    }
    event.preventDefault();
    reorderItems({
      list,
      fromIndex: payload.fromIndex,
      targetIndex,
      insertAfter: Boolean(
        dropTarget?.list === list &&
          dropTarget.index === targetIndex &&
          dropTarget.insertAfter
      )
    });
    clearDrag();
  }

  function clearDrag() {
    dragRef.current = null;
    setDropTarget(null);
  }

  return {
    clearDrag,
    dropTarget,
    finishDrop,
    startDrag,
    updateDropTarget
  };
}
