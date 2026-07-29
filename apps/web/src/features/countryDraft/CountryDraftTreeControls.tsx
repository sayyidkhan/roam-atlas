import type { DragEvent } from "react";

import { DraftTooltip } from "./CountryDraftMetadata";
import type { CountryDraftList } from "./countryDraftViewModel";

export function DraftSortHandle({
  index,
  label,
  list,
  onDragEnd,
  onDragStart
}: {
  index: number;
  label: string;
  list: CountryDraftList;
  onDragEnd: () => void;
  onDragStart: (
    event: DragEvent<HTMLButtonElement>,
    list: CountryDraftList,
    index: number
  ) => void;
}) {
  return (
    <button
      type="button"
      className="draft-sort-handle"
      draggable
      aria-label={`Drag to reorder ${label}`}
      title="Drag to reorder"
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(event, list, index)}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
        <path d="M5 3h1.5v1.5H5V3Zm4.5 0H11v1.5H9.5V3ZM5 7.25h1.5v1.5H5v-1.5Zm4.5 0H11v1.5H9.5v-1.5ZM5 11.5h1.5V13H5v-1.5Zm4.5 0H11V13H9.5v-1.5Z" />
      </svg>
    </button>
  );
}

export function DraftGenAiButton({
  isOpen,
  label,
  onToggle,
  target
}: {
  isOpen: boolean;
  label: string;
  onToggle: (target: string) => void;
  target: string;
}) {
  const tooltip =
    `Suggest edits for ${label}. Changes stay unconfirmed ` +
    "until source review.";
  return (
    <button
      type="button"
      className={`draft-genai-button${isOpen ? " is-active" : ""}`}
      aria-label={`Edit ${label} with GenAI`}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={() => onToggle(target)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z" />
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
      </svg>
      <span className="visually-hidden">
        Edit {label} with GenAI
      </span>
      <DraftTooltip copy={tooltip} title="GenAI edit" />
    </button>
  );
}

export function DraftDeleteButton({
  label,
  onDelete
}: {
  label: string;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      className="draft-delete-button"
      aria-label={`Delete ${label} from starter map`}
      title="Delete from starter map"
      onClick={onDelete}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
        <path d="M6.2 2h3.6l.6 1.2H13v1.3H3V3.2h2.6L6.2 2Zm-1.7 4h1.3l.3 7h3.8l.3-7h1.3l-.4 8.2H4.9L4.5 6Zm2.3.5H8v5.8H6.8V6.5Zm2.2 0h1.2v5.8H9V6.5Z" />
      </svg>
    </button>
  );
}

export function DraftItemCounter({
  indexPath
}: {
  indexPath: number[];
}) {
  return (
    <span className="draft-item-counter" aria-hidden="true">
      {indexPath.join(".")}
    </span>
  );
}
