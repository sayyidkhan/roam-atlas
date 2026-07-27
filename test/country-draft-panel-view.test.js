import assert from "node:assert/strict";
import test from "node:test";

import { createCountryDraftPanelView } from "../apps/web/src/features/countryDraft/countryDraftPanelView.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function createView(uiState = {}) {
  return createCountryDraftPanelView({
    escapeHtml,
    getDraftUiState: () => ({ activeSectionTab: "regions", isToolMenuOpen: false, openTarget: null, ...uiState }),
    isConfiguredCountryPack: () => false,
    isDraftItemApproved: (item) => item?.confidence === "confirmed",
    isSourceControlledCountryPack: () => false,
    renderDraftConfirmation: () => "<aside>confirmation</aside>",
    renderDraftEditModal: () => "<aside>modal</aside>",
    renderDraftMetadata: (kind, confidence) => `<button data-country-action="approve-draft-item">${kind}:${confidence}</button>`,
    renderDraftPlacePhoto: (name) => `<img alt="reference only ${escapeHtml(name)}" />`,
    renderDraftReview: () => "<aside>review</aside>",
    getDraftEditModalContext: () => null,
    renderGenAiIcon: () => "<svg></svg>",
    renderResetIcon: () => "<svg></svg>",
    renderTooltip: () => ""
  });
}

test("country draft panel renders unconfirmed candidates as structured review controls", () => {
  const { renderCountryDraftPanel } = createView();
  const html = renderCountryDraftPanel({ slug: "example", name: "Example" }, {
    status: "ready",
    draft: {
      countryName: "Example",
      summary: "A <draft>",
      regions: [{ name: "North", kind: "region", confidence: "unconfirmed", why: "Coast", children: [] }],
      themes: []
    }
  });

  assert.match(html, /AI starter map/);
  assert.match(html, /A &lt;draft&gt;/);
  assert.match(html, /data-country-action="approve-draft-item"/);
  assert.match(html, /data-country-action="toggle-genai-prompt"/);
  assert.match(html, /reference only North/);
  assert.match(html, /confirmation/);
  assert.match(html, /review/);
});

test("country draft panel uses an honest empty state for an unconfigured country", () => {
  const { renderCountryDraftPanel } = createView();
  const html = renderCountryDraftPanel({ slug: "example", name: "Example" }, null);

  assert.match(html, /No Example map data loaded/);
  assert.match(html, /unconfirmed outline/);
  assert.match(html, /will not be treated as a verified country pack/);
});
