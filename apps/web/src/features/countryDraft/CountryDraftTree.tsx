import { CountryDraftRegionItem } from "./CountryDraftRegionItem";
import { CountryDraftThemeItem } from "./CountryDraftThemeItem";
import type {
  CountryDraft,
  DraftNode,
  DraftTheme
} from "./countryDraftTypes";
import type {
  CountryDraftCommands,
  CountryDraftSection
} from "./countryDraftViewModel";
import { useCountryDraftDrag } from "./useCountryDraftDrag";

type CountryDraftTreeProps = {
  activeSection: CountryDraftSection;
  buildPhotoUrl: (
    placeName: string,
    context: string,
    kind: string
  ) => string;
  commands: CountryDraftCommands;
  countrySlug: string;
  draft: CountryDraft;
  onToggleGenAi: (target: string) => void;
  openGenAiTarget: string | null;
};

/**
 * Composition boundary for the active country-draft list.
 *
 * Row presentation, recursive child curation, shared controls, drag state, and
 * stateless review policy each have separate feature owners.
 */
export function CountryDraftTree({
  activeSection,
  buildPhotoUrl,
  commands,
  countrySlug,
  draft,
  onToggleGenAi,
  openGenAiTarget
}: CountryDraftTreeProps) {
  const items =
    activeSection === "themes"
      ? draft.themes ?? []
      : draft.regions ?? [];
  const drag = useCountryDraftDrag(
    countrySlug,
    commands.reorderItems
  );

  return (
    <ul className="draft-tree">
      <li className="draft-tree-root">
        <div className="draft-tree-root-header">
          <div>
            <strong>{draft.countryName}</strong>
            <span className="muted">
              {items.length} parent node
              {items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <ul className="draft-list">
          {items.length === 0 ? (
            <li className="muted">
              No candidate {activeSection} were returned.
            </li>
          ) : activeSection === "themes" ? (
            (items as DraftTheme[]).map((theme, index) => (
              <CountryDraftThemeItem
                commands={commands}
                drag={drag}
                index={index}
                key={`${theme.label}:${index}`}
                onToggleGenAi={onToggleGenAi}
                openGenAiTarget={openGenAiTarget}
                theme={theme}
              />
            ))
          ) : (
            (items as DraftNode[]).map((region, index) => (
              <CountryDraftRegionItem
                buildPhotoUrl={buildPhotoUrl}
                commands={commands}
                drag={drag}
                index={index}
                key={`${region.name}:${index}`}
                onToggleGenAi={onToggleGenAi}
                openGenAiTarget={openGenAiTarget}
                region={region}
              />
            ))
          )}
        </ul>
      </li>
    </ul>
  );
}
