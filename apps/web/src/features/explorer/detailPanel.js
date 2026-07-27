import { factConfidenceLabel, hasUnconfirmedNodeFacts } from "@roamatlas/domain/guardrails.js";

/**
 * Renders structured curated-node facts and explicitly labelled detours.
 * It receives data prepared by the explorer; it never reads image output.
 */
export function renderExplorerDetailPanel({ detailSheet, detailRoot, node, detailOverride, mode }) {
  if (detailOverride) {
    detailSheet.classList.add("is-open", "is-expanded");
    detailSheet.classList.remove("is-compact");
    detailRoot.innerHTML = `
      <div class="detail-sheet-head">
        <div class="detail-sheet-copy">
          <span class="detail-sheet-type">${escapeHtml(detailOverride.confidence)}</span>
          <strong class="detail-sheet-title">${escapeHtml(detailOverride.title)}</strong>
        </div>
      </div>
      <p class="detail-sheet-fact">${escapeHtml(detailOverride.message)}</p>
    `;
    return;
  }

  const isVisible = Boolean(node) && mode !== "hidden";
  detailSheet.classList.toggle("is-open", isVisible);
  detailSheet.classList.toggle("is-expanded", mode === "expanded");
  detailSheet.classList.toggle("is-compact", mode === "compact");

  if (!isVisible || !node) {
    detailRoot.innerHTML = "";
    return;
  }

  const primaryFact = node.facts?.[0];
  if (mode === "compact") {
    detailRoot.innerHTML = `
      <div class="detail-sheet-head">
        <div class="detail-sheet-copy">
          <span class="detail-sheet-type">${escapeHtml(formatNodeType(node.type))}</span>
          <strong class="detail-sheet-title">${escapeHtml(node.title)}</strong>
        </div>
        <button
          type="button"
          class="detail-sheet-icon-button"
          data-detail-action="expand"
          aria-label="Show facts for ${escapeHtml(node.title)}"
        >Facts</button>
      </div>
    `;
    return;
  }

  detailRoot.innerHTML = `
    <div class="detail-sheet-head">
      <div class="detail-sheet-copy">
        <span class="detail-sheet-type">${escapeHtml(formatNodeType(node.type))}</span>
        <strong class="detail-sheet-title">${escapeHtml(node.title)}</strong>
      </div>
      <button
        type="button"
        class="detail-sheet-icon-button detail-sheet-icon-button--ghost"
        data-detail-action="collapse"
        aria-label="Collapse detail"
      >Less</button>
    </div>
    ${primaryFact ? renderDetailFact(primaryFact, { hasUnconfirmedFacts: hasUnconfirmedNodeFacts(node) }) : `<p class="detail-sheet-empty">No curated facts yet.</p>`}
  `;
}

function renderDetailFact(fact, { hasUnconfirmedFacts }) {
  const source = fact.sourceUrl
    ? `<a href="${escapeHtml(fact.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>`
    : "";
  return `
    <p class="detail-sheet-fact">${escapeHtml(fact.text)}</p>
    <div class="detail-sheet-meta">
      <span>${escapeHtml(factConfidenceLabel(fact.confidence))}</span>
      ${source ? `<span aria-hidden="true">·</span>${source}` : ""}
    </div>
    ${hasUnconfirmedFacts ? `<p class="detail-sheet-note">Some facts here are still unconfirmed.</p>` : ""}
  `;
}

function formatNodeType(type) {
  return String(type ?? "place").replace(/_/g, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
