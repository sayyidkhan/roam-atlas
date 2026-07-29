import { CountryDraftMetadata } from "./CountryDraftMetadata";
import {
  DraftDeleteButton,
  DraftGenAiButton,
  DraftItemCounter,
  DraftSortHandle
} from "./CountryDraftTreeControls";
import {
  draftDropClass,
  safeExternalSourceUrl
} from "./countryDraftTreePolicy";
import type {
  DraftNode,
  DraftTheme
} from "./countryDraftTypes";
import type { CountryDraftCommands } from "./countryDraftViewModel";
import type { CountryDraftDragBindings } from "./useCountryDraftDrag";

export function CountryDraftThemeItem({
  commands,
  drag,
  index,
  onToggleGenAi,
  openGenAiTarget,
  theme
}: {
  commands: CountryDraftCommands;
  drag: CountryDraftDragBindings;
  index: number;
  onToggleGenAi: (target: string) => void;
  openGenAiTarget: string | null;
  theme: DraftTheme;
}) {
  const label = String(theme.label ?? "Unnamed theme");
  const target = `theme:${label}`;
  const sourceUrl = safeExternalSourceUrl(theme.sourceUrl);
  const item: DraftNode = {
    confidence: theme.confidence,
    label
  };

  return (
    <li
      className={draftDropClass(
        drag.dropTarget,
        "themes",
        index
      )}
      onDragOver={(event) =>
        drag.updateDropTarget(event, "themes", index)
      }
      onDrop={(event) =>
        drag.finishDrop(event, "themes", index)
      }
    >
      <div className="draft-item-heading">
        <DraftSortHandle
          index={index}
          label={label}
          list="themes"
          onDragEnd={drag.clearDrag}
          onDragStart={drag.startDrag}
        />
        <DraftItemCounter indexPath={[index + 1]} />
        <strong>{label}</strong>
        <CountryDraftMetadata
          approveTarget={target}
          item={item}
          kind="theme"
          onApprovalChange={commands.approveItem}
        />
        <DraftGenAiButton
          isOpen={openGenAiTarget === target}
          label={label}
          onToggle={onToggleGenAi}
          target={target}
        />
        <DraftDeleteButton
          label={label}
          onDelete={() =>
            commands.deleteItem({
              list: "themes",
              index,
              label
            })
          }
        />
      </div>
      <ul className="draft-item-nested">
        <li>{theme.note}</li>
        {sourceUrl ? (
          <li>
            Source:{" "}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sourceUrl}
            </a>
          </li>
        ) : null}
      </ul>
    </li>
  );
}
