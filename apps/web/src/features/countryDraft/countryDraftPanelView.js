/**
 * Complete visual tree for a country starter map. It renders structured draft
 * state and emits data attributes only; the legacy shell owns events, storage,
 * curation mutations, and GenAI transport.
 */
export function createCountryDraftPanelView({
  escapeHtml,
  getDraftUiState,
  isConfiguredCountryPack,
  isDraftItemApproved,
  isSourceControlledCountryPack,
  renderDraftConfirmation,
  renderDraftEditModal,
  renderDraftMetadata,
  renderDraftPlacePhoto,
  renderDraftReview,
  getDraftEditModalContext,
  renderGenAiIcon,
  renderResetIcon,
  renderTooltip
}) {
  function renderCountryDraftPanel(country, draftState) {
    if (!draftState) {
      const isSourceControlled = isConfiguredCountryPack(country.slug);
      return `
        <section class="country-draft country-draft--empty" aria-label="AI starter map">
          <p class="eyebrow">${isSourceControlled ? "Country map" : "Starter map"}</p>
          <h2>No ${escapeHtml(country.name)} map data loaded</h2>
          <p>${isSourceControlled
            ? `Build ${escapeHtml(country.name)} map from its original source-controlled country pack.`
            : `Build an unconfirmed outline for ${escapeHtml(country.name)}. It will not be treated as a verified country pack.`}</p>
        </section>
      `;
    }

    if (draftState.status === "loading" && !draftState.draft) {
      return `
        <section class="country-draft" aria-label="AI starter map">
          <section class="country-draft-loading" aria-live="polite">
            <p class="eyebrow">Resetting metadata</p>
            <h2>Clearing starter map info</h2>
            <p>Rebuilding candidate regions, summary, and research themes.</p>
          </section>
        </section>
      `;
    }

    if (draftState.status === "failed") {
      return `
        <section class="country-draft country-draft--failed" aria-label="AI starter map">
          <p class="eyebrow">Starter map failed</p>
          <h2>Could not build a starter map</h2>
          <p>${escapeHtml(draftState.error)}</p>
        </section>
      `;
    }

    const draft = draftState.draft;
    const uiState = getDraftUiState(country.slug);
    const genAiContext = {
      openTarget: uiState.openTarget,
      draftState,
      countrySlug: country.slug
    };
    const regions = draft.regions.length
      ? draft.regions.map((region, index) => renderDraftRegion(region, [index + 1], genAiContext)).join("")
      : `<li class="muted">No candidate regions were returned.</li>`;
    const themes = draft.themes.length
      ? draft.themes.map((theme, index) => renderDraftTheme(theme, [index + 1], genAiContext)).join("")
      : `<li class="muted">No candidate themes were returned.</li>`;
    const activeSectionTab = uiState.activeSectionTab;
    const editModal = getDraftEditModalContext(draft, genAiContext.openTarget);
    const isDraftBusy = Boolean(draftState.status === "loading" || draftState.isSending);
    const starterMapGenAiTooltip = "Suggest starter-map edits without changing verified facts. Changes stay unconfirmed until source review.";

    return `
      <section class="country-draft" aria-label="AI starter map">
        <div class="country-draft-header">
          <h2>AI starter map</h2>
        </div>
        <p>${escapeHtml(draft.summary)}</p>
        ${draft.unavailableReason ? `<p class="muted">${escapeHtml(draft.unavailableReason)}</p>` : ""}
        ${renderDraftConfirmation(draftState, {
          countryName: country.name,
          isRegisteredCountryPack: isSourceControlledCountryPack(country.slug)
        })}
        ${renderDraftReview(draft)}
        <div class="draft-section-toolbar">
          <div class="draft-section-tabs" aria-label="Candidate regions and research themes">
            <div class="draft-section-tab-group" role="tablist" aria-label="Candidate regions and research themes">
              <button type="button" role="tab" class="${activeSectionTab === "regions" ? "is-active" : ""}" aria-selected="${activeSectionTab === "regions"}" data-country-draft-section-tab="regions">Candidate regions (${draft.regions.length})</button>
              <button type="button" role="tab" class="${activeSectionTab === "themes" ? "is-active" : ""}" aria-selected="${activeSectionTab === "themes"}" data-country-draft-section-tab="themes">Research themes (${draft.themes.length})</button>
            </div>
          </div>
          <div class="draft-section-actions" aria-label="Starter map tools">
            ${renderDraftResetButton({ disabled: isDraftBusy, isOpen: uiState.isToolMenuOpen })}
            <button type="button" class="draft-genai-button ${genAiContext.openTarget === "starter-map" ? "is-active" : ""}" data-country-action="toggle-genai-prompt" data-genai-target="starter-map" data-tooltip-title="GenAI edit" data-tooltip="${escapeHtml(starterMapGenAiTooltip)}" aria-label="Edit starter map with GenAI" aria-haspopup="dialog" aria-expanded="${genAiContext.openTarget === "starter-map"}">${renderGenAiIcon()}<span class="visually-hidden">Edit starter map with GenAI</span>${renderTooltip("GenAI edit", starterMapGenAiTooltip)}</button>
          </div>
        </div>
        ${editModal ? renderDraftEditModal(draftState, editModal) : ""}
        <section class="draft-section-panel">
          ${renderDraftSectionIntro(activeSectionTab)}
          ${activeSectionTab === "themes"
            ? renderDraftTree(draft.countryName, themes, draft.themes.length)
            : renderDraftTree(draft.countryName, regions, draft.regions.length)}
        </section>
      </section>
    `;
  }

  function renderDraftSectionIntro(activeSectionTab) {
    return activeSectionTab === "themes"
      ? `<p class="draft-section-intro">Research themes group regions by travel style or category. They describe patterns across places, not separate destinations.</p>`
      : `<p class="draft-section-intro">Candidate regions are possible map chapters for this country. Review, approve, and add sources before using them as verified travel facts.</p>`;
  }

  function renderDraftResetButton({ disabled = false, isOpen = false } = {}) {
    return `
      <div class="draft-reset-menu">
        <button type="button" class="draft-tool-menu-button ${isOpen ? "is-active" : ""}" data-country-action="toggle-starter-tools" aria-label="Open starter-map actions" aria-haspopup="menu" aria-expanded="${isOpen}" ${disabled ? "disabled" : ""}><span class="draft-tool-menu-dots" aria-hidden="true"><span></span><span></span><span></span></span></button>
        ${isOpen ? `
          <div class="draft-tool-menu" role="menu" aria-label="Starter-map actions">
            <button type="button" class="draft-tool-menu-item" data-country-action="reset-metadata" role="menuitem" ${disabled ? "disabled" : ""}>${renderResetIcon()}<span><strong>Rebuild starter info</strong><small>Refresh regions, summary, and themes.</small></span></button>
            <button type="button" class="draft-tool-menu-item" data-country-action="reset-reference-photos" role="menuitem" ${disabled ? "disabled" : ""}>${renderResetIcon()}<span><strong>Reset photos</strong><small>Clear cached thumbnails and search again.</small></span></button>
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderDraftTree(countryName, childItemsHtml, childCount) {
    return `<ul class="draft-tree"><li class="draft-tree-root"><div class="draft-tree-root-header"><div><strong>${escapeHtml(countryName)}</strong><span class="muted">${childCount} parent node${childCount === 1 ? "" : "s"}</span></div></div><ul class="draft-list">${childItemsHtml}</ul></li></ul>`;
  }

  function renderDraftGenAiButton(target, label, genAiContext) {
    if (!genAiContext) return "";
    const isOpen = genAiContext.openTarget === target;
    const tooltip = `Suggest edits for ${label}. Changes stay unconfirmed until source review.`;
    return `<button type="button" class="draft-genai-button ${isOpen ? "is-active" : ""}" data-country-action="toggle-genai-prompt" data-genai-target="${escapeHtml(target)}" data-tooltip-title="GenAI edit" data-tooltip="${escapeHtml(tooltip)}" aria-label="Edit ${escapeHtml(label)} with GenAI" aria-haspopup="dialog" aria-expanded="${isOpen}">${renderGenAiIcon()}<span class="visually-hidden">Edit ${escapeHtml(label)} with GenAI</span>${renderTooltip("GenAI edit", tooltip)}</button>`;
  }

  function renderDraftRegion(region, indexPath, genAiContext) {
    const index = indexPath[0] - 1;
    const nested = [`<li>${escapeHtml(region.why)}</li>`];
    if (region.sourceUrl) nested.push(`<li>Source: <a href="${escapeHtml(region.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(region.sourceUrl)}</a></li>`);
    return `<li class="draft-item" data-draft-list="regions" data-draft-sort-index="${index}"><div class="draft-item-heading">${renderDraftSortHandle("regions", index, region.name)}${renderDraftPlacePhoto(region.name, region.children, genAiContext, region.kind)}${renderDraftItemCounter(indexPath)}<strong>${escapeHtml(region.name)}</strong>${renderDraftMetadata(region.kind, region.confidence, { approveTarget: `region:${region.name}`, item: region })}${renderDraftDescendantApprovalButton(region)}${renderDraftGenAiButton(`region:${region.name}`, region.name, genAiContext)}${renderDraftDeleteButton("regions", index, region.name)}</div><ul class="draft-item-nested">${nested.join("")}</ul>${renderDraftChildNodes(region.children, indexPath)}</li>`;
  }

  function renderDraftChildNodes(children, parentIndexPath) {
    if (!Array.isArray(children) || children.length === 0) return "";
    return `<ul class="draft-child-list">${children.map((child, index) => {
      const indexPath = [...parentIndexPath, index + 1];
      const target = `node:${indexPath.join(".")}`;
      return `<li class="draft-child-item"><div class="draft-item-heading">${renderDraftItemCounter(indexPath)}<strong>${escapeHtml(child.name)}</strong>${renderDraftMetadata(child.kind, child.confidence, { approveTarget: target, item: child })}${renderDraftCandidateEditButton(child, indexPath)}${renderDraftDeleteButton("node", null, child.name, indexPath.join("."))}</div>${renderDraftChildNodes(child.children, indexPath)}</li>`;
    }).join("")}</ul>`;
  }

  function renderDraftCandidateEditButton(item, indexPath) {
    if (isDraftItemApproved(item)) return "";
    return `<button type="button" class="draft-candidate-edit-button" data-country-action="edit-draft-candidate" data-draft-path="${escapeHtml(indexPath.join("."))}" aria-label="Edit unconfirmed candidate ${escapeHtml(item.name)}" title="Edit unconfirmed candidate">Edit</button>`;
  }

  function renderDraftTheme(theme, indexPath, genAiContext) {
    const index = indexPath[0] - 1;
    const nested = [`<li>${escapeHtml(theme.note)}</li>`];
    if (theme.sourceUrl) nested.push(`<li>Source: <a href="${escapeHtml(theme.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(theme.sourceUrl)}</a></li>`);
    return `<li class="draft-item" data-draft-list="themes" data-draft-sort-index="${index}"><div class="draft-item-heading">${renderDraftSortHandle("themes", index, theme.label)}${renderDraftItemCounter(indexPath)}<strong>${escapeHtml(theme.label)}</strong>${renderDraftMetadata("theme", theme.confidence, { kindLabel: theme.label, approveTarget: `theme:${theme.label}`, item: theme })}${renderDraftGenAiButton(`theme:${theme.label}`, theme.label, genAiContext)}${renderDraftDeleteButton("themes", index, theme.label)}</div><ul class="draft-item-nested">${nested.join("")}</ul></li>`;
  }

  function renderDraftSortHandle(list, index, label) {
    return `<button type="button" class="draft-sort-handle" draggable="true" data-draft-drag-handle data-draft-list="${escapeHtml(list)}" data-draft-index="${index}" aria-label="Drag to reorder ${escapeHtml(label)}" title="Drag to reorder"><svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="M5 3h1.5v1.5H5V3Zm4.5 0H11v1.5H9.5V3ZM5 7.25h1.5v1.5H5v-1.5Zm4.5 0H11v1.5H9.5v-1.5ZM5 11.5h1.5V13H5v-1.5Zm4.5 0H11V13H9.5v-1.5Z"></path></svg></button>`;
  }

  function renderDraftDescendantApprovalButton(item) {
    if (!Array.isArray(item?.children) || item.children.length === 0) return "";
    const allApproved = areDraftDescendantsApproved(item);
    const label = allApproved ? "Clear all" : "Curate all";
    const description = allApproved ? "Return all nested nodes to needs review" : "Mark all nested nodes as curated";
    return `<button type="button" class="draft-descendant-approval" data-country-action="approve-draft-descendants" data-approve-target="region:${escapeHtml(item.name)}" data-approved="${allApproved ? "true" : "false"}" aria-pressed="${allApproved}" aria-label="${description}" title="${description}">${label}</button>`;
  }

  function areDraftDescendantsApproved(item) {
    const children = item?.children ?? [];
    return children.length > 0 && children.every((child) =>
      (child.confidence === "confirmed" || child.reviewStatus === "human_approved") && areChildTreeApproved(child)
    );
  }

  function areChildTreeApproved(item) {
    return (item.children ?? []).every((child) =>
      (child.confidence === "confirmed" || child.reviewStatus === "human_approved") && areChildTreeApproved(child)
    );
  }

  function renderDraftDeleteButton(list, index, label, path = null) {
    return `<button type="button" class="draft-delete-button" data-country-action="delete-draft-item" data-draft-list="${escapeHtml(list)}" ${Number.isInteger(index) ? `data-draft-index="${index}"` : ""} ${path ? `data-draft-path="${escapeHtml(path)}"` : ""} data-draft-label="${escapeHtml(label)}" aria-label="Delete ${escapeHtml(label)} from starter map" title="Delete from starter map"><svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="M6.2 2h3.6l.6 1.2H13v1.3H3V3.2h2.6L6.2 2Zm-1.7 4h1.3l.3 7h3.8l.3-7h1.3l-.4 8.2H4.9L4.5 6Zm2.3.5H8v5.8H6.8V6.5Zm2.2 0h1.2v5.8H9V6.5Z"></path></svg></button>`;
  }

  function renderDraftItemCounter(indexPath) {
    return `<span class="draft-item-counter" aria-hidden="true">${escapeHtml(indexPath.join("."))}</span>`;
  }

  return { renderCountryDraftPanel };
}
