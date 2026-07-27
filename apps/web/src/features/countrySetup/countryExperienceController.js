export function createCountryExperienceController(dependencies) {
  const {
    APP_CONFIG,
    IMAGE_QUALITY_OPTIONS,
    IMAGE_QUALITY_STORAGE_KEY,
    PLACE_IMAGE_REQUEST_SESSION,
    PLACE_IMAGE_SELECTION_VERSION,
    appendUnconfirmedRegionCandidates,
    apiPath,
    buildPlaceImageUrlCallback,
    clamp01,
    clearCountryGeneratedState,
    countryCatalog,
    countryDraftClient,
    createCountryPackStarterMap,
    elements,
    ensureCountryPack,
    enterCountryLanding,
    enterMappedCountry,
    enterCountryShell,
    escapeHtml,
    explainClickError,
    flushCountryRuntimeCache,
    getCountryPack,
    getDraftNodeAtPath,
    hydrateDraftPlacePhotos,
    imageQualityLabel,
    isConfiguredCountryPack,
    isDraftItemApproved,
    isSourceControlledCountryPack,
    normalizeImageQuality,
    placeImageClient,
    removeDraftNodeAtPath,
    render,
    renderCountryDraftPanel,
    renderCountryShellView,
    renderRegionRailCheck,
    reorderArray,
    scopedDraftMessage,
    state,
  } = dependencies;
  let draftPhotoLightbox = null;
  let appToastTimer = null;

  function reorderCurrentDraftItems(country, { list, fromIndex, targetIndex, insertAfter }) {
    const existing = state.countryDrafts.get(country.slug);
    const items = list === "regions" ? existing?.draft?.regions : list === "themes" ? existing?.draft?.themes : null;
    if (!Array.isArray(items)) return;
    const scrollSnapshot = captureCountryShellScroll();
    const insertionIndex = targetIndex + (insertAfter ? 1 : 0);
    const nextItems = reorderArray(items, fromIndex, insertionIndex);
    if (!nextItems) return;
    const draft = {
      ...existing.draft,
      [list]: nextItems
    };
    state.countryDrafts.set(country.slug, {
      ...existing,
      draft,
      confirmation: null
    });
    render();
    restoreCountryShellScroll(scrollSnapshot);
    persistCountryDraftReorder(country, draft);
  }
  
  function deleteCurrentDraftItem(country, { list, index, path, label }) {
    const existing = state.countryDrafts.get(country.slug);
    const items = list === "regions" ? existing?.draft?.regions : list === "themes" ? existing?.draft?.themes : null;
    const item = path ? getDraftNodeAtPath(existing?.draft, path) : items?.[index];
    if (!item || (!path && (!Array.isArray(items) || !Number.isInteger(index) || index < 0 || index >= items.length))) return;
    const itemLabel = label || item.name || item.label || "this record";
    const confirmed = window.confirm(`Delete ${itemLabel} from this starter map? This only removes the draft record.`);
    if (!confirmed) return;
  
    const scrollSnapshot = captureCountryShellScroll();
    const draft = path
      ? removeDraftNodeAtPath(existing.draft, path)
      : { ...existing.draft, [list]: items.filter((_, itemIndex) => itemIndex !== index) };
    if (!draft) return;
    state.countryDrafts.set(country.slug, {
      ...existing,
      draft,
      confirmation: null
    });
    const openTarget = state.countryDraftGenAiOpen.get(country.slug);
    const removedTarget = list === "regions" ? `region:${itemLabel}` : list === "themes" ? `theme:${itemLabel}` : null;
    if (openTarget && openTarget === removedTarget) {
      state.countryDraftGenAiOpen.delete(country.slug);
    }
    render();
    restoreCountryShellScroll(scrollSnapshot);
    persistCountryDraftReorder(country, draft);
  }
  
  function editUnconfirmedDraftCandidate(country, path) {
    const existing = state.countryDrafts.get(country.slug);
    const item = getDraftNodeAtPath(existing?.draft, path);
    if (!item || isDraftItemApproved(item)) {
      showAppToast({
        tone: "error",
        title: "Candidate cannot be edited",
        message: "Only unconfirmed appended candidates can be edited here. Curated source data stays protected."
      });
      return;
    }
    const nextName = window.prompt("Rename unconfirmed candidate", item.name)?.trim();
    if (!nextName || nextName === item.name) return;
  
    const draft = structuredClone(existing.draft);
    const nextItem = getDraftNodeAtPath(draft, path);
    if (!nextItem) return;
    nextItem.name = nextName.slice(0, APP_CONFIG.countryDraft.candidateNameMaxLength);
    draft.changeNote = `Renamed unconfirmed candidate to ${nextItem.name}.`;
    const scrollSnapshot = captureCountryShellScroll();
    state.countryDrafts.set(country.slug, { ...existing, draft });
    render();
    restoreCountryShellScroll(scrollSnapshot);
    persistCountryDraftReorder(country, draft);
  }
  
  function captureCountryShellScroll() {
    const panel = elements.countryShell.querySelector(".country-shell-panel");
    return {
      windowTop: window.scrollY,
      windowLeft: window.scrollX,
      shellTop: elements.countryShell.scrollTop,
      shellLeft: elements.countryShell.scrollLeft,
      panelTop: panel?.scrollTop ?? 0,
      panelLeft: panel?.scrollLeft ?? 0
    };
  }
  
  function restoreCountryShellScroll(snapshot) {
    window.requestAnimationFrame(() => {
      window.scrollTo(snapshot.windowLeft, snapshot.windowTop);
      elements.countryShell.scrollTop = snapshot.shellTop;
      elements.countryShell.scrollLeft = snapshot.shellLeft;
      const panel = elements.countryShell.querySelector(".country-shell-panel");
      if (panel) {
        panel.scrollTop = snapshot.panelTop;
        panel.scrollLeft = snapshot.panelLeft;
      }
    });
  }
  
  async function persistCountryDraftReorder(country, draft) {
    try {
      const payload = await countryDraftClient.reorder({
        countrySlug: country.slug,
        currentDraft: draft
      });
      const existing = state.countryDrafts.get(country.slug);
      if (existing?.draft !== draft) return;
      state.countryDrafts.set(country.slug, {
        ...existing,
        draft: payload.draft ?? draft
      });
    } catch (error) {
      const scrollSnapshot = captureCountryShellScroll();
      const existing = state.countryDrafts.get(country.slug);
      if (existing?.draft !== draft) return;
      state.countryDrafts.set(country.slug, {
        ...existing,
        messages: [
          ...(existing.messages ?? []),
          {
            role: "assistant",
            status: "error",
            text: explainClickError(error)
          }
        ].slice(-12)
      });
      render();
      restoreCountryShellScroll(scrollSnapshot);
    }
  }
  
  function handleDraftPhotoLightboxKeydown(event) {
    if (event.key === "Escape") {
      closeDraftPhotoLightbox();
    }
  }
  
  function openDraftPhotoLightbox({ src, placeName, context = "", kind = "region" }) {
    closeDraftPhotoLightbox();
    const backdrop = document.createElement("section");
    backdrop.className = "draft-photo-lightbox-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute(
      "aria-label",
      placeName ? `Reference photo for ${placeName}` : "Reference photo"
    );
    backdrop.innerHTML = `
      <button
        type="button"
        class="sheet-close draft-photo-lightbox-close"
        data-close-draft-photo
        aria-label="Close enlarged photo"
      ><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
      ${placeName ? `
        <section class="draft-photo-lightbox-controls" aria-label="Reference photo controls">
          <div class="draft-photo-lightbox-actions">
            <button
              type="button"
              class="draft-photo-lightbox-reset"
              data-reset-draft-photo
              aria-label="Reset reference photo for ${escapeHtml(placeName)}"
            >${renderResetIcon()}<span>Reset image</span></button>
            <button
              type="button"
              class="draft-photo-lightbox-refine"
              data-open-draft-photo-feedback
            >Find a better photo</button>
          </div>
          <nav class="draft-photo-lightbox-history" data-draft-photo-history hidden aria-label="Saved reference photos">
            <button type="button" data-draft-photo-previous aria-label="Show previous saved photo">←</button>
            <span data-draft-photo-history-label></span>
            <button type="button" data-draft-photo-next aria-label="Show next saved photo">→</button>
            <button type="button" data-draft-photo-keep>Keep this photo</button>
            <button type="button" data-draft-photo-delete>Delete photo</button>
          </nav>
          <form class="draft-photo-lightbox-feedback" data-draft-photo-feedback hidden>
            <div class="draft-photo-lightbox-feedback-heading">
              <label for="draft-photo-feedback-input">Tell Exa what this photo should show</label>
              <button type="button" data-suggest-draft-photo-prompts>Suggest prompts</button>
            </div>
            <textarea
              id="draft-photo-feedback-input"
              name="feedback"
              rows="3"
              maxlength="${APP_CONFIG.placeImages.feedbackMaxLength}"
              placeholder="Example: Show NUS Kent Ridge campus or Jurong Lake Gardens, not Gardens by the Bay."
            ></textarea>
            <div class="draft-photo-prompt-suggestions" data-draft-photo-prompt-suggestions hidden></div>
            <p>This only refines the external reference-photo search. It does not change travel facts.</p>
            <div class="draft-photo-lightbox-feedback-actions">
              <button type="button" data-close-draft-photo-feedback>Cancel</button>
              <button type="submit" data-submit-draft-photo-feedback>Search Exa again</button>
            </div>
          </form>
        </section>
      ` : ""}
      <figure class="draft-photo-lightbox">
        <div class="draft-photo-lightbox-image-frame">
          <img
            class="draft-photo-lightbox-image"
            src="${escapeHtml(src)}"
            alt=""
            decoding="async"
            referrerpolicy="no-referrer"
          />
        </div>
        <figcaption class="draft-photo-lightbox-caption">
          Reference photo from external search. Not verified travel data.
        </figcaption>
      </figure>
    `;
    backdrop.addEventListener("click", () => {
      closeDraftPhotoLightbox();
    });
    backdrop.querySelector(".draft-photo-lightbox")?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    backdrop.querySelector(".draft-photo-lightbox-controls")?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    backdrop.querySelector("[data-reset-draft-photo]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.selectedCountry || !placeName) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.querySelector("span").textContent = "Resetting image";
      const didReset = await requestPlaceImageReset(state.selectedCountry, { place: placeName });
      if (didReset) closeDraftPhotoLightbox();
      else {
        button.disabled = false;
        button.querySelector("span").textContent = "Reset image";
      }
    });
    const feedbackForm = backdrop.querySelector("[data-draft-photo-feedback]");
    const feedbackInput = feedbackForm?.querySelector("textarea");
    backdrop.querySelector("[data-open-draft-photo-feedback]")?.addEventListener("click", () => {
      feedbackForm.hidden = false;
      feedbackInput?.focus();
    });
    backdrop.querySelector("[data-suggest-draft-photo-prompts]")?.addEventListener("click", async (event) => {
      if (!state.selectedCountry || !placeName) return;
      const button = event.currentTarget;
      const suggestions = feedbackForm.querySelector("[data-draft-photo-prompt-suggestions]");
      button.disabled = true;
      button.textContent = "Suggesting";
      const promptResult = await requestPlaceImagePromptSuggestions(state.selectedCountry, {
        place: placeName,
        context,
        kind,
        currentFeedback: feedbackInput?.value ?? ""
      });
      const prompts = promptResult.suggestions;
      button.disabled = false;
      button.textContent = "Suggest prompts";
      if (!prompts.length) return;
      const sourceLabel = promptResult.source === "llm" ? "Gen AI" : "Fallback";
      suggestions.innerHTML = `
        <span class="draft-photo-prompt-source" data-prompt-source="${escapeHtml(promptResult.source)}">${sourceLabel}</span>
        ${prompts.map((prompt, index) => `
        <button type="button" data-draft-photo-prompt-index="${index}">${escapeHtml(prompt)}</button>
        `).join("")}
      `;
      suggestions.hidden = false;
      suggestions.querySelectorAll("[data-draft-photo-prompt-index]").forEach((suggestionButton) => {
        suggestionButton.addEventListener("click", () => {
          feedbackInput.value = prompts[Number(suggestionButton.dataset.draftPhotoPromptIndex)];
          feedbackInput.focus();
        });
      });
    });
    backdrop.querySelector("[data-close-draft-photo-feedback]")?.addEventListener("click", () => {
      feedbackForm.hidden = true;
    });
    feedbackForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const feedback = feedbackInput?.value.trim() ?? "";
      if (!feedback || !state.selectedCountry || !placeName) return;
      const submit = feedbackForm.querySelector("[data-submit-draft-photo-feedback]");
      submit.disabled = true;
      submit.textContent = "Searching Exa";
      const didSubmit = await requestPlaceImageFeedback(state.selectedCountry, placeName, feedback);
      if (didSubmit) closeDraftPhotoLightbox();
      else {
        submit.disabled = false;
        submit.textContent = "Search Exa again";
      }
    });
    document.addEventListener("keydown", handleDraftPhotoLightboxKeydown);
    document.body.appendChild(backdrop);
    draftPhotoLightbox = backdrop;
    if (placeName && state.selectedCountry) {
      loadDraftPhotoHistory(backdrop, state.selectedCountry, placeName);
    }
    backdrop.querySelector("[data-close-draft-photo]")?.focus();
  }
  
  function closeDraftPhotoLightbox() {
    if (!draftPhotoLightbox) return;
    draftPhotoLightbox.remove();
    draftPhotoLightbox = null;
    document.removeEventListener("keydown", handleDraftPhotoLightboxKeydown);
  }
  
  function scopeInstructionToCandidate(target, instruction) {
    const separatorIndex = target.indexOf(":");
    const kind = target.slice(0, separatorIndex) === "theme" ? "research theme" : "candidate region";
    const name = target.slice(separatorIndex + 1);
    return `Only change the ${kind} "${name}". Keep every other candidate unchanged. ${instruction}`;
  }
  
  function renderCountryLanding() {
    countryCatalog.render(state.countryQuery);
  }
  
  function canOpenCountryExplorer(country) {
    const draftState = state.countryDrafts.get(country.slug);
    return Boolean(draftState?.draft);
  }
  
  function renderCountryShell() {
    const country = state.selectedCountry;
    if (!country) return;
    const canOpenMap = canOpenCountryExplorer(country);
    const draftState = state.countryDrafts.get(country.slug);
    const flushState = state.countryCacheFlushes.get(country.slug);
    const isActionLegendOpen = Boolean(state.countryActionLegendOpen.get(country.slug));
    elements.countryShell.innerHTML = renderCountryShellView({
      country,
      canOpenMap,
      draftState,
      flushState,
      imageQuality: state.imageQuality,
      imageQualityOptions: IMAGE_QUALITY_OPTIONS,
      isActionLegendOpen,
      isConfiguredCountryPack,
      escapeHtml,
      renderDraftPanel: renderCountryDraftPanel
    });
    hydrateDraftPlacePhotos(elements.countryShell);
  }
  
  function loadImageQualityPreference() {
    try {
      return normalizeImageQuality(window.localStorage.getItem(IMAGE_QUALITY_STORAGE_KEY));
    } catch {
      return "high";
    }
  }
  
  function hasStoredImageQualityPreference() {
    try {
      return Boolean(window.localStorage.getItem(IMAGE_QUALITY_STORAGE_KEY));
    } catch {
      return false;
    }
  }
  
  function storeImageQualityPreference(value) {
    try {
      window.localStorage.setItem(IMAGE_QUALITY_STORAGE_KEY, value);
    } catch {
      // The selected quality remains active for this page when storage is unavailable.
    }
  }
  
  
  function showAppToast({
    title,
    message,
    tone = "success",
    durationMs = APP_CONFIG.notifications.defaultToastDurationMs
  }) {
    let region = document.body.querySelector(".app-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "app-toast-region";
      document.body.appendChild(region);
    }
  
    window.clearTimeout(appToastTimer);
    const isError = tone === "error";
    region.innerHTML = `
      <section class="app-toast app-toast--${escapeHtml(tone)}" role="status" aria-live="polite" aria-atomic="true">
        <span class="app-toast-icon" aria-hidden="true">${isError ? "!" : "✓"}</span>
        <div>
          <span class="app-toast-outcome">${isError ? "Failed" : "Success"}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(message)}</p>
        </div>
        <button type="button" data-dismiss-app-toast aria-label="Dismiss notification">×</button>
      </section>
    `;
    appToastTimer = window.setTimeout(dismissAppToast, durationMs);
  }
  
  function dismissAppToast() {
    window.clearTimeout(appToastTimer);
    appToastTimer = null;
    document.body.querySelector(".app-toast-region")?.remove();
  }
  
  function getDraftUiState(countrySlug) {
    return {
      activeSectionTab: state.countryDraftSectionTabs.get(countrySlug) ?? "regions",
      isToolMenuOpen: Boolean(state.countryDraftToolMenuOpen.get(countrySlug)),
      openTarget: state.countryDraftGenAiOpen.get(countrySlug) ?? null
    };
  }
  
  function renderDraftButtonTooltip(title, copy) {
    return `
      <span class="draft-button-tooltip" role="tooltip">
        <span class="draft-button-tooltip-title">${escapeHtml(title)}</span>
        <span class="draft-button-tooltip-copy">${escapeHtml(copy)}</span>
      </span>
    `;
  }
  
  function renderGenAiIcon() {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z"></path>
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z"></path>
      </svg>
    `;
  }
  
  function renderResetIcon() {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M17.7 6.3A7.7 7.7 0 1 0 20 12h-2a5.7 5.7 0 1 1-1.7-4.1L13.5 10.7H21V3.2l-3.3 3.1Z"></path>
      </svg>
    `;
  }
  
  function getNodePlaceImageContext(node, nodes) {
    return (node?.childIds ?? [])
      .slice(0, APP_CONFIG.countryDraft.placeContextItemLimit)
      .map((childId) => nodes[childId]?.title)
      .filter(Boolean)
      .join(" ");
  }
  
  function buildPlaceImageUrl(countrySlug, placeName, { context = "", kind = "", tags = [] } = {}) {
    if (!countrySlug || !placeName) return "";
    const params = new URLSearchParams({
      countrySlug,
      place: placeName,
      v: PLACE_IMAGE_SELECTION_VERSION,
      request: PLACE_IMAGE_REQUEST_SESSION
    });
    if (context) params.set("context", context);
    if (kind) params.set("kind", kind);
    if (tags.length) params.set("tags", tags.join(","));
    const refresh = state.placeImageRefreshes.get(countrySlug);
    if (refresh) params.set("refresh", String(refresh));
    const placeRefresh = state.placeImageRefreshes.get(getPlaceImageRefreshKey(countrySlug, placeName));
    if (placeRefresh) params.set("placeRefresh", String(placeRefresh));
    const feedback = state.placeImageFeedbacks.get(getPlaceImageRefreshKey(countrySlug, placeName));
    if (feedback) params.set("feedback", feedback);
    return apiPath(`/api/place-image?${params.toString()}`);
  }
  
  function getPlaceImageRefreshKey(countrySlug, placeName) {
    return `${countrySlug}:${String(placeName ?? "").trim().toLowerCase()}`;
  }
  
  function getNodePlaceImageKind(node) {
    const tags = (node?.tags ?? []).map((tag) => String(tag).toLowerCase());
    if (tags.includes("city")) return "city";
    if (tags.includes("state")) return "state";
    if (tags.includes("island")) return "region";
    return "region";
  }
  
  async function requestCountryDraft(country, { force = false, preserveScroll = false } = {}) {
    const existing = state.countryDrafts.get(country.slug);
    if (existing?.status === "loading" || existing?.isSending) return false;
    const scrollSnapshot = preserveScroll ? captureCountryShellScroll() : null;
    const nextMessages = force ? [] : existing?.messages ?? [];
    const nextConfirmation = force ? null : existing?.confirmation ?? null;
  
    state.countryDrafts.set(country.slug, {
      status: "loading",
      messages: nextMessages,
      confirmation: nextConfirmation,
      draft: preserveScroll ? existing?.draft ?? null : null
    });
    render();
    if (scrollSnapshot) restoreCountryShellScroll(scrollSnapshot);
    try {
      const { draft } = await countryDraftClient.load(country.slug, { force });
      state.countryDrafts.set(country.slug, {
        status: "ready",
        draft,
        messages: nextMessages,
        confirmation: nextConfirmation
      });
      render();
      if (scrollSnapshot) restoreCountryShellScroll(scrollSnapshot);
      return true;
    } catch (error) {
      state.countryDrafts.set(country.slug, {
        status: "failed",
        error: explainClickError(error)
      });
      render();
      if (scrollSnapshot) restoreCountryShellScroll(scrollSnapshot);
      return false;
    }
  }
  
  async function loadStoredCountryDraft(country) {
    if (state.checkedStoredDrafts.has(country.slug) || state.countryDrafts.has(country.slug)) {
      return;
    }
  
    state.checkedStoredDrafts.add(country.slug);
    try {
      if (isConfiguredCountryPack(country.slug)) {
        // Source-controlled config screens are reconstructed from the checked-in
        // country pack first. Runtime data may add unconfirmed candidates, but it
        // can never replace or erase the original curated tree.
        const countryPack = await ensureCountryPack(country.slug);
        if (!countryPack || state.selectedCountry?.slug !== country.slug) return;
        const sourceDraft = createCountryPackStarterMap(countryPack);
        state.countryDrafts.set(country.slug, {
          status: "ready",
          draft: sourceDraft,
          messages: []
        });
        render();
  
        const { draft: storedDraft } = await countryDraftClient.load(country.slug, { generate: false });
        if (!storedDraft || state.selectedCountry?.slug !== country.slug) return;
        for (const region of sourceDraft.regions ?? []) {
          appendUnconfirmedRegionCandidates(sourceDraft, region.name, storedDraft);
        }
        sourceDraft.changeNote = "";
        state.countryDrafts.set(country.slug, {
          status: "ready",
          draft: sourceDraft,
          messages: state.countryDrafts.get(country.slug)?.messages ?? []
        });
        render();
        return;
      }
  
      const { draft } = await countryDraftClient.load(country.slug, { generate: false });
      if (!draft || state.selectedCountry?.slug !== country.slug) return;
      const existing = state.countryDrafts.get(country.slug);
      if (existing?.status === "loading" || existing?.isSending) return;
      state.countryDrafts.set(country.slug, {
        status: "ready",
        draft,
        messages: existing?.messages ?? []
      });
      render();
    } catch {
      // Stored starter maps are optional runtime artifacts.
    }
  }
  
  async function requestCountryDraftInfluence(country, rawInstruction, { target = "starter-map" } = {}) {
    const instruction = String(rawInstruction ?? "").trim();
    if (!instruction) return;
  
    const existing = state.countryDrafts.get(country.slug);
    if (existing?.status === "loading" || existing?.isSending) return;
  
    const userMessage = scopedDraftMessage({ role: "user", text: instruction }, target);
    const processingMessage = scopedDraftMessage(
      {
        role: "assistant",
        status: "processing",
        text: "Processing your instruction and updating the unconfirmed starter map."
      },
      target
    );
    const messages = [...(existing?.messages ?? []), userMessage, processingMessage].slice(-12);
    state.countryDrafts.set(country.slug, {
      ...existing,
      status: existing?.draft ? "ready" : "loading",
      isSending: true,
      messages
    });
    render();
  
    try {
      const { draft, message } = await countryDraftClient.influence({
        countrySlug: country.slug,
        instruction,
        target,
        currentDraft: existing?.draft ?? null
      });
      const assistantMessage = scopedDraftMessage(
        {
          ...(message ?? { role: "assistant", text: "Starter map updated. All candidates remain unconfirmed." }),
          status: "done"
        },
        target
      );
      state.countryDrafts.set(country.slug, {
        status: "ready",
        draft,
        isSending: false,
        confirmation: null,
        messages: replaceLatestProcessingMessage(messages, assistantMessage, target).slice(-12)
      });
    } catch (error) {
      const errorMessage = scopedDraftMessage(
        { role: "assistant", status: "error", text: explainClickError(error) },
        target
      );
      state.countryDrafts.set(country.slug, {
        ...existing,
        status: existing?.draft ? "ready" : "failed",
        isSending: false,
        confirmation: existing?.confirmation ?? null,
        messages: replaceLatestProcessingMessage(messages, errorMessage, target).slice(-12),
        error: explainClickError(error)
      });
    }
    render();
  }
  
  function replaceLatestProcessingMessage(messages, replacement, target) {
    const nextMessages = [...(messages ?? [])];
    for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
      const message = nextMessages[index];
      if (message.role === "assistant" && message.status === "processing" && message.target === target) {
        nextMessages[index] = replacement;
        return nextMessages;
      }
    }
    return [...nextMessages, replacement];
  }
  
  async function requestCountryDraftApproval(country, { target, approved, recursive = false }) {
    const existing = state.countryDrafts.get(country.slug);
    if (!existing?.draft || existing.isSending || existing.status === "loading" || existing.isApproving) return;
    const scrollSnapshot = captureCountryShellScroll();
  
    state.countryDrafts.set(country.slug, {
      ...existing,
      isApproving: true,
      approvalError: null
    });
    render();
    restoreCountryShellScroll(scrollSnapshot);
  
    try {
      const payload = await countryDraftClient.approve({
        countrySlug: country.slug,
        currentDraft: existing.draft,
        target,
        approved,
        recursive
      });
      state.countryDrafts.set(country.slug, {
        ...existing,
        status: "ready",
        isApproving: false,
        approvalError: null,
        draft: payload.draft,
        messages: payload.message
          ? [...(existing.messages ?? []), payload.message].slice(-8)
          : existing.messages ?? []
      });
    } catch (error) {
      const message = explainClickError(error);
      state.countryDrafts.set(country.slug, {
        ...existing,
        isApproving: false,
        approvalError: message
      });
      showAppToast({
        tone: "error",
        title: "Curation update failed",
        message
      });
    }
    render();
    restoreCountryShellScroll(scrollSnapshot);
  }
  
  async function requestCountryDraftConfirmation(country) {
    const existing = state.countryDrafts.get(country.slug);
    if (!existing?.draft || existing.isConfirming || existing.isSending || existing.status === "loading") return;
  
      state.countryDrafts.set(country.slug, {
        ...existing,
        isConfirming: true,
        confirmationError: null
      });
    render();
  
    try {
      const confirmation = await countryDraftClient.confirm({
        countrySlug: country.slug,
        currentDraft: existing.draft
      });
      state.countryDrafts.set(country.slug, {
        ...existing,
        status: "ready",
        isConfirming: false,
        confirmationError: null,
        confirmation
      });
    } catch (error) {
      const message = explainClickError(error);
      state.countryDrafts.set(country.slug, {
        ...existing,
        status: "ready",
        isConfirming: false,
        confirmationError: message,
        messages: [
          ...(existing.messages ?? []),
          { role: "assistant", text: message }
        ].slice(-8)
      });
    }
    render();
  }
  
  async function requestCountryRuntimeCacheFlush(country, { confirm = true, scope = "all" } = {}) {
    const existing = state.countryCacheFlushes.get(country.slug);
    if (existing?.status === "loading") return false;
    const visualsOnly = scope === "visuals";
    if (confirm) {
      const confirmed = window.confirm(
        visualsOnly
          ? `Reset generated visuals for ${country.name}? This clears generated map illustrations, image jobs, ambience, and AI click understanding. Starter-map builder information, reference photos, and review artifacts stay.`
          : `Reset all runtime artifacts for ${country.name}? This clears generated images, click data, stored starter-map artifacts, and review artifacts. Source-controlled country pack data is not changed.`
      );
      if (!confirmed) return false;
    }
  
    state.countryCacheFlushes.set(country.slug, {
      status: "loading",
      scope,
      message: visualsOnly
        ? `Clearing generated ${country.name} map visuals.`
        : `Clearing generated ${country.name} runtime artifacts.`
    });
    render();
  
    try {
      const result = await flushCountryRuntimeCache({
        countrySlug: country.slug,
        scope,
        fetchFn: (path, options) => fetch(apiPath(path), options)
      });
      clearCountryGeneratedState(country.slug);
      if (visualsOnly) {
        state.placeImageRefreshes.delete(country.slug);
      }
      if (!visualsOnly) {
        state.countryDrafts.delete(country.slug);
        state.checkedStoredDrafts.delete(country.slug);
      }
      state.countryCacheFlushes.set(country.slug, {
        status: "ready",
        scope,
        message: visualsOnly
          ? "Generated map visuals and AI click understanding were cleared. Starter-map builder information and reference photos were kept."
          : "Generated runtime artifacts were cleared. Open the map or rebuild starter info to create fresh data."
      });
      render();
      showAppToast({
        title: visualsOnly ? "Generated visuals reset" : "Runtime artifacts reset",
        message: visualsOnly
          ? "Map illustrations, visual cache, and AI click understanding were cleared. Builder information and reference photos were kept."
          : "Generated runtime artifacts were cleared."
      });
      return true;
    } catch (error) {
      const message = explainClickError(error);
      state.countryCacheFlushes.set(country.slug, {
        status: "failed",
        scope,
        message
      });
      render();
      showAppToast({
        title: visualsOnly ? "Generated visuals were not reset" : "Runtime artifacts were not reset",
        message: `No changes were completed. ${message}`,
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }
  
  async function requestPlaceImageReset(country, { place = "" } = {}) {
    const normalizedPlace = String(place ?? "").trim();
    const isSinglePlace = Boolean(normalizedPlace);
    const scrollSnapshot = captureCountryShellScroll();
  
    try {
      await placeImageClient.reset({
        countrySlug: country.slug,
        ...(isSinglePlace ? { place: normalizedPlace } : {})
      });
      const refresh = Date.now();
      if (isSinglePlace) {
        const placeKey = getPlaceImageRefreshKey(country.slug, normalizedPlace);
        state.placeImageRefreshes.set(placeKey, refresh);
        state.placeImageFeedbacks.delete(placeKey);
      } else {
        state.placeImageRefreshes.set(country.slug, refresh);
      }
      render();
      restoreCountryShellScroll(scrollSnapshot);
      showAppToast({
        title: isSinglePlace ? "Reference photo reset" : "Reference photos reset",
        message: isSinglePlace
          ? `${normalizedPlace} photo cache was cleared. Searching again now.`
          : `${country.name} starter-map photo cache was cleared. Searching again now.`
      });
      return true;
    } catch (error) {
      const message = explainClickError(error);
      showAppToast({
        title: isSinglePlace ? "Reference photo was not reset" : "Reference photos were not reset",
        message: `No photo cache was cleared. ${message}`,
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }
  
  async function requestPlaceImageFeedback(country, place, feedback) {
    const normalizedPlace = String(place ?? "").trim();
    const normalizedFeedback = String(feedback ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, APP_CONFIG.placeImages.feedbackMaxLength);
    if (!normalizedPlace || !normalizedFeedback) return false;
    const scrollSnapshot = captureCountryShellScroll();
  
    try {
      await placeImageClient.submitFeedback({
        countrySlug: country.slug,
        place: normalizedPlace,
        feedback: normalizedFeedback
      });
      const placeKey = getPlaceImageRefreshKey(country.slug, normalizedPlace);
      state.placeImageFeedbacks.set(placeKey, normalizedFeedback);
      state.placeImageRefreshes.set(placeKey, Date.now());
      render();
      restoreCountryShellScroll(scrollSnapshot);
      showAppToast({
        title: "Searching for a better photo",
        message: `Exa is searching again for ${normalizedPlace} using your feedback. Curated travel data was not changed.`
      });
      return true;
    } catch (error) {
      showAppToast({
        title: "Photo feedback was not sent",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }
  
  async function requestPlaceImagePromptSuggestions(country, {
    place,
    context = "",
    kind = "region",
    currentFeedback = ""
  } = {}) {
    try {
      const payload = await placeImageClient.requestSuggestions({
        countrySlug: country.slug,
        place: String(place ?? "").trim(),
        context: String(context ?? "").trim(),
        kind: String(kind ?? "region").trim(),
        currentFeedback: String(currentFeedback ?? "").trim()
      });
      const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
      return {
        source: payload?.source === "llm" ? "llm" : "curated-fallback",
        suggestions: suggestions
        .map((suggestion) => String(suggestion ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, APP_CONFIG.placeImages.feedbackMaxLength))
        .filter(Boolean)
        .slice(0, APP_CONFIG.placeImages.promptSuggestionLimit)
      };
    } catch (error) {
      showAppToast({
        title: "Prompt suggestions unavailable",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.promptErrorToastDurationMs
      });
      return { source: "curated-fallback", suggestions: [] };
    }
  }
  
  async function loadDraftPhotoHistory(backdrop, country, place) {
    const history = backdrop.querySelector("[data-draft-photo-history]");
    const image = backdrop.querySelector(".draft-photo-lightbox-image");
    if (!history || !image) return;
  
    try {
      const payload = await placeImageClient.loadHistory({ countrySlug: country.slug, place });
      let items = Array.isArray(payload?.items) ? payload.items.filter((item) => item?.id && item?.imageUrl) : [];
      if (items.length < 2 || draftPhotoLightbox !== backdrop) return;
  
      let index = Math.max(0, items.findIndex((item) => item.active));
      const previous = history.querySelector("[data-draft-photo-previous]");
      const next = history.querySelector("[data-draft-photo-next]");
      const keep = history.querySelector("[data-draft-photo-keep]");
      const deleteButton = history.querySelector("[data-draft-photo-delete]");
      const label = history.querySelector("[data-draft-photo-history-label]");
      const show = (nextIndex) => {
        index = Math.max(0, Math.min(nextIndex, items.length - 1));
        const item = items[index];
        image.src = appendPlaceImageHistoryRequest(item.imageUrl, item.id);
        label.textContent = `${item.active ? "Current" : "Saved"} ${index + 1} of ${items.length}`;
        previous.disabled = index === 0;
        next.disabled = index === items.length - 1;
        keep.disabled = item.active;
        keep.textContent = item.active ? "Current photo" : "Keep this photo";
        deleteButton.disabled = false;
        deleteButton.textContent = "Delete photo";
      };
      previous.addEventListener("click", () => show(index - 1));
      next.addEventListener("click", () => show(index + 1));
      keep.addEventListener("click", async () => {
        const item = items[index];
        if (item.active) return;
        keep.disabled = true;
        keep.textContent = "Keeping photo";
        const didKeep = await requestPlaceImageHistorySelection(country, place, item.id);
        if (didKeep) closeDraftPhotoLightbox();
        else show(index);
      });
      deleteButton.addEventListener("click", async () => {
        const item = items[index];
        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting photo";
        const result = await requestPlaceImageHistoryDelete(country, place, item.id);
        if (!result) {
          show(index);
          return;
        }
  
        if (result.activeDeleted) {
          const placeKey = getPlaceImageRefreshKey(country.slug, place);
          state.placeImageFeedbacks.delete(placeKey);
          state.placeImageRefreshes.set(placeKey, Date.now());
          render();
          closeDraftPhotoLightbox();
          return;
        }
  
        items = Array.isArray(result.items) ? result.items.filter((entry) => entry?.id && entry?.imageUrl) : [];
        if (items.length < 2) {
          closeDraftPhotoLightbox();
          return;
        }
        show(Math.min(index, items.length - 1));
      });
      history.hidden = false;
      show(index);
    } catch {
      // History is an optional review aid. The current reference photo remains usable.
    }
  }
  
  function appendPlaceImageHistoryRequest(imageUrl, entryId) {
    const separator = imageUrl.includes("?") ? "&" : "?";
    return `${imageUrl}${separator}history=${encodeURIComponent(entryId)}&view=${PLACE_IMAGE_REQUEST_SESSION}`;
  }
  
  async function requestPlaceImageHistorySelection(country, place, entryId) {
    const scrollSnapshot = captureCountryShellScroll();
    try {
      await placeImageClient.selectHistoryEntry({
        countrySlug: country.slug,
        place,
        entryId
      });
      const placeKey = getPlaceImageRefreshKey(country.slug, place);
      state.placeImageFeedbacks.delete(placeKey);
      state.placeImageRefreshes.set(placeKey, Date.now());
      render();
      restoreCountryShellScroll(scrollSnapshot);
      showAppToast({
        title: "Reference photo kept",
        message: `${place} now uses the saved photo you selected. Curated travel data was not changed.`
      });
      return true;
    } catch (error) {
      showAppToast({
        title: "Reference photo was not changed",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return false;
    }
  }
  
  async function requestPlaceImageHistoryDelete(country, place, entryId) {
    try {
      const payload = await placeImageClient.deleteHistoryEntry({
        countrySlug: country.slug,
        place,
        entryId
      });
      showAppToast({
        title: payload.activeDeleted ? "Current photo deleted" : "Saved photo deleted",
        message: payload.activeDeleted
          ? `${place} will search for a fresh reference photo. Saved history and curated travel data were kept.`
          : `${place} history was updated. Curated travel data was not changed.`
      });
      return payload;
    } catch (error) {
      showAppToast({
        title: "Saved photo was not deleted",
        message: explainClickError(error),
        tone: "error",
        durationMs: APP_CONFIG.notifications.errorToastDurationMs
      });
      return null;
    }
  }
  
  async function resetCountryAndOpenMap(country) {
    enterCountryLanding();
    state.countryCacheFlushes.set(country.slug, {
      status: "loading",
      message: `Preparing ${country.name}: clearing generated cache.`
    });
    render();
  
    const flushed = await requestCountryRuntimeCacheFlush(country, { confirm: false });
    if (!flushed) {
      enterCountryShell(country);
      return;
    }
  
    enterCountryShell(country, { replaceUrl: true });
    const rebuilt = await requestCountryDraft(country, { force: true });
    if (!rebuilt) return;
  
    const pack = await ensureCountryPack(country.slug);
    if (pack) {
      enterMappedCountry(pack);
    }
  }
  
  async function resetCountry(country) {
    state.countryCacheFlushes.set(country.slug, {
      status: "loading",
      message: `Resetting ${country.name}: clearing generated cache.`
    });
    render();
  
    const flushed = await requestCountryRuntimeCacheFlush(country, { confirm: false });
    if (!flushed) return;
  
    await requestCountryDraft(country, { force: true });
  }
  
  return {
    reorderCurrentDraftItems,
    deleteCurrentDraftItem,
    editUnconfirmedDraftCandidate,
    captureCountryShellScroll,
    restoreCountryShellScroll,
    openDraftPhotoLightbox,
    scopeInstructionToCandidate,
    renderCountryLanding,
    canOpenCountryExplorer,
    renderCountryShell,
    loadImageQualityPreference,
    hasStoredImageQualityPreference,
    storeImageQualityPreference,
    showAppToast,
    dismissAppToast,
    getDraftUiState,
    renderDraftButtonTooltip,
    renderGenAiIcon,
    renderResetIcon,
    buildPlaceImageUrl,
    requestCountryDraft,
    loadStoredCountryDraft,
    requestCountryDraftInfluence,
    requestCountryDraftApproval,
    requestCountryDraftConfirmation,
    requestCountryRuntimeCacheFlush,
    requestPlaceImageReset,
    resetCountryAndOpenMap,
    resetCountry,
  };
}
