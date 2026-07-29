import {
  CountryDraftMetadata,
  isDraftItemApproved
} from "./CountryDraftMetadata";
import {
  DraftDeleteButton,
  DraftItemCounter
} from "./CountryDraftTreeControls";
import type { DraftNode } from "./countryDraftTypes";
import type { CountryDraftCommands } from "./countryDraftViewModel";

export function CountryDraftChildNodes({
  children,
  commands,
  parentIndexPath
}: {
  children?: DraftNode[];
  commands: CountryDraftCommands;
  parentIndexPath: number[];
}) {
  if (!children?.length) return null;
  return (
    <ul className="draft-child-list">
      {children.map((child, index) => {
        const indexPath = [...parentIndexPath, index + 1];
        const path = indexPath.join(".");
        const name = String(child.name ?? "Unnamed candidate");
        return (
          <li className="draft-child-item" key={`${path}:${name}`}>
            <div className="draft-item-heading">
              <DraftItemCounter indexPath={indexPath} />
              <strong>{name}</strong>
              <CountryDraftMetadata
                approveTarget={`node:${path}`}
                item={child}
                kind={String(child.kind ?? "area")}
                onApprovalChange={commands.approveItem}
              />
              {!isDraftItemApproved(child) ? (
                <button
                  type="button"
                  className="draft-candidate-edit-button"
                  aria-label={`Edit unconfirmed candidate ${name}`}
                  title="Edit unconfirmed candidate"
                  onClick={() => commands.editCandidate(path)}
                >
                  Edit
                </button>
              ) : null}
              <DraftDeleteButton
                label={name}
                onDelete={() =>
                  commands.deleteItem({
                    list: "node",
                    path,
                    label: name
                  })
                }
              />
            </div>
            <CountryDraftChildNodes
              children={child.children}
              commands={commands}
              parentIndexPath={indexPath}
            />
          </li>
        );
      })}
    </ul>
  );
}
