import type {
  CountryDraft,
  CountryDraftConfirmation
} from "./countryDraftTypes";

type CountryDraftReviewProps = {
  confirmation: CountryDraftConfirmation | null;
  confirmationError: string | null;
  countryName: string;
  draft: CountryDraft;
  isConfirming: boolean;
  isSourceControlled: boolean;
  onConfirm: () => void;
};

/**
 * Source-review guidance and explicit promotion workflow.
 *
 * This component displays structured draft state only. Confirmation creates a
 * review artifact; it never promotes generated content into verified facts.
 */
export function CountryDraftReview({
  confirmation,
  confirmationError,
  countryName,
  draft,
  isConfirming,
  isSourceControlled,
  onConfirm
}: CountryDraftReviewProps) {
  return (
    <>
      <DraftConfirmation
        confirmation={confirmation}
        error={confirmationError}
        countryName={countryName}
        draft={draft}
        isConfirming={isConfirming}
        isSourceControlled={isSourceControlled}
        onConfirm={onConfirm}
      />
      <ReviewChecklist items={draft.reviewChecklist ?? []} />
    </>
  );
}

function ReviewChecklist({ items }: { items: string[] }) {
  const visibleItems = items.filter(Boolean);
  if (visibleItems.length === 0) return null;

  return (
    <section className="draft-review" aria-label="Before promotion">
      <header className="draft-review-header">
        <h3 className="draft-review-title">Before promotion</h3>
        <p className="draft-review-lead">
          Keep starter facts unconfirmed until each item is
          source-reviewed.
        </p>
      </header>
      <ol className="draft-review-list">
        {visibleItems.map((item, index) => (
          <li className="draft-review-item" key={`${index}:${item}`}>
            <span className="draft-review-step" aria-hidden="true">
              {index + 1}
            </span>
            <p>{item}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DraftConfirmation({
  confirmation,
  countryName,
  draft,
  error,
  isConfirming,
  isSourceControlled,
  onConfirm
}: {
  confirmation: CountryDraftConfirmation | null;
  countryName: string;
  draft: CountryDraft;
  error: string | null;
  isConfirming: boolean;
  isSourceControlled: boolean;
  onConfirm: () => void;
}) {
  if (draft.mode === "curated_pack_snapshot") {
    if (draft.confidence === "unconfirmed") return null;
    return (
      <section className="draft-confirmation">
        <h3>Source-reviewed country pack</h3>
        <p>
          This starter map is already derived from
          source-controlled curated data.
        </p>
      </section>
    );
  }

  if (isSourceControlled) {
    return (
      <section className="draft-confirmation">
        <div>
          <h3>Preview only</h3>
          <p>
            {countryName} already has a source-controlled country
            pack. Use this starter map to explore changes, then
            update the country pack source file to make them
            permanent.
          </p>
        </div>
      </section>
    );
  }

  if (confirmation) {
    return (
      <section className="draft-confirmation draft-confirmation--ready">
        <div>
          <h3>Confirmed for curation</h3>
          <p>
            Country-pack draft artifact generated. You can open the
            review files below.
          </p>
        </div>
        <div className="draft-links">
          <a
            href={confirmation.paths.confirmationUrl}
            target="_blank"
            rel="noreferrer"
          >
            confirmation
          </a>
          <a
            href={confirmation.paths.countryPackDraftUrl}
            target="_blank"
            rel="noreferrer"
          >
            country pack draft
          </a>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="draft-confirmation draft-confirmation--failed"
        aria-live="polite"
      >
        <div>
          <h3>Confirmation failed</h3>
          <p>{error}</p>
        </div>
        <button type="button" onClick={onConfirm}>
          Try again
        </button>
      </section>
    );
  }

  if (isConfirming) {
    return (
      <section
        className="draft-confirmation draft-confirmation--loading"
        aria-live="polite"
      >
        <div>
          <h3>Confirming for curation</h3>
          <p>
            Generating the country-pack draft artifact for source
            review.
          </p>
        </div>
        <button type="button" disabled>
          Confirming
        </button>
      </section>
    );
  }

  return (
    <section className="draft-confirmation">
      <div>
        <h3>Ready to confirm</h3>
        <p>
          Confirm this direction to generate a country-pack draft
          artifact for source review.
        </p>
      </div>
      <button type="button" onClick={onConfirm}>
        Confirm for curation
      </button>
    </section>
  );
}
