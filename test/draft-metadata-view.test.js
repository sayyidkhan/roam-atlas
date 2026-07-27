import assert from "node:assert/strict";
import test from "node:test";

import { createDraftMetadataRenderer } from "../src/features/countryDraft/draftMetadataView.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

test("draft metadata view labels unconfirmed items and keeps approval as a shell action", () => {
  const renderMetadata = createDraftMetadataRenderer({
    escapeHtml,
    renderTooltip: (title, copy) => `<i data-title="${escapeHtml(title)}">${escapeHtml(copy)}</i>`
  });

  const html = renderMetadata("region", "unconfirmed", {
    approveTarget: "region:North <Coast>",
    item: { confidence: "unconfirmed" }
  });

  assert.match(html, /Type/);
  assert.match(html, /Region/);
  assert.match(html, /Needs review/);
  assert.match(html, /data-country-action="approve-draft-item"/);
  assert.match(html, /data-approve-target="region:North &lt;Coast&gt;"/);
  assert.match(html, /Click to mark North &lt;Coast&gt; as curated/);
});

test("draft metadata view identifies human-approved items without changing their data", () => {
  const renderMetadata = createDraftMetadataRenderer({
    escapeHtml,
    renderTooltip: () => ""
  });

  const html = renderMetadata("animal", "confirmed", {
    approveTarget: "node:1.2",
    item: { reviewStatus: "human_approved" }
  });

  assert.match(html, /is-approved/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Unapprove 1.2/);
});
