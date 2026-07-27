import assert from "node:assert/strict";
import test from "node:test";

import { createDraftReferencePhotoView } from "../src/features/countryDraft/draftReferencePhotoView.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

test("draft reference-photo view renders a non-factual, country-scoped image request", () => {
  const { renderDraftPlacePhoto } = createDraftReferencePhotoView({
    buildPlaceImageUrl: (countrySlug, placeName, options) =>
      `/api/place-image?countrySlug=${countrySlug}&place=${placeName}&context=${options.context}&kind=${options.kind}`,
    clamp01: (value) => Math.max(0, Math.min(1, value)),
    escapeHtml,
    renderReadyMark: () => "<svg></svg>"
  });

  const html = renderDraftPlacePhoto(
    "North <Coast>",
    [{ name: "Mangroves" }, { name: "Jetty" }],
    { countrySlug: "singapore" },
    "region"
  );

  assert.match(html, /View reference photo for North &lt;Coast&gt;/);
  assert.match(html, /data-draft-place-photo/);
  assert.match(html, /data-place-name="North &lt;Coast&gt;"/);
  assert.match(html, /countrySlug=singapore/);
  assert.match(html, /loading="eager"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
});

test("draft reference-photo view omits photo markup without a country context", () => {
  const { renderDraftPlacePhoto } = createDraftReferencePhotoView({
    buildPlaceImageUrl: () => "/api/place-image",
    clamp01: (value) => value,
    escapeHtml,
    renderReadyMark: () => ""
  });

  assert.equal(renderDraftPlacePhoto("Anywhere", [], null), "");
});
