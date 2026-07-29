import { useState } from "react";

import type {
  CountryDraftCommands,
  CountryDraftSection
} from "./countryDraftViewModel";

type CountryDraftToolbarProps = {
  activeSection: CountryDraftSection;
  commands: CountryDraftCommands;
  isBusy: boolean;
  isGenAiOpen: boolean;
  onSelectSection: (section: CountryDraftSection) => void;
  onToggleGenAi: (target: string) => void;
  regionCount: number;
  themeCount: number;
};

export function CountryDraftToolbar({
  activeSection,
  commands,
  isBusy,
  isGenAiOpen,
  onSelectSection,
  onToggleGenAi,
  regionCount,
  themeCount
}: CountryDraftToolbarProps) {
  const [isToolMenuOpen, setToolMenuOpen] =
    useState(false);

  return (
    <div className="draft-section-toolbar">
      <DraftSectionTabs
        activeSection={activeSection}
        regionCount={regionCount}
        themeCount={themeCount}
        onSelect={onSelectSection}
      />
      <div
        className="draft-section-actions"
        aria-label="Starter map tools"
      >
        <DraftToolMenu
          disabled={isBusy}
          isOpen={isToolMenuOpen}
          onRebuildMetadata={commands.rebuildMetadata}
          onResetReferencePhotos={commands.resetReferencePhotos}
          onToggle={() =>
            setToolMenuOpen((isOpen) => !isOpen)
          }
          onClose={() => setToolMenuOpen(false)}
        />
        <GenAiButton
          isOpen={isGenAiOpen}
          onClick={() => onToggleGenAi("starter-map")}
        />
      </div>
    </div>
  );
}

function DraftSectionTabs({
  activeSection,
  onSelect,
  regionCount,
  themeCount
}: {
  activeSection: CountryDraftSection;
  onSelect: (section: CountryDraftSection) => void;
  regionCount: number;
  themeCount: number;
}) {
  return (
    <div className="draft-section-tabs">
      <div
        className="draft-section-tab-group"
        role="tablist"
        aria-label="Candidate regions and research themes"
      >
        <DraftSectionTab
          active={activeSection === "regions"}
          label={`Candidate regions (${regionCount})`}
          onClick={() => onSelect("regions")}
        />
        <DraftSectionTab
          active={activeSection === "themes"}
          label={`Research themes (${themeCount})`}
          onClick={() => onSelect("themes")}
        />
      </div>
    </div>
  );
}

function DraftSectionTab({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      className={active ? "is-active" : undefined}
      aria-selected={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function DraftToolMenu({
  disabled,
  isOpen,
  onClose,
  onRebuildMetadata,
  onResetReferencePhotos,
  onToggle
}: {
  disabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRebuildMetadata: () => void;
  onResetReferencePhotos: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="draft-reset-menu">
      <button
        type="button"
        className={`draft-tool-menu-button${isOpen ? " is-active" : ""}`}
        aria-label="Open starter-map actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="draft-tool-menu-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {isOpen ? (
        <div
          className="draft-tool-menu"
          role="menu"
          aria-label="Starter-map actions"
        >
          <DraftToolMenuItem
            disabled={disabled}
            label="Rebuild starter info"
            description="Refresh regions, summary, and themes."
            onClick={() => {
              onClose();
              onRebuildMetadata();
            }}
          />
          <DraftToolMenuItem
            disabled={disabled}
            label="Reset photos"
            description="Clear cached thumbnails and search again."
            onClick={() => {
              onClose();
              onResetReferencePhotos();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function DraftToolMenuItem({
  description,
  disabled,
  label,
  onClick
}: {
  description: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="draft-tool-menu-item"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      <ResetIcon />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function GenAiButton({
  isOpen,
  onClick
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  const tooltip =
    "Suggest starter-map edits without changing verified facts. Changes stay unconfirmed until source review.";
  return (
    <button
      type="button"
      className={`draft-genai-button${isOpen ? " is-active" : ""}`}
      data-genai-target="starter-map"
      data-tooltip-title="GenAI edit"
      data-tooltip={tooltip}
      aria-label="Edit starter map with GenAI"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={onClick}
    >
      <GenAiIcon />
      <span className="visually-hidden">
        Edit starter map with GenAI
      </span>
      <span className="draft-button-tooltip" role="tooltip">
        <span className="draft-button-tooltip-title">
          GenAI edit
        </span>
        <span className="draft-button-tooltip-copy">
          {tooltip}
        </span>
      </span>
    </button>
  );
}

function GenAiIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 4v6h6" />
      <path d="M5.7 14a7 7 0 1 0 .7-6.7L4 10" />
    </svg>
  );
}
