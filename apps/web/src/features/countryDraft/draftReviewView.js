/**
 * Renders starter-map review and promotion status from structured draft state.
 * This module cannot promote data; callers dispatch any button action.
 */
export function createDraftReviewView({ escapeHtml }) {
  function renderDraftReview(draft) {
    const items = (draft.reviewChecklist ?? []).filter(Boolean);
    if (!items.length) return "";

    return `
      <section class="draft-review" aria-label="Before promotion">
        <header class="draft-review-header">
          <h3 class="draft-review-title">Before promotion</h3>
          <p class="draft-review-lead">Keep starter facts unconfirmed until each item is source-reviewed.</p>
        </header>
        <ol class="draft-review-list">
          ${items
            .map(
              (item, index) => `
            <li class="draft-review-item">
              <span class="draft-review-step" aria-hidden="true">${index + 1}</span>
              <p>${escapeHtml(item)}</p>
            </li>`
            )
            .join("")}
        </ol>
      </section>
    `;
  }

  function renderDraftConfirmation(draftState, { countryName, isRegisteredCountryPack } = {}) {
    const draft = draftState.draft;
    if (draft.mode === "curated_pack_snapshot") {
      const isUnconfirmedPack = draft.confidence === "unconfirmed";
      if (isUnconfirmedPack) return "";
      return `
        <section class="draft-confirmation">
          <h3>Source-reviewed country pack</h3>
          <p>This starter map is already derived from source-controlled curated data.</p>
        </section>
      `;
    }

    if (isRegisteredCountryPack) {
      return `
        <section class="draft-confirmation">
          <div>
            <h3>Preview only</h3>
            <p>${escapeHtml(countryName ?? "This country")} already has a source-controlled country pack. Use this starter map to explore changes, then update the country pack source file to make them permanent.</p>
          </div>
        </section>
      `;
    }

    if (draftState.confirmation) {
      return `
        <section class="draft-confirmation draft-confirmation--ready">
          <div>
            <h3>Confirmed for curation</h3>
            <p>Country-pack draft artifact generated. You can open the review files below.</p>
          </div>
          <div class="draft-links">
            <a href="${escapeHtml(draftState.confirmation.paths.confirmationUrl)}" target="_blank" rel="noreferrer">confirmation</a>
            <a href="${escapeHtml(draftState.confirmation.paths.countryPackDraftUrl)}" target="_blank" rel="noreferrer">country pack draft</a>
          </div>
        </section>
      `;
    }

    if (draftState.confirmationError) {
      return `
        <section class="draft-confirmation draft-confirmation--failed" aria-live="polite">
          <div>
            <h3>Confirmation failed</h3>
            <p>${escapeHtml(draftState.confirmationError)}</p>
          </div>
          <button type="button" data-country-action="confirm-starter-map">Try again</button>
        </section>
      `;
    }

    if (draftState.isConfirming) {
      return `
        <section class="draft-confirmation draft-confirmation--loading" aria-live="polite">
          <div>
            <h3>Confirming for curation</h3>
            <p>Generating the country-pack draft artifact for source review.</p>
          </div>
          <button type="button" disabled>Confirming</button>
        </section>
      `;
    }

    return `
      <section class="draft-confirmation">
        <div>
          <h3>Ready to confirm</h3>
          <p>Confirm this direction to generate a country-pack draft artifact for source review.</p>
        </div>
        <button type="button" data-country-action="confirm-starter-map">Confirm for curation</button>
      </section>
    `;
  }

  return { renderDraftConfirmation, renderDraftReview };
}
