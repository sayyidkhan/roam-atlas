/**
 * Renders the compact type and confidence controls for starter-map items.
 * This view never changes curation state; the shell handles its data actions.
 */
export function createDraftMetadataRenderer({ escapeHtml, renderTooltip }) {
  return function renderDraftMetadata(kind, confidence, options = null) {
    const kindLabel = typeof options === "string" ? options : options?.kindLabel ?? kind;
    const approveTarget = typeof options === "object" ? options?.approveTarget : null;
    const item = typeof options === "object" ? options?.item : null;
    const approved = item?.confidence === "confirmed" || item?.reviewStatus === "human_approved";
    const approveLabel = approveTarget?.split(":")[1] ?? "item";
    const kindValue = formatDraftKind(kindLabel);
    const confidenceValue = formatDraftConfidence(confidence);
    const kindDescription = describeDraftKind(kindLabel);
    const confidenceDescription = describeDraftConfidence(confidence);
    const trustTitle = approved
      ? `Approved. Click to return ${approveLabel} to needs-review.`
      : `Click to mark ${approveLabel} as curated.`;

    const trustChip = approveTarget
      ? `
        <button
          type="button"
          class="draft-meta-chip draft-meta-chip--trust draft-meta-chip--${escapeHtml(confidence)} draft-meta-chip--action${approved ? " is-approved" : ""}"
          data-country-action="approve-draft-item"
          data-approve-target="${escapeHtml(approveTarget)}"
          data-approved="${approved ? "true" : "false"}"
          aria-label="${escapeHtml(approved ? `Unapprove ${approveLabel}` : `Approve ${approveLabel}`)}"
          aria-pressed="${approved}"
        >
          <span class="draft-meta-label">Trust</span>
          <span class="draft-meta-value">${escapeHtml(confidenceValue)}</span>
          ${renderDraftTrustTick(approved)}
          ${renderTooltip(`Trust: ${confidenceValue}`, trustTitle)}
        </button>
      `
      : `
        <span class="draft-meta-chip draft-meta-chip--trust draft-meta-chip--${escapeHtml(confidence)}">
          <span class="draft-meta-label">Trust</span>
          <span>${escapeHtml(confidenceValue)}</span>
          ${renderTooltip(`Trust: ${confidenceValue}`, confidenceDescription)}
        </span>
      `;

    return `
      <span class="draft-meta" aria-label="${escapeHtml(`${kindDescription}. ${confidenceDescription}`)}">
        <span class="draft-meta-chip">
          <span class="draft-meta-label">Type</span>
          <span>${escapeHtml(kindValue)}</span>
          ${renderTooltip(`Type: ${kindValue}`, kindDescription)}
        </span>
        ${trustChip}
      </span>
    `;
  };
}

function renderDraftTrustTick(approved) {
  return `
    <span class="draft-trust-tick${approved ? " is-approved" : ""}" aria-hidden="true">
      <svg viewBox="0 0 12 12" focusable="false">
        <circle class="draft-trust-tick-ring" cx="6" cy="6" r="5.25" />
        <path class="draft-trust-tick-mark" d="M3.4 6.1 5.2 7.9 8.7 4.3" />
      </svg>
    </span>
  `;
}

function formatDraftKind(kind) {
  const labels = {
    area: "Area",
    attraction: "Attraction",
    city: "City",
    region: "Region",
    state: "State",
    theme: "Theme",
    zone: "Zone",
    animal: "Animal"
  };
  return labels[kind] ?? titleCaseText(kind);
}

function describeDraftKind(kind) {
  const descriptions = {
    area: "A broad place candidate or sub-area in the map.",
    attraction: "A specific place a traveller can visit.",
    city: "A city-level candidate for future curation.",
    region: "A broad district or region in the country map.",
    state: "A state-level candidate for future curation.",
    theme: "A research lens used to organize the map.",
    zone: "A sub-area inside a larger attraction.",
    animal: "A wildlife or encyclopedia node."
  };
  return descriptions[kind] ?? "The kind of RoamAtlas node this item represents.";
}

function formatDraftConfidence(confidence) {
  const labels = {
    confirmed: "Curated",
    likely: "Likely",
    general: "General",
    unconfirmed: "Needs review"
  };
  return labels[confidence] ?? titleCaseText(confidence);
}

function describeDraftConfidence(confidence) {
  const descriptions = {
    confirmed: "Backed by the source-controlled RoamAtlas data.",
    likely: "Supported by a grounding source, but still needs human review.",
    general: "General background, not a specific travel claim.",
    unconfirmed: "Planning scaffold only; not verified for user-facing claims."
  };
  return descriptions[confidence] ?? "Confidence level for this item.";
}

function titleCaseText(value) {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
