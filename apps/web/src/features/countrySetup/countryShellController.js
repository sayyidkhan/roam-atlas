export function createCountryShellController(dependencies) {
  const {
    canOpenCountryExplorer,
    captureCountryShellScroll,
    clearCountryGeneratedState,
    deleteCurrentDraftItem,
    editUnconfirmedDraftCandidate,
    elements,
    ensureCountryPack,
    enterCountryLanding,
    enterMappedCountry,
    imageQualityLabel,
    normalizeImageQuality,
    openDraftPhotoLightbox,
    render,
    reorderCurrentDraftItems,
    requestCountryDraft,
    requestCountryDraftApproval,
    requestCountryDraftConfirmation,
    requestCountryDraftInfluence,
    requestCountryRuntimeCacheFlush,
    requestPlaceImageReset,
    resetCountry,
    resetCountryAndOpenMap,
    restoreCountryShellScroll,
    scopeInstructionToCandidate,
    showAppToast,
    showBootstrapError,
    state,
    storeImageQualityPreference,
  } = dependencies;

  function bindCountryShell() {
    elements.countryShell.addEventListener("click", (event) => {
      const action = event.target.closest("[data-country-action]")?.dataset.countryAction;
      if (action === "set-image-quality") {
        const button = event.target.closest("[data-image-quality]");
        const imageQuality = normalizeImageQuality(button?.dataset.imageQuality);
        if (imageQuality === state.imageQuality) return;
        const scrollSnapshot = captureCountryShellScroll();
        state.imageQuality = imageQuality;
        storeImageQualityPreference(imageQuality);
        if (state.selectedCountry) clearCountryGeneratedState(state.selectedCountry.slug);
        render();
        restoreCountryShellScroll(scrollSnapshot);
        showAppToast({
          tone: "success",
          eyebrow: "IMAGE QUALITY UPDATED",
          title: `${imageQualityLabel(imageQuality)} quality selected`,
          message: "New and regenerated illustrations will use this quality. Existing images from other quality tiers will not be reused."
        });
        return;
      }
      if (action === "countries") {
        enterCountryLanding();
        return;
      }
      if (action === "country-map" && state.selectedCountry && canOpenCountryExplorer(state.selectedCountry)) {
        ensureCountryPack(state.selectedCountry.slug)
          .then((pack) => enterMappedCountry(pack))
          .catch(showBootstrapError);
        return;
      }
      if (action === "build-starter-map" && state.selectedCountry) {
        const draftState = state.countryDrafts.get(state.selectedCountry.slug);
        requestCountryDraft(state.selectedCountry, {
          force: Boolean(draftState?.draft),
          preserveScroll: Boolean(draftState?.draft)
        });
        return;
      }
      if (action === "reset-country" && state.selectedCountry) {
        resetCountry(state.selectedCountry);
        return;
      }
      if (action === "reset-generated-visuals" && state.selectedCountry) {
        requestCountryRuntimeCacheFlush(state.selectedCountry, { confirm: false, scope: "visuals" });
        return;
      }
      if (action === "reset-reference-photos" && state.selectedCountry) {
        state.countryDraftToolMenuOpen.delete(state.selectedCountry.slug);
        requestPlaceImageReset(state.selectedCountry);
        return;
      }
      if (action === "reset-place-photo" && state.selectedCountry) {
        const button = event.target.closest("[data-country-action='reset-place-photo']");
        const place = button?.dataset.placeName ?? "";
        requestPlaceImageReset(state.selectedCountry, { place });
        return;
      }
      if (action === "reset-metadata" && state.selectedCountry) {
        state.countryDraftToolMenuOpen.delete(state.selectedCountry.slug);
        requestCountryDraft(state.selectedCountry, { force: true, preserveScroll: true });
        return;
      }
      if (action === "toggle-starter-tools" && state.selectedCountry) {
        const slug = state.selectedCountry.slug;
        const scrollSnapshot = captureCountryShellScroll();
        state.countryDraftToolMenuOpen.set(slug, !state.countryDraftToolMenuOpen.get(slug));
        render();
        restoreCountryShellScroll(scrollSnapshot);
        return;
      }
      if (action === "reset-open-country" && state.selectedCountry) {
        resetCountryAndOpenMap(state.selectedCountry);
        return;
      }
      if (action === "confirm-starter-map" && state.selectedCountry) {
        requestCountryDraftConfirmation(state.selectedCountry);
        return;
      }
      if (action === "approve-draft-item" && state.selectedCountry) {
        const button = event.target.closest("[data-country-action='approve-draft-item']");
        const target = button?.dataset.approveTarget;
        if (!target) return;
        const approved = button.dataset.approved !== "true";
        requestCountryDraftApproval(state.selectedCountry, {
          target,
          approved
        });
        return;
      }
      if (action === "approve-draft-descendants" && state.selectedCountry) {
        const button = event.target.closest("[data-country-action='approve-draft-descendants']");
        const target = button?.dataset.approveTarget;
        if (!target) return;
        requestCountryDraftApproval(state.selectedCountry, {
          target,
          approved: button.dataset.approved !== "true",
          recursive: true
        });
        return;
      }
      if (action === "delete-draft-item" && state.selectedCountry) {
        const button = event.target.closest("[data-country-action='delete-draft-item']");
        const list = button?.dataset.draftList;
        const index = Number(button?.dataset.draftIndex);
        const path = button?.dataset.draftPath;
        const label = button?.dataset.draftLabel ?? "this record";
        deleteCurrentDraftItem(state.selectedCountry, { list, index, path, label });
        return;
      }
      if (action === "edit-draft-candidate" && state.selectedCountry) {
        const button = event.target.closest("[data-country-action='edit-draft-candidate']");
        const path = button?.dataset.draftPath;
        if (!path) return;
        editUnconfirmedDraftCandidate(state.selectedCountry, path);
        return;
      }
      if (action === "toggle-action-guide" && state.selectedCountry) {
        const slug = state.selectedCountry.slug;
        const scrollSnapshot = captureCountryShellScroll();
        state.countryActionLegendOpen.set(slug, !state.countryActionLegendOpen.get(slug));
        render();
        restoreCountryShellScroll(scrollSnapshot);
        return;
      }
      if (action === "toggle-genai-prompt" && state.selectedCountry) {
        const slug = state.selectedCountry.slug;
        const scrollSnapshot = captureCountryShellScroll();
        const target = event.target.closest("[data-country-action]")?.dataset.genaiTarget ?? null;
        let shouldFocusPrompt = false;
        if (state.countryDraftGenAiOpen.get(slug) === target) {
          state.countryDraftGenAiOpen.delete(slug);
        } else {
          state.countryDraftGenAiOpen.set(slug, target);
          shouldFocusPrompt = true;
        }
        render();
        restoreCountryShellScroll(scrollSnapshot);
        if (shouldFocusPrompt) {
          focusOpenDraftGenAiTextarea(target);
        }
        return;
      }
      if (action === "flush-runtime-cache" && state.selectedCountry) {
        requestCountryRuntimeCacheFlush(state.selectedCountry);
      }
    });
  
    elements.countryShell.addEventListener("click", (event) => {
      const sectionTab = event.target.closest("[data-country-draft-section-tab]")?.dataset.countryDraftSectionTab;
      if (sectionTab && state.selectedCountry) {
        const scrollSnapshot = captureCountryShellScroll();
        state.countryDraftSectionTabs.set(state.selectedCountry.slug, sectionTab);
        render();
        restoreCountryShellScroll(scrollSnapshot);
      }
    });
  
    elements.countryShell.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-country-chat-form], [data-country-genai-form]");
      if (!form || !state.selectedCountry) return;
      event.preventDefault();
      const input = form.querySelector("[name='instruction']");
      const instruction = String(input?.value ?? "").trim();
      if (!instruction) return;
      const target = form.dataset.genaiTarget;
      requestCountryDraftInfluence(
        state.selectedCountry,
        target ? scopeInstructionToCandidate(target, instruction) : instruction,
        { target: target ?? "starter-map" }
      );
      input.value = "";
    });
  
    elements.countryShell.addEventListener("click", (event) => {
      const trigger = event.target.closest(".draft-item-photo-button");
      if (!trigger) return;
      const photo = trigger.querySelector(".draft-item-photo");
      if (!photo?.src) return;
      openDraftPhotoLightbox({
        src: photo.currentSrc || photo.src,
        placeName: trigger.dataset.placeName ?? "",
        context: trigger.dataset.placeContext ?? "",
        kind: trigger.dataset.placeKind ?? "region"
      });
    });
  
    elements.countryShell.addEventListener("dragstart", (event) => {
      const handle = event.target.closest("[data-draft-drag-handle]");
      if (!handle || !state.selectedCountry) return;
      const payload = {
        countrySlug: state.selectedCountry.slug,
        list: handle.dataset.draftList,
        fromIndex: Number(handle.dataset.draftIndex)
      };
      if (!payload.list || !Number.isInteger(payload.fromIndex)) return;
      state.countryDraftDrag = payload;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/json", JSON.stringify(payload));
      event.dataTransfer.setData("text/plain", `${payload.list}:${payload.fromIndex}`);
      handle.closest("[data-draft-sort-index]")?.classList.add("is-dragging");
    });
  
    elements.countryShell.addEventListener("dragover", (event) => {
      const target = event.target.closest("[data-draft-sort-index]");
      if (!target || !isSameDraftDragList(event, target)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDraftDropClasses();
      target.classList.add(getDraftDropClass(event, target));
    });
  
    elements.countryShell.addEventListener("dragleave", (event) => {
      const target = event.target.closest("[data-draft-sort-index]");
      if (target && !target.contains(event.relatedTarget)) {
        target.classList.remove("is-drop-before", "is-drop-after");
      }
    });
  
    elements.countryShell.addEventListener("drop", (event) => {
      const target = event.target.closest("[data-draft-sort-index]");
      if (!target || !state.selectedCountry) return;
      const payload = state.countryDraftDrag ?? readDraftDragPayload(event);
      if (!payload || payload.countrySlug !== state.selectedCountry.slug || payload.list !== target.dataset.draftList) return;
      event.preventDefault();
      const targetIndex = Number(target.dataset.draftSortIndex);
      const insertAfter = getDraftDropClass(event, target) === "is-drop-after";
      reorderCurrentDraftItems(state.selectedCountry, {
        list: payload.list,
        fromIndex: payload.fromIndex,
        targetIndex,
        insertAfter
      });
      clearDraftDragState();
    });
  
    elements.countryShell.addEventListener("dragend", () => {
      clearDraftDragState();
    });
  }
  
  function focusOpenDraftGenAiTextarea(target) {
    window.requestAnimationFrame(() => {
      const selector = target
        ? `.draft-genai-form[data-genai-target="${CSS.escape(target)}"] textarea[name="instruction"]`
        : `.draft-genai-form textarea[name="instruction"]`;
      elements.countryShell.querySelector(selector)?.focus({ preventScroll: true });
    });
  }
  
  function isSameDraftDragList(event, target) {
    const payload = state.countryDraftDrag ?? readDraftDragPayload(event);
    return Boolean(payload && payload.countrySlug === state.selectedCountry?.slug && payload.list === target.dataset.draftList);
  }
  
  function readDraftDragPayload(event) {
    const rawJson = event.dataTransfer?.getData("application/json");
    if (!rawJson) return null;
    try {
      const parsed = JSON.parse(rawJson);
      const fromIndex = Number(parsed.fromIndex);
      if (!parsed.countrySlug || !parsed.list || !Number.isInteger(fromIndex)) return null;
      return {
        countrySlug: parsed.countrySlug,
        list: parsed.list,
        fromIndex
      };
    } catch {
      return null;
    }
  }
  
  function getDraftDropClass(event, target) {
    const box = target.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2 ? "is-drop-after" : "is-drop-before";
  }
  
  function clearDraftDropClasses() {
    elements.countryShell
      .querySelectorAll(".is-drop-before, .is-drop-after")
      .forEach((item) => item.classList.remove("is-drop-before", "is-drop-after"));
  }
  
  function clearDraftDragState() {
    state.countryDraftDrag = null;
    elements.countryShell
      .querySelectorAll(".is-dragging")
      .forEach((item) => item.classList.remove("is-dragging"));
    clearDraftDropClasses();
  }
  
  return { bindCountryShell };
}
