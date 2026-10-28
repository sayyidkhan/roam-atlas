import { useId, useState, type ReactNode } from "react";

import { CountryDraftToolbar } from "./CountryDraftToolbar";
import { CountryDraftReview } from "./CountryDraftReview";
import { CountryDraftEditDialog } from "./CountryDraftEditDialog";
import { CountryDraftTree } from "./CountryDraftTree";
import { DraftReferencePhotoRegistry } from "./draftReferencePhotoRegistry";
import { useCountryDraftEditTarget } from "./useCountryDraftEditTarget";
import styles from "./CountryDraftSurface.module.css";
import type {
  CountryDraftCommands,
  CountryDraftRenderState,
  CountryDraftSection
} from "./countryDraftViewModel";

type CountryDraftSurfaceProps = {
  buildPhotoUrl: (
    placeName: string,
    context: string,
    kind: string
  ) => string;
  commands: CountryDraftCommands;
  countryName: string;
  countrySlug: string;
  draft: CountryDraftRenderState;
  isSourceControlled: boolean;
  compact?: boolean;
  renderHeader?: (review: ReactNode) => ReactNode;
};

/**
 * React-owned country draft state and ready-layout boundary.
 *
 * The complete country-draft surface is React-owned. Its parent subscribes to
 * the feature store; imperative workflows only publish typed draft snapshots.
 * Reference-photo loading is component-local.
 */
export function CountryDraftSurface({
  buildPhotoUrl,
  commands,
  countryName,
  countrySlug,
  draft,
  isSourceControlled,
  compact = false,
  renderHeader
}: CountryDraftSurfaceProps) {
  const [activeSection, setActiveSection] =
    useState<CountryDraftSection>("regions");
  const tabsId = useId();
  const editTarget = useCountryDraftEditTarget(
    draft.status === "ready" ? draft.draft : null
  );

  if (draft.status === "empty") {
    return (
      <section
        className="country-draft country-draft--empty"
        aria-label="AI starter map"
      >
        {renderHeader?.(null)}
        <p className="eyebrow">
          {isSourceControlled ? "Country map" : "Starter map"}
        </p>
        <h2>No {countryName} map data loaded</h2>
        <p>
          {isSourceControlled
            ? `Build ${countryName} map from its original source-controlled country pack.`
            : `Build an unconfirmed outline for ${countryName}. It will not be treated as a verified country pack.`}
        </p>
      </section>
    );
  }

  if (draft.status === "loading") {
    return (
      <section className="country-draft" aria-label="AI starter map">
        {renderHeader?.(null)}
        <section className="country-draft-loading" aria-live="polite">
          <p className="eyebrow">Resetting metadata</p>
          <h2>Clearing starter map info</h2>
          <p>
            Rebuilding candidate regions, summary, and research
            themes.
          </p>
        </section>
      </section>
    );
  }

  if (draft.status === "failed") {
    return (
      <section
        className="country-draft country-draft--failed"
        aria-label="AI starter map"
      >
        {renderHeader?.(null)}
        <p className="eyebrow">Starter map failed</p>
        <h2>Could not build a starter map</h2>
        <p>{draft.error}</p>
      </section>
    );
  }

  const isReviewedSnapshot =
    compact && isSourceControlled &&
    draft.draft.mode === "curated_pack_snapshot" &&
    draft.draft.confidence === "confirmed";
  const review = (
    <CountryDraftReview
      collapseChecklist={compact && isSourceControlled}
      confirmation={draft.review.confirmation}
      confirmationError={draft.review.error}
      countryName={countryName}
      draft={draft.draft}
      isConfirming={draft.review.isConfirming}
      isSourceControlled={isSourceControlled}
      onConfirm={commands.confirmForCuration}
    />
  );
  const reviewInHeader = Boolean(renderHeader && isReviewedSnapshot);

  return (
    <section
      className={`country-draft${compact ? ` ${styles.surface}` : ""}`}
      aria-label="AI starter map"
    >
      {renderHeader ? renderHeader(reviewInHeader ? review : null) : (
        <div className={`country-draft-header${compact ? ` ${styles.header}` : ""}`}>
          <h2>{compact && isSourceControlled ? "Inside the atlas" : "AI starter map"}</h2>
        </div>
      )}
      {!isReviewedSnapshot ? <p className={compact ? styles.summary : undefined}>{draft.draft.summary}</p> : null}
      {draft.draft.unavailableReason ? (
        <p className="muted">{draft.draft.unavailableReason}</p>
      ) : null}
      {!reviewInHeader ? review : null}
      <CountryDraftToolbar
        activeSection={activeSection}
        commands={commands}
        isBusy={draft.isBusy}
        isGenAiOpen={editTarget.target === "starter-map"}
        onSelectSection={setActiveSection}
        onToggleGenAi={editTarget.toggle}
        regionCount={draft.draft.regions?.length ?? 0}
        themeCount={draft.draft.themes?.length ?? 0}
        tabsId={tabsId}
      />
      <CountryDraftEditDialog
        draft={draft.draft}
        isSending={draft.editor.isSending}
        messages={draft.editor.messages}
        onClose={editTarget.close}
        onSubmit={commands.submitGenAi}
        target={editTarget.target}
      />
      <section
        className="draft-section-panel"
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${activeSection}`}
        tabIndex={0}
      >
        <p className="draft-section-intro">
          {activeSection === "themes"
            ? "Research themes group regions by travel style or category. They describe patterns across places, not separate destinations."
            : isReviewedSnapshot
              ? "Review, reorder, and manage the places in each chapter."
              : "Candidate regions are possible map chapters for this country. Review, approve, and add sources before using them as verified travel facts."}
        </p>
        <DraftReferencePhotoRegistry>
          <CountryDraftTree
            activeSection={activeSection}
            buildPhotoUrl={buildPhotoUrl}
            commands={commands}
            countrySlug={countrySlug}
            draft={draft.draft}
            onToggleGenAi={editTarget.toggle}
            openGenAiTarget={editTarget.target}
          />
        </DraftReferencePhotoRegistry>
      </section>
    </section>
  );
}
