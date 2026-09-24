import { useEffect, useState } from "react";
import { useStore } from "zustand";

import { factConfidenceLabel } from "@roamatlas/domain/guardrails.js";
import { createLeafStudyTopics } from "@roamatlas/domain/leafStudyPlate.js";

import { explorerDetailStore } from "./explorerDetailStore";
import {
  readExplorerCountrySlug,
  requestLeafStudyNotes
} from "./leafStudyClient";

const enrichedNoteCache = new Map<string, Record<string, string>>();

export function ExplorerLeafStudyPlate() {
  const snapshot = useStore(
    explorerDetailStore,
    (state) => state.snapshot
  );
  const node = snapshot?.node;
  const topics = snapshot?.detailOverride
    ? []
    : createLeafStudyTopics(node);
  const topicKey = topics.map((topic) => topic.id).join("|");
  const [selection, setSelection] = useState<{
    id: string;
    key: string;
  } | null>(null);
  const selectedId =
    selection?.key === topicKey ? selection.id : topics[0]?.id;
  const nodeId = typeof node?.id === "string" ? node.id : "";
  const cachedNotes = topicKey
    ? enrichedNoteCache.get(topicKey) ?? null
    : null;
  const [fetchedNotes, setFetchedNotes] = useState<{
    key: string;
    notes: Record<string, string>;
  } | null>(null);
  const activeNotes =
    fetchedNotes?.key === topicKey
      ? fetchedNotes.notes
      : cachedNotes;

  useEffect(() => {
    if (!topicKey || !nodeId || cachedNotes) return undefined;
    const countrySlug = readExplorerCountrySlug();
    if (!countrySlug) return undefined;
    let cancelled = false;
    void requestLeafStudyNotes({ countrySlug, nodeId })
      .then((notes) => {
        if (cancelled) return;
        const next = Object.fromEntries(
          notes.map((note) => [note.id, note.text])
        );
        if (Object.keys(next).length) {
          enrichedNoteCache.set(topicKey, next);
        }
        setFetchedNotes({ key: topicKey, notes: next });
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedNotes({ key: topicKey, notes: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [cachedNotes, nodeId, topicKey]);

  if (!topics.length) return null;
  const selected =
    topics.find((topic) => topic.id === selectedId) ?? topics[0];
  if (!selected) return null;
  const enrichedText = activeNotes?.[selected.id];
  const text = enrichedText || selected.text;

  return (
    <section className="leaf-study" aria-label="Study this place">
      <p className="leaf-study-note">
        <span className="leaf-study-fact">{text}</span>
        <span className="leaf-study-meta">
          <span>
            {enrichedText
              ? "AI note"
              : factConfidenceLabel(selected.confidence)}
          </span>
          {selected.sourceUrl ? (
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
          ) : null}
        </span>
      </p>
      <div className="leaf-study-topics">
        {topics.map((topic, index) => (
          <button
            key={topic.id}
            type="button"
            className={[
              "leaf-study-topic",
              topic.id === selected.id ? "is-selected" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={topic.id === selected.id}
            onClick={() =>
              setSelection({ id: topic.id, key: topicKey })
            }
          >
            <span className="leaf-study-number" aria-hidden="true">
              {index + 1}
            </span>
            <span>{topic.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
