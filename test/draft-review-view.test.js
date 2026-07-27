import assert from "node:assert/strict";
import test from "node:test";

import { createDraftReviewView } from "../src/features/countryDraft/draftReviewView.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

test("draft review view keeps review guidance separate from factual approval", () => {
  const { renderDraftReview } = createDraftReviewView({ escapeHtml });

  assert.equal(renderDraftReview({ reviewChecklist: [] }), "");
  const html = renderDraftReview({ reviewChecklist: ["Check official <source>", "", "Review scope"] });

  assert.match(html, /Before promotion/);
  assert.match(html, /Keep starter facts unconfirmed/);
  assert.match(html, /Check official &lt;source&gt;/);
  assert.match(html, />2</);
});

test("draft confirmation view exposes review artifacts only after explicit confirmation", () => {
  const { renderDraftConfirmation } = createDraftReviewView({ escapeHtml });
  const baseDraft = { mode: "ai_generated", confidence: "unconfirmed" };

  const ready = renderDraftConfirmation({ draft: baseDraft }, { countryName: "Example" });
  assert.match(ready, /Confirm for curation/);
  assert.match(ready, /data-country-action="confirm-starter-map"/);

  const complete = renderDraftConfirmation({
    draft: baseDraft,
    confirmation: {
      paths: {
        confirmationUrl: "/runtime/confirmation.json",
        countryPackDraftUrl: "/runtime/country-pack.json"
      }
    }
  });
  assert.match(complete, /Confirmed for curation/);
  assert.match(complete, /country-pack.json/);

  const sourceControlled = renderDraftConfirmation({
    draft: { mode: "curated_pack_snapshot", confidence: "confirmed" }
  });
  assert.match(sourceControlled, /Source-reviewed country pack/);
});
