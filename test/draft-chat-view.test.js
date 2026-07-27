import assert from "node:assert/strict";
import test from "node:test";

import { createDraftChatView } from "../apps/web/src/features/countryDraft/draftChatView.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

test("draft chat view scopes a modal to a known starter-map candidate", () => {
  const { getDraftEditModalContext, renderDraftEditModal } = createDraftChatView({ escapeHtml });
  const draft = {
    regions: [{ name: "North Coast" }],
    themes: [{ label: "Food" }]
  };
  const modal = getDraftEditModalContext(draft, "region:North Coast");

  assert.equal(modal.title, "Steer North Coast");
  assert.equal(getDraftEditModalContext(draft, "region:Unknown"), null);

  const html = renderDraftEditModal({
    isSending: true,
    messages: [{ role: "assistant", text: "Checking sources", target: "region:North Coast", status: "processing" }]
  }, modal);

  assert.match(html, /data-country-genai-form/);
  assert.match(html, /Checking sources/);
  assert.match(html, /Processing/);
  assert.match(html, /disabled/);
});

test("draft chat view keeps other candidate messages out of a scoped edit", () => {
  const { renderDraftChat, scopedDraftMessage } = createDraftChatView({ escapeHtml });
  const html = renderDraftChat({
    isSending: false,
    messages: [
      scopedDraftMessage({ role: "user", text: "More food" }, "starter-map"),
      scopedDraftMessage({ role: "assistant", text: "<Unsafe markup>" }, "region:North Coast")
    ]
  });

  assert.match(html, /More food/);
  assert.match(html, /&lt;Unsafe markup&gt;/);
  assert.match(html, /This only changes the unconfirmed starter map/);
});
