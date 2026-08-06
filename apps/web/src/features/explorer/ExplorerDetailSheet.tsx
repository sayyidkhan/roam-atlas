import { useStore } from "zustand";

import {
  factConfidenceLabel,
  hasUnconfirmedNodeFacts
} from "@roamatlas/domain/guardrails.js";

import {
  explorerDetailStore,
  type ExplorerDetailNode,
  type ExplorerDetailSnapshot
} from "./explorerDetailStore";

export function ExplorerDetailSheet() {
  const snapshot = useStore(
    explorerDetailStore,
    (state) => state.snapshot
  );
  const isVisible = Boolean(
    snapshot?.detailOverride ||
      (snapshot?.node && snapshot.mode === "expanded")
  );
  const mode = snapshot?.detailOverride
    ? "expanded"
    : snapshot?.mode ?? "hidden";

  return (
    <aside
      className={[
        "detail-sheet",
        isVisible ? "is-open" : "",
        mode === "expanded" ? "is-expanded" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Selected detail"
      hidden={!isVisible}
    >
      <button
        className="sheet-close"
        type="button"
        aria-label="Close detail"
        onClick={snapshot?.commands.close}
      >
        ×
      </button>
      {snapshot ? <ExplorerDetailContent snapshot={snapshot} /> : null}
    </aside>
  );
}

function ExplorerDetailContent({
  snapshot
}: {
  snapshot: ExplorerDetailSnapshot;
}) {
  if (snapshot.detailOverride) {
    return (
      <section>
        <DetailHeader
          title={snapshot.detailOverride.title ?? "Unmapped detail"}
          type={snapshot.detailOverride.confidence ?? "unconfirmed"}
        />
        <p className="detail-sheet-fact">
          {snapshot.detailOverride.message}
        </p>
      </section>
    );
  }

  const { node, mode } = snapshot;
  if (!node || mode !== "expanded") return null;

  return (
    <section>
      <DetailHeader
        title={node.title ?? "Untitled place"}
        type={formatNodeType(node.type)}
      />
      <ExplorerPrimaryFact node={node} />
    </section>
  );
}

function DetailHeader({
  title,
  type
}: {
  title: string;
  type: string;
}) {
  return (
    <div className="detail-sheet-head">
      <div className="detail-sheet-copy">
        <span className="detail-sheet-type">{type}</span>
        <strong className="detail-sheet-title">{title}</strong>
      </div>
    </div>
  );
}

function ExplorerPrimaryFact({
  node
}: {
  node: ExplorerDetailNode;
}) {
  const fact = node.facts?.[0];
  if (!fact) {
    return (
      <p className="detail-sheet-empty">No curated facts yet.</p>
    );
  }
  const sourceUrl = safeExternalSourceUrl(fact.sourceUrl);
  return (
    <>
      <p className="detail-sheet-fact">{fact.text}</p>
      <div className="detail-sheet-meta">
        <span>
          {factConfidenceLabel(
            String(fact.confidence ?? "unconfirmed")
          )}
        </span>
        {sourceUrl ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
          </>
        ) : null}
      </div>
      {hasUnconfirmedNodeFacts(node) ? (
        <p className="detail-sheet-note">
          Some facts here are still unconfirmed.
        </p>
      ) : null}
    </>
  );
}

function formatNodeType(type: unknown): string {
  return String(type ?? "place").replace(/_/g, " ");
}

function safeExternalSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
