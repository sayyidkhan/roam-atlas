import { CountryDraftMetadata } from "./CountryDraftMetadata";
import { CountryDraftReferencePhoto } from "./CountryDraftReferencePhoto";
import { CountryDraftChildNodes } from "./CountryDraftChildNodes";
import {
  DraftDeleteButton,
  DraftGenAiButton,
  DraftItemCounter,
  DraftSortHandle
} from "./CountryDraftTreeControls";
import {
  areDraftDescendantsApproved,
  draftDropClass,
  safeExternalSourceUrl
} from "./countryDraftTreePolicy";
import type { DraftNode } from "./countryDraftTypes";
import type { CountryDraftCommands } from "./countryDraftViewModel";
import type { CountryDraftDragBindings } from "./useCountryDraftDrag";

export type BuildDraftPhotoUrl = (
  placeName: string,
  context: string,
  kind: string
) => string;

export function CountryDraftRegionItem({
  buildPhotoUrl,
  commands,
  drag,
  index,
  onToggleGenAi,
  openGenAiTarget,
  region
}: {
  buildPhotoUrl: BuildDraftPhotoUrl;
  commands: CountryDraftCommands;
  drag: CountryDraftDragBindings;
  index: number;
  onToggleGenAi: (target: string) => void;
  openGenAiTarget: string | null;
  region: DraftNode;
}) {
  const name = String(region.name ?? "Unnamed region");
  const kind = String(region.kind ?? "region");
  const target = `region:${name}`;
  const sourceUrl = safeExternalSourceUrl(region.sourceUrl);
  const allDescendantsApproved =
    areDraftDescendantsApproved(region);

  return (
    <li
      className={draftDropClass(
        drag.dropTarget,
        "regions",
        index
      )}
      onDragOver={(event) =>
        drag.updateDropTarget(event, "regions", index)
      }
      onDrop={(event) =>
        drag.finishDrop(event, "regions", index)
      }
    >
      <div className="draft-item-heading">
        <DraftSortHandle
          index={index}
          label={name}
          list="regions"
          onDragEnd={drag.clearDrag}
          onDragStart={drag.startDrag}
        />
        <CountryDraftReferencePhoto
          buildUrl={buildPhotoUrl}
          children={region.children}
          kind={kind}
          onOpen={commands.openReferencePhoto}
          placeName={name}
        />
        <DraftItemCounter indexPath={[index + 1]} />
        <strong>{name}</strong>
        <CountryDraftMetadata
          approveTarget={target}
          item={region}
          kind={kind}
          onApprovalChange={commands.approveItem}
        />
        {region.children?.length ? (
          <button
            type="button"
            className="draft-descendant-approval"
            aria-pressed={allDescendantsApproved}
            aria-label={
              allDescendantsApproved
                ? "Return all nested nodes to needs review"
                : "Mark all nested nodes as curated"
            }
            title={
              allDescendantsApproved
                ? "Return all nested nodes to needs review"
                : "Mark all nested nodes as curated"
            }
            onClick={() =>
              commands.approveItem(
                target,
                !allDescendantsApproved,
                true
              )
            }
          >
            {allDescendantsApproved ? "Clear all" : "Curate all"}
          </button>
        ) : null}
        <DraftGenAiButton
          isOpen={openGenAiTarget === target}
          label={name}
          onToggle={onToggleGenAi}
          target={target}
        />
        <DraftDeleteButton
          label={name}
          onDelete={() =>
            commands.deleteItem({
              list: "regions",
              index,
              label: name
            })
          }
        />
      </div>
      <ul className="draft-item-nested">
        <li>{region.why}</li>
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
      <CountryDraftChildNodes
        children={region.children}
        commands={commands}
        parentIndexPath={[index + 1]}
      />
    </li>
  );
}
