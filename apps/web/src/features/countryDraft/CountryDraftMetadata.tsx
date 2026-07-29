import type { DraftNode } from "./countryDraftTypes";

type CountryDraftMetadataProps = {
  approveTarget: string;
  item: DraftNode;
  kind: string;
  kindLabel?: string;
  onApprovalChange: (target: string, approved: boolean) => void;
};

export function CountryDraftMetadata({
  approveTarget,
  item,
  kind,
  kindLabel = kind,
  onApprovalChange
}: CountryDraftMetadataProps) {
  const approved = isDraftItemApproved(item);
  const approveLabel = approveTarget.split(":")[1] ?? "item";
  const kindValue = formatDraftKind(kindLabel);
  const confidence = String(item.confidence ?? "unconfirmed");
  const confidenceValue = formatDraftConfidence(confidence);
  const kindDescription = describeDraftKind(kindLabel);
  const trustDescription = approved
    ? `Approved. Click to return ${approveLabel} to needs-review.`
    : `Click to mark ${approveLabel} as curated.`;

  return (
    <span
      className="draft-meta"
      aria-label={`${kindDescription} ${describeDraftConfidence(confidence)}`}
    >
      <span className="draft-meta-chip">
        <span className="draft-meta-label">Type</span>
        <span>{kindValue}</span>
        <DraftTooltip
          copy={kindDescription}
          title={`Type: ${kindValue}`}
        />
      </span>
      <button
        type="button"
        className={[
          "draft-meta-chip",
          "draft-meta-chip--trust",
          `draft-meta-chip--${confidence}`,
          "draft-meta-chip--action",
          approved ? "is-approved" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={
          approved
            ? `Unapprove ${approveLabel}`
            : `Approve ${approveLabel}`
        }
        aria-pressed={approved}
        onClick={() =>
          onApprovalChange(approveTarget, !approved)
        }
      >
        <span className="draft-meta-label">Trust</span>
        <span className="draft-meta-value">{confidenceValue}</span>
        <DraftTrustTick approved={approved} />
        <DraftTooltip
          copy={trustDescription}
          title={`Trust: ${confidenceValue}`}
        />
      </button>
    </span>
  );
}

export function DraftTooltip({
  copy,
  title
}: {
  copy: string;
  title: string;
}) {
  return (
    <span className="draft-button-tooltip" role="tooltip">
      <span className="draft-button-tooltip-title">{title}</span>
      <span className="draft-button-tooltip-copy">{copy}</span>
    </span>
  );
}

export function isDraftItemApproved(item: DraftNode): boolean {
  return (
    item.confidence === "confirmed" ||
    item.reviewStatus === "human_approved"
  );
}

function DraftTrustTick({ approved }: { approved: boolean }) {
  return (
    <span
      className={`draft-trust-tick${approved ? " is-approved" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" focusable="false">
        <circle
          className="draft-trust-tick-ring"
          cx="6"
          cy="6"
          r="5.25"
        />
        <path
          className="draft-trust-tick-mark"
          d="M3.4 6.1 5.2 7.9 8.7 4.3"
        />
      </svg>
    </span>
  );
}

function formatDraftKind(kind: string): string {
  const labels: Record<string, string> = {
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

function describeDraftKind(kind: string): string {
  const descriptions: Record<string, string> = {
    area: "A broad place candidate or sub-area in the map.",
    attraction: "A specific place a traveller can visit.",
    city: "A city-level candidate for future curation.",
    region: "A broad district or region in the country map.",
    state: "A state-level candidate for future curation.",
    theme: "A research lens used to organize the map.",
    zone: "A sub-area inside a larger attraction.",
    animal: "A wildlife or encyclopedia node."
  };
  return (
    descriptions[kind] ??
    "The kind of RoamAtlas node this item represents."
  );
}

function formatDraftConfidence(confidence: string): string {
  const labels: Record<string, string> = {
    confirmed: "Curated",
    likely: "Likely",
    general: "General",
    unconfirmed: "Needs review"
  };
  return labels[confidence] ?? titleCaseText(confidence);
}

function describeDraftConfidence(confidence: string): string {
  const descriptions: Record<string, string> = {
    confirmed: "Backed by the source-controlled RoamAtlas data.",
    likely:
      "Supported by a grounding source, but still needs human review.",
    general:
      "General background, not a specific travel claim.",
    unconfirmed:
      "Planning scaffold only; not verified for user-facing claims."
  };
  return (
    descriptions[confidence] ?? "Confidence level for this item."
  );
}

function titleCaseText(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
