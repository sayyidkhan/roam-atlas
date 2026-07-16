import { worldCountries } from "../data/countries.js";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  ensureCountryPack,
  getCountryPack,
  initCountryPackRegistry,
  isConfiguredCountryPack,
  isSourceControlledCountryPack
} from "../data/countryPacks/index.js";
import { ROAMATLAS_EXPERIENCE_CONFIG } from "../config/experienceConfig.js";
import { generatedTiles } from "../data/generatedTiles.js";
import { factConfidenceLabel } from "../domain/guardrails.js";
import { buildLoadingStepTrail } from "../domain/loadingSteps.js";
import { resolveFlipbookClick } from "../domain/flipbookPage.js";
import { PLACE_IMAGE_SELECTION_VERSION } from "../domain/placeImageSelection.js";
import { listNextArtworkDestinations } from "../domain/nextArtworkDestinations.js";
import { createCountryPackStarterMap } from "../domain/countryDraft.js";
import {
  appendUnconfirmedRegionCandidates,
  isDraftItemApproved
} from "../domain/countryDraftReview.js";
import {
  canonicalRouteForNode,
  findSceneIdForNode,
  resolveAppRoute,
  routeForCountryConfig,
  routeForCountryLanding,
} from "../domain/routes.js";

const state = {
  currentView: "countries",
  selectedCountry: null,
  activeCountrySlug: DEFAULT_COUNTRY_SLUG,
  activePack: null,
  experienceConfig: { ...ROAMATLAS_EXPERIENCE_CONFIG },
  countryQuery: "",
  countryDrafts: new Map(),
  countryDraftSectionTabs: new Map(),
  countryDraftGenAiOpen: new Map(),
  countryDraftToolMenuOpen: new Map(),
  countryDraftDrag: null,
  countryActionLegendOpen: new Map(),
  countryCacheFlushes: new Map(),
  placeImageRefreshes: new Map(),
  placeImageFeedbacks: new Map(),
  checkedStoredDrafts: new Set(),
  currentPage: null,
  currentSceneId: null,
  selectedNodeId: null,
  detailPanelMode: "hidden",
  detailOverride: null,
  history: [],
  pendingJob: null,
  artworkJobs: new Map(),
  artworkByScene: new Map(),
  artworkByPage: new Map(),
  prefetchRequests: new Set(),
  prefetchJobs: new Map(),
  prefetchSceneId: null,
  environmentPlans: new Map(),
  environmentPlanRequests: new Map(),
  artworkImageLoads: new Map(),
  isResolvingClick: false,
  activeNavigationRequestId: null,
  routeNotice: null
};

const COUNTRY_CARD_IMAGE_VERSION = "country-media-v7";
const COUNTRY_CARD_IMAGE_CONCURRENCY = 2;
const ARTWORK_POLL_INTERVAL_MS = 1600;
const ARTWORK_POLL_TIMEOUT_MS = 3 * 60 * 1000;
const ARTWORK_REQUEST_TIMEOUT_MS = 15 * 1000;
const ARTWORK_POLL_MAX_ATTEMPTS = Math.ceil(ARTWORK_POLL_TIMEOUT_MS / ARTWORK_POLL_INTERVAL_MS);
// The config view is often kept alive by an embedded browser while a local
// dev server restarts. Give every page instance a distinct image URL so an
// old endpoint response cannot be painted into a newly rendered thumbnail.
const PLACE_IMAGE_REQUEST_SESSION = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// A cold reference-photo lookup can include provider search, download, and
// cache writes. Do not tear down the browser image request while that work is
// still completing; cached follow-up loads are effectively immediate.
const DRAFT_PLACE_PHOTO_TIMEOUT_MS = 90 * 1000;
const ENVIRONMENT_PLAN_RETRY_DELAYS_MS = [0, 2000, 5000, 10000, 20000, 30000];
const ENVIRONMENT_PLAN_REQUEST_RETRY_MS = 3000;
let countryPhotoObserver = null;
let activeCountryPhotoLoads = 0;
let countryPhotoQueue = [];
let draftPhotoLightbox = null;
const prefetchPollers = new Map();
let prefetchRenderFrame = null;
let prefetchEpoch = 0;
let environmentPlanEpoch = 0;
let artworkAttemptSequence = 0;
let navigationRequestSequence = 0;
let navigationAbortController = null;
let appToastTimer = null;

const elements = {
  landing: document.querySelector("#country-landing"),
  countryShell: document.querySelector("#country-shell"),
  countryGrid: document.querySelector("#country-grid"),
  countrySearch: document.querySelector("#country-search"),
  countryCount: document.querySelector("#country-count"),
  countryNotice: document.querySelector("#country-notice"),
  viewport: document.querySelector("#scroll-viewport"),
  sceneTitle: document.querySelector("#scene-title"),
  breadcrumb: document.querySelector("#breadcrumb"),
  stage: document.querySelector("#scroll-stage"),
  detailSheet: document.querySelector("#detail-sheet"),
  nodeDetail: document.querySelector("#node-detail"),
  countryButton: document.querySelector("#country-button"),
  backButton: document.querySelector("#back-button"),
  closeDetail: document.querySelector("#close-detail")
};

bootstrap();

window.addEventListener("popstate", () => {
  cancelPendingNavigation();
  applyRouteFromLocation().catch(showBootstrapError);
});

elements.countryButton.addEventListener("click", () => {
  enterCountryLanding();
});

elements.backButton.addEventListener("click", () => {
  clearPendingJob();
  cancelPendingNavigation();
  const previous = state.history.pop();
  if (!previous) return;
  state.currentPage = previous.page;
  state.currentSceneId = previous.page.sceneId;
  state.selectedNodeId = previous.nodeId;
  setBrowserPath(
    canonicalRouteForNode(state.activeCountrySlug, previous.page.nodeId, state.activePack),
    { replace: true }
  );
  render();
});

elements.closeDetail.addEventListener("click", () => {
  state.detailOverride = null;
  state.detailPanelMode = "hidden";
  renderNodeDetail();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-dismiss-app-toast]")) return;
  dismissAppToast();
});

elements.detailSheet.addEventListener("click", (event) => {
  const action = event.target.closest("[data-detail-action]")?.dataset.detailAction;
  if (action === "expand") {
    state.detailPanelMode = "expanded";
    renderNodeDetail();
    return;
  }
  if (action === "collapse") {
    state.detailPanelMode = "compact";
    renderNodeDetail();
  }
});

function render() {
  const focusKey = captureExplorerFocusKey();
  const isCountryLanding = state.currentView === "countries";
  const isCountryShell = state.currentView === "country";
  elements.landing.classList.toggle("is-hidden", !isCountryLanding);
  elements.countryShell.classList.toggle("is-hidden", !isCountryShell);
  elements.viewport.classList.toggle("is-hidden", isCountryLanding || isCountryShell);

  if (isCountryLanding) {
    renderCountryLanding();
    return;
  }

  if (isCountryShell) {
    renderCountryShell();
    return;
  }

  if (!state.activePack) {
    elements.countryCount.textContent = "Loading country…";
    return;
  }

  renderScene();
  renderNodeDetail();
  if (state.routeNotice) {
    renderDetour(state.routeNotice);
  }
  elements.backButton.disabled = state.history.length === 0;
  elements.viewport.classList.toggle("is-busy", state.isResolvingClick || Boolean(state.pendingJob));
  restoreExplorerFocus(focusKey);
}

function captureExplorerFocusKey() {
  const activeElement = document.activeElement;
  if (!activeElement || !elements.viewport.contains(activeElement)) return null;
  return activeElement.dataset.roamFocusKey ?? null;
}

function restoreExplorerFocus(focusKey) {
  if (!focusKey) return;
  const target = [...elements.viewport.querySelectorAll("[data-roam-focus-key]")]
    .find((element) => element.dataset.roamFocusKey === focusKey);
  target?.focus({ preventScroll: true });
}

function bindCountryLanding() {
  elements.countrySearch.addEventListener("input", (event) => {
    state.countryQuery = event.target.value;
    renderCountryLanding();
  });

  elements.countryGrid.addEventListener("click", (event) => {
    const cardAction = event.target.closest("[data-country-card-action]");
    const card = event.target.closest("[data-country-code]");
    if (!card) return;
    const country = worldCountries.find((item) => item.code === card.dataset.countryCode);
    if (!country) return;

    if (event.target.closest(".country-card-menu") && !cardAction) {
      return;
    }

    if (cardAction) {
      const action = cardAction.dataset.countryCardAction;
      if (action === "config") {
        enterCountryShell(country);
        return;
      }
      if (action === "open") {
        openCountryFromLanding(country);
        return;
      }
    }

    openCountryFromLanding(country);
  });
}

function openCountryFromLanding(country) {
  if (isConfiguredCountryPack(country.slug)) {
    ensureCountryPack(country.slug)
      .then((pack) => enterMappedCountry(pack))
      .catch(showBootstrapError);
    return;
  }
  enterCountryShell(country);
}

function bindCountryShell() {
  elements.countryShell.addEventListener("click", (event) => {
    const action = event.target.closest("[data-country-action]")?.dataset.countryAction;
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
  nextItem.name = nextName.slice(0, 80);
  draft.changeNote = `Renamed unconfirmed candidate to ${nextItem.name}.`;
  const scrollSnapshot = captureCountryShellScroll();
  state.countryDrafts.set(country.slug, { ...existing, draft });
  render();
  restoreCountryShellScroll(scrollSnapshot);
  persistCountryDraftReorder(country, draft);
}

function getDraftNodeAtPath(draft, value) {
  const path = String(value ?? "").split(".").map(Number);
  let node = draft?.regions?.[path[0] - 1] ?? null;
  for (const index of path.slice(1)) node = node?.children?.[index - 1] ?? null;
  return node;
}

function removeDraftNodeAtPath(draft, value) {
  const path = String(value ?? "").split(".").map(Number);
  if (!path.length || path.some((index) => !Number.isInteger(index) || index < 1)) return null;
  const regions = [...(draft?.regions ?? [])];
  if (path.length === 1) {
    regions.splice(path[0] - 1, 1);
    return { ...draft, regions };
  }
  let parent = regions[path[0] - 1];
  for (const index of path.slice(1, -1)) parent = parent?.children?.[index - 1];
  if (!Array.isArray(parent?.children)) return null;
  parent.children = [...parent.children];
  parent.children.splice(path[path.length - 1] - 1, 1);
  return { ...draft, regions };
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
    const response = await fetch(apiPath("/api/country-draft/reorder"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        currentDraft: draft
      })
    });
    if (!response.ok) {
      throw new Error(await readResponseError(response, "Starter map reorder failed"));
    }
    const payload = await response.json();
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

function reorderArray(items, fromIndex, insertionIndex) {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    insertionIndex < 0 ||
    insertionIndex > items.length
  ) {
    return null;
  }
  let nextInsertionIndex = insertionIndex;
  if (fromIndex < nextInsertionIndex) {
    nextInsertionIndex -= 1;
  }
  if (fromIndex === nextInsertionIndex) return null;
  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(nextInsertionIndex, 0, moved);
  return nextItems;
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
            maxlength="240"
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
  elements.countryNotice.classList.remove("is-open");
  elements.countryNotice.replaceChildren();
  const query = normalizeCountryQuery(state.countryQuery);
  const filteredCountries = worldCountries.filter((country) => {
    if (!query) return true;
    return (
      normalizeCountryQuery(country.name).includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.displayCode.toLowerCase().includes(query)
    );
  });

  elements.countryCount.textContent = `${filteredCountries.length} of ${worldCountries.length} countries`;
  resetCountryPhotoQueue();
  const fragment = document.createDocumentFragment();
  for (const country of filteredCountries) {
    fragment.appendChild(renderCountryCard(country));
  }
  elements.countryGrid.replaceChildren(fragment);
  observeCountryCardPhotos(elements.countryGrid);
}

function renderCountryCard(country) {
  const pack = getCountryPack(country.slug);
  const isConfirmedPack = pack?.confidence !== "unconfirmed";
  const cardState = isConfirmedPack ? "mapped" : "available";
  const card = document.createElement("article");
  card.className = `country-card country-card--${cardState}`;
  card.dataset.countryCode = country.code;
  card.setAttribute("aria-label", `${country.name}, ${isConfirmedPack ? "source-reviewed explorer" : "starter explorer"}`);
  const picturePosition = getCountryPicturePosition(country.code);
  card.style.setProperty("--country-picture-x", picturePosition.x);
  card.style.setProperty("--country-picture-y", picturePosition.y);

  const photo = document.createElement("img");
  photo.className = "country-card-photo";
  photo.dataset.src = getCountryPhotoUrl(country);
  photo.alt = "";
  photo.loading = "lazy";
  photo.decoding = "async";
  photo.referrerPolicy = "no-referrer";
  photo.addEventListener("error", () => {
    photo.remove();
    card.classList.add("country-card--photo-fallback");
  });

  const visual = document.createElement("span");
  visual.className = "country-card-visual";

  const flag = document.createElement("img");
  flag.className = "country-flag";
  flag.src = getCountryFlagUrl(country.code, 160);
  flag.srcset = [
    `${getCountryFlagUrl(country.code, 80)} 80w`,
    `${getCountryFlagUrl(country.code, 160)} 160w`,
    `${getCountryFlagUrl(country.code, 320)} 320w`
  ].join(", ");
  flag.sizes = "(max-width: 720px) 72px, 96px";
  flag.alt = "";
  flag.loading = "lazy";
  flag.decoding = "async";
  flag.addEventListener("error", () => {
    flag.remove();
    visual.classList.add("country-card-visual--fallback");
    visual.textContent = country.displayCode;
  });
  visual.append(flag);

  const code = document.createElement("span");
  code.className = "country-code";
  code.textContent = country.displayCode;

  const title = document.createElement("span");
  title.className = "country-name";
  title.textContent = country.name;

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "country-status";
  openButton.setAttribute("data-country-card-action", "open");
  openButton.textContent = "Open";

  const menu = document.createElement("button");
  menu.type = "button";
  menu.className = "country-card-menu";
  menu.setAttribute("data-country-card-action", "config");
  menu.setAttribute("aria-label", `Configure ${country.name}`);
  menu.innerHTML = `
    <svg class="country-card-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2.05 2.05 0 0 1-2.9 2.9l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .52V20a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1-.52 1.7 1.7 0 0 0-1.88.34l-.06.06a2.05 2.05 0 0 1-2.9-2.9l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.52-1H4a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 .52-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2.05 2.05 0 0 1 2.9-2.9l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.52V4a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1 .52 1.7 1.7 0 0 0 1.88-.34l.06-.06a2.05 2.05 0 0 1 2.9 2.9l-.06.06A1.7 1.7 0 0 0 19.4 9c.16.36.35.7.52 1H20a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-.52 1Z"></path>
    </svg>
  `;

  const footer = document.createElement("span");
  footer.className = "country-card-footer";
  footer.append(title, openButton, code);

  card.append(photo, visual, menu, footer);
  return card;
}

function getCountryPhotoUrl(country) {
  return apiPath(
    `/api/country-image?countrySlug=${encodeURIComponent(country.slug)}&v=${COUNTRY_CARD_IMAGE_VERSION}`
  );
}

function observeCountryCardPhotos(container) {
  const photos = [...container.querySelectorAll(".country-card-photo[data-src]")];
  if (!("IntersectionObserver" in window)) {
    photos.forEach(queueCountryCardPhoto);
    return;
  }

  if (countryPhotoObserver) {
    countryPhotoObserver.disconnect();
  }

  countryPhotoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        queueCountryCardPhoto(entry.target);
        countryPhotoObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "520px 0px" }
  );

  photos.forEach((photo) => countryPhotoObserver.observe(photo));
}

function resetCountryPhotoQueue() {
  if (countryPhotoObserver) {
    countryPhotoObserver.disconnect();
    countryPhotoObserver = null;
  }
  countryPhotoQueue = [];
  activeCountryPhotoLoads = 0;
}

function queueCountryCardPhoto(photo) {
  if (!photo?.dataset?.src || photo.dataset.queued === "true") return;
  photo.dataset.queued = "true";
  countryPhotoQueue.push(photo);
  processCountryPhotoQueue();
}

function processCountryPhotoQueue() {
  while (activeCountryPhotoLoads < COUNTRY_CARD_IMAGE_CONCURRENCY && countryPhotoQueue.length > 0) {
    const photo = countryPhotoQueue.shift();
    if (!photo?.isConnected || !photo.dataset.src || photo.src) continue;
    activeCountryPhotoLoads += 1;
    const finish = () => {
      activeCountryPhotoLoads = Math.max(0, activeCountryPhotoLoads - 1);
      processCountryPhotoQueue();
    };
    photo.addEventListener("load", finish, { once: true });
    photo.addEventListener("error", finish, { once: true });
    loadCountryCardPhoto(photo);
  }
}

function loadCountryCardPhoto(photo) {
  if (!photo?.dataset?.src || photo.src) return;
  photo.src = photo.dataset.src;
  delete photo.dataset.src;
}

function getCountryFlagUrl(code, width) {
  return `https://flagcdn.com/w${width}/${String(code).toLowerCase()}.png`;
}

function getCountryPicturePosition(code) {
  const seed = String(code)
    .split("")
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 7), 0);
  return {
    x: `${12 + (seed % 76)}%`,
    y: `${14 + ((seed * 5) % 70)}%`
  };
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
  const isDraftLoading = draftState?.status === "loading" || draftState?.isSending;
  const isCacheFlushing = flushState?.status === "loading";
  const isActionLegendOpen = Boolean(state.countryActionLegendOpen.get(country.slug));
  const mapAction = canOpenMap
    ? renderCountryActionButton({
        action: "country-map",
        label: `Open ${country.name} map`,
        info: `Open the current ${country.name} explorer.`
      })
    : renderCountryActionButton({
        action: "build-starter-map",
        label: `Build ${country.name} map`,
        info: isConfiguredCountryPack(country.slug)
          ? `Load the original source-controlled ${country.name} map.`
          : `Create an unconfirmed starter map for ${country.name}.`
      });

  elements.countryShell.innerHTML = `
    <article class="country-shell-panel">
      <header class="country-config-hero">
        <div>
          <p class="eyebrow">${country.code} country config</p>
          <h1>${country.name}</h1>
          <p>Manage ${country.name} generated map data and starter information before opening the explorer.</p>
        </div>
        ${renderCountryActionGuide(country, { canOpenMap, isOpen: isActionLegendOpen })}
      </header>

      <section class="country-shell-actions" aria-label="Manual country actions">
        ${renderCountryActionButton({
          action: "countries",
          label: "Back to countries",
          info: "Return to the full country list."
        })}
        ${renderCountryActionButton({
          action: "reset-generated-visuals",
          label: isCacheFlushing ? "Resetting visuals" : "Reset Generated Visuals",
          info: `Delete generated ${country.name} map illustrations, image jobs, and ambience cache. Starter-map builder information and reference photos stay.`,
          disabled: isCacheFlushing
        })}
        ${mapAction}
      </section>
      ${renderCountryCacheFlushNotice(flushState)}
      ${renderCountryDraftPanel(country, draftState)}
    </article>
  `;
  hydrateDraftPlacePhotos(elements.countryShell);
}

function renderCountryActionGuide(country, { canOpenMap, isOpen }) {
  return `
    <div class="country-action-guide">
      <button
        type="button"
        class="ghost-button country-action-guide-button"
        data-country-action="toggle-action-guide"
        aria-expanded="${isOpen}"
        aria-controls="country-action-legend"
      >Action guide</button>
      ${isOpen ? renderCountryActionLegend(country, { canOpenMap }) : ""}
    </div>
  `;
}

function renderCountryActionLegend(country, { canOpenMap }) {
  const isSourceControlled = isConfiguredCountryPack(country.slug);
  const mapLabel = canOpenMap ? `Open ${country.name} map` : `Build ${country.name} map`;
  const mapDescription = canOpenMap
    ? `Enter the current ${country.name} explorer using the available starter or curated map data.`
    : isSourceControlled
      ? `Load the original source-controlled ${country.name} map before opening the explorer.`
      : `Create an unconfirmed starter map for ${country.name} before opening the explorer.`;
  return `
    <section class="country-action-legend" id="country-action-legend" aria-label="Country action legend">
      <p class="eyebrow">Action guide</p>
      <dl>
        <div>
          <dt>Back to countries</dt>
          <dd>Return to the full country picker without changing this starter map.</dd>
        </div>
        <div>
          <dt>Reset Generated Visuals</dt>
          <dd>Clear cached map illustrations, image jobs, and ambience cache for ${escapeHtml(country.name)}. Starter-map builder information and reference photos stay.</dd>
        </div>
        <div>
          <dt>${escapeHtml(mapLabel)}</dt>
          <dd>${escapeHtml(mapDescription)}</dd>
        </div>
      </dl>
    </section>
  `;
}

function renderCountryActionButton({ action, label, info, disabled = false }) {
  return `
    <button
      type="button"
      class="ghost-button country-action-button"
      data-country-action="${escapeHtml(action)}"
      title="${escapeHtml(info)}"
      aria-label="${escapeHtml(`${label}. ${info}`)}"
      ${disabled ? "disabled" : ""}
    >
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function renderCountryCacheFlushNotice(flushState) {
  if (!flushState || !["loading", "failed"].includes(flushState.status)) return "";
  const visualsOnly = flushState.scope === "visuals";
  const title = flushState.status === "ready"
    ? visualsOnly ? "Generated visuals reset" : "Runtime artifacts reset"
    : flushState.status === "failed"
    ? visualsOnly ? "Visual reset failed" : "Runtime reset failed"
    : visualsOnly ? "Resetting generated visuals" : "Resetting runtime artifacts";
  const message = flushState.message ?? (visualsOnly
    ? "Clearing generated images and visual cache."
    : "Clearing generated runtime artifacts.");
  const className = flushState.status === "failed"
    ? "cache-flush-notice cache-flush-notice--failed"
    : "cache-flush-notice";
  return `
    <section class="${className}" aria-live="polite">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </section>
  `;
}

function showAppToast({ title, message, tone = "success", durationMs = 5200 }) {
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
  const genAiContext = {
    openTarget: state.countryDraftGenAiOpen.get(country.slug) ?? null,
    draftState,
    countrySlug: country.slug
  };
  const regions = draft.regions.length
    ? draft.regions.map((region, index) => renderDraftRegion(region, [index + 1], genAiContext)).join("")
    : `<li class="muted">No candidate regions were returned.</li>`;
  const themes = draft.themes.length
    ? draft.themes.map((theme, index) => renderDraftTheme(theme, [index + 1], genAiContext)).join("")
    : `<li class="muted">No candidate themes were returned.</li>`;
  const activeSectionTab = state.countryDraftSectionTabs.get(country.slug) ?? "regions";
  const editModal = getDraftEditModalContext(draft, genAiContext.openTarget);
  const isDraftBusy = Boolean(draftState?.status === "loading" || draftState?.isSending);
  const isStarterToolMenuOpen = Boolean(state.countryDraftToolMenuOpen.get(country.slug));
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
            <button
              type="button"
              role="tab"
              class="${activeSectionTab === "regions" ? "is-active" : ""}"
              aria-selected="${activeSectionTab === "regions"}"
              data-country-draft-section-tab="regions"
            >Candidate regions (${draft.regions.length})</button>
            <button
              type="button"
              role="tab"
              class="${activeSectionTab === "themes" ? "is-active" : ""}"
              aria-selected="${activeSectionTab === "themes"}"
              data-country-draft-section-tab="themes"
            >Research themes (${draft.themes.length})</button>
          </div>
        </div>
        <div class="draft-section-actions" aria-label="Starter map tools">
          ${renderDraftResetButton(country, { disabled: isDraftBusy, isOpen: isStarterToolMenuOpen })}
          <button
            type="button"
            class="draft-genai-button ${genAiContext.openTarget === "starter-map" ? "is-active" : ""}"
            data-country-action="toggle-genai-prompt"
            data-genai-target="starter-map"
            data-tooltip-title="GenAI edit"
            data-tooltip="${escapeHtml(starterMapGenAiTooltip)}"
            aria-label="Edit starter map with GenAI"
            aria-haspopup="dialog"
            aria-expanded="${genAiContext.openTarget === "starter-map"}"
          >${renderGenAiIcon()}<span class="visually-hidden">Edit starter map with GenAI</span>${renderDraftButtonTooltip("GenAI edit", starterMapGenAiTooltip)}</button>
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
  if (activeSectionTab === "themes") {
    return `
      <p class="draft-section-intro">
        Research themes group regions by travel style or category. They describe patterns across places, not separate destinations.
      </p>`;
  }

  return `
    <p class="draft-section-intro">
      Candidate regions are possible map chapters for this country. Review, approve, and add sources before using them as verified travel facts.
    </p>`;
}

function renderDraftResetButton(country, { disabled = false, isOpen = false } = {}) {
  const rebuildSummary = `Refresh regions, summary, and themes.`;
  const photoSummary = `Clear cached thumbnails and search again.`;
  return `
    <div class="draft-reset-menu">
      <button
        type="button"
        class="draft-tool-menu-button ${isOpen ? "is-active" : ""}"
        data-country-action="toggle-starter-tools"
        aria-label="Open starter-map actions"
        aria-haspopup="menu"
        aria-expanded="${isOpen}"
        ${disabled ? "disabled" : ""}
      ><span class="draft-tool-menu-dots" aria-hidden="true"><span></span><span></span><span></span></span></button>
      ${isOpen ? `
        <div class="draft-tool-menu" role="menu" aria-label="Starter-map actions">
          <button
            type="button"
            class="draft-tool-menu-item"
            data-country-action="reset-metadata"
            role="menuitem"
            ${disabled ? "disabled" : ""}
          >
            ${renderResetIcon()}
            <span>
              <strong>Rebuild starter info</strong>
              <small>${escapeHtml(rebuildSummary)}</small>
            </span>
          </button>
          <button
            type="button"
            class="draft-tool-menu-item"
            data-country-action="reset-reference-photos"
            role="menuitem"
            ${disabled ? "disabled" : ""}
          >
            ${renderResetIcon()}
            <span>
              <strong>Reset photos</strong>
              <small>${escapeHtml(photoSummary)}</small>
            </span>
          </button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderDraftTree(countryName, childItemsHtml, childCount) {
  return `
    <ul class="draft-tree">
      <li class="draft-tree-root">
        <div class="draft-tree-root-header">
          <div>
            <strong>${escapeHtml(countryName)}</strong>
            <span class="muted">${childCount} parent node${childCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <ul class="draft-list">${childItemsHtml}</ul>
      </li>
    </ul>
  `;
}

function renderDraftGenAiButton(target, label, genAiContext) {
  if (!genAiContext) return "";
  const isOpen = genAiContext.openTarget === target;
  const tooltip = `Suggest edits for ${label}. Changes stay unconfirmed until source review.`;
  return `
    <button
      type="button"
      class="draft-genai-button ${isOpen ? "is-active" : ""}"
      data-country-action="toggle-genai-prompt"
      data-genai-target="${escapeHtml(target)}"
      data-tooltip-title="GenAI edit"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="Edit ${escapeHtml(label)} with GenAI"
      aria-haspopup="dialog"
      aria-expanded="${isOpen}"
    >${renderGenAiIcon()}<span class="visually-hidden">Edit ${escapeHtml(label)} with GenAI</span>${renderDraftButtonTooltip("GenAI edit", tooltip)}</button>
  `;
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

function getDraftEditModalContext(draft, target) {
  if (!target) return null;
  if (target === "starter-map") {
    return {
      target,
      label: "starter map",
      title: "Steer the starter map",
      placeholder: "Example: make the candidate regions more family-friendly, or focus the themes on food and nature",
      note: "Edits only change the starter map direction. Sources are still required before promotion."
    };
  }

  const [kind, name] = target.split(":");
  const decodedName = name ?? "";
  const isKnownRegion = kind === "region" && draft.regions.some((region) => region.name === decodedName);
  const isKnownTheme = kind === "theme" && draft.themes.some((theme) => theme.label === decodedName);
  if (!isKnownRegion && !isKnownTheme) return null;

  return {
    target,
    label: decodedName,
    title: `Steer ${decodedName}`,
    placeholder: `Example: rename ${decodedName}, or change why it matters`,
    note: `This edit is scoped to ${decodedName}. It only changes the starter map direction; sources are still required before promotion.`
  };
}

function renderDraftEditModal(draftState, modal) {
  const isSending = Boolean(draftState?.isSending);
  const messages = draftMessagesForTarget(draftState?.messages ?? [], modal.target);
  return `
    <section class="draft-edit-modal-backdrop" role="presentation">
      <section class="draft-edit-modal" role="dialog" aria-modal="true" aria-label="Edit ${escapeHtml(modal.label)} with GenAI">
        <header>
          <div>
            <p class="eyebrow">GenAI edit</p>
            <h3>${escapeHtml(modal.title)}</h3>
          </div>
          <button
            type="button"
            class="sheet-close"
            data-country-action="toggle-genai-prompt"
            data-genai-target="${escapeHtml(modal.target)}"
            aria-label="Close GenAI edit modal"
          >×</button>
        </header>
        <form class="draft-genai-form" data-country-genai-form data-genai-target="${escapeHtml(modal.target)}">
          <textarea
            name="instruction"
            rows="4"
            maxlength="420"
            placeholder="${escapeHtml(modal.placeholder)}"
            ${isSending ? "disabled" : ""}
          ></textarea>
          <button type="submit" ${isSending ? "disabled" : ""}>${isSending ? "Applying" : "Apply"}</button>
          <div class="draft-chat-log draft-chat-log--modal" aria-live="polite" aria-atomic="false">
            ${renderDraftChatLog(messages, {
              emptyText: "Chat history for this edit will appear here.",
              isSending
            })}
          </div>
          <p class="muted">${escapeHtml(modal.note)}</p>
        </form>
      </section>
    </section>
  `;
}

function renderDraftReview(draft) {
  const items = (draft.reviewChecklist ?? []).filter(Boolean);
  if (!items.length) return "";

  return `
    <section class="draft-review" aria-label="Before promotion">
      <header class="draft-review-header">
        <h3 class="draft-review-title">Before promotion</h3>
        <p class="draft-review-lead">Keep starter facts unconfirmed until each item is source-reviewed.</p>
      </header>
      <ol class="draft-review-list">
        ${items
          .map(
            (item, index) => `
          <li class="draft-review-item">
            <span class="draft-review-step" aria-hidden="true">${index + 1}</span>
            <p>${escapeHtml(item)}</p>
          </li>`
          )
          .join("")}
      </ol>
    </section>
  `;
}

function renderDraftConfirmation(draftState, { countryName, isRegisteredCountryPack } = {}) {
  const draft = draftState.draft;
  if (draft.mode === "curated_pack_snapshot") {
    const isUnconfirmedPack = draft.confidence === "unconfirmed";
    if (isUnconfirmedPack) return "";
    return `
      <section class="draft-confirmation">
        <h3>Source-reviewed country pack</h3>
        <p>This starter map is already derived from source-controlled curated data.</p>
      </section>
    `;
  }

  if (isRegisteredCountryPack) {
    return `
      <section class="draft-confirmation">
        <div>
          <h3>Preview only</h3>
          <p>${escapeHtml(countryName ?? "This country")} already has a source-controlled country pack. Use this starter map to explore changes, then update the country pack source file to make them permanent.</p>
        </div>
      </section>
    `;
  }

  if (draftState.confirmation) {
    return `
      <section class="draft-confirmation draft-confirmation--ready">
        <div>
          <h3>Confirmed for curation</h3>
          <p>Country-pack draft artifact generated. You can open the review files below.</p>
        </div>
        <div class="draft-links">
          <a href="${escapeHtml(draftState.confirmation.paths.confirmationUrl)}" target="_blank" rel="noreferrer">confirmation</a>
          <a href="${escapeHtml(draftState.confirmation.paths.countryPackDraftUrl)}" target="_blank" rel="noreferrer">country pack draft</a>
        </div>
      </section>
    `;
  }

  if (draftState.confirmationError) {
    return `
      <section class="draft-confirmation draft-confirmation--failed" aria-live="polite">
        <div>
          <h3>Confirmation failed</h3>
          <p>${escapeHtml(draftState.confirmationError)}</p>
        </div>
        <button type="button" data-country-action="confirm-starter-map">Try again</button>
      </section>
    `;
  }

  if (draftState.isConfirming) {
    return `
      <section class="draft-confirmation draft-confirmation--loading" aria-live="polite">
        <div>
          <h3>Confirming for curation</h3>
          <p>Generating the country-pack draft artifact for source review.</p>
        </div>
        <button type="button" disabled>Confirming</button>
      </section>
    `;
  }

  return `
    <section class="draft-confirmation">
      <div>
        <h3>Ready to confirm</h3>
        <p>Confirm this direction to generate a country-pack draft artifact for source review.</p>
      </div>
      <button type="button" data-country-action="confirm-starter-map" ${draftState.isConfirming ? "disabled" : ""}>
        ${draftState.isConfirming ? "Confirming" : "Confirm for curation"}
      </button>
    </section>
  `;
}

function renderDraftRegion(region, indexPath, genAiContext) {
  const index = indexPath[0] - 1;
  const nested = [`<li>${escapeHtml(region.why)}</li>`];
  if (region.sourceUrl) {
    nested.push(
      `<li>Source: <a href="${escapeHtml(region.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(region.sourceUrl)}</a></li>`
    );
  }
  return `
    <li class="draft-item" data-draft-list="regions" data-draft-sort-index="${index}">
      <div class="draft-item-heading">
        ${renderDraftSortHandle("regions", index, region.name)}
        ${renderDraftPlacePhoto(region.name, region.children, genAiContext, region.kind)}
        ${renderDraftItemCounter(indexPath)}
        <strong>${escapeHtml(region.name)}</strong>
        ${renderDraftMetadata(region.kind, region.confidence, {
          approveTarget: `region:${region.name}`,
          item: region
        })}
        ${renderDraftDescendantApprovalButton(region, indexPath)}
        ${renderDraftGenAiButton(`region:${region.name}`, region.name, genAiContext)}
        ${renderDraftDeleteButton("regions", index, region.name)}
      </div>
      <ul class="draft-item-nested">
        ${nested.join("")}
      </ul>
      ${renderDraftChildNodes(region.children, indexPath)}
    </li>
  `;
}

function getNodePlaceImageContext(node, nodes) {
  return (node?.childIds ?? [])
    .slice(0, 3)
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

function renderDraftPlacePhoto(placeName, children, genAiContext, kind = "region") {
  if (!genAiContext?.countrySlug) return "";
  const context = (Array.isArray(children) ? children : [])
    .slice(0, 3)
    .map((child) => child.name)
    .join(" ");
  const src = buildPlaceImageUrl(genAiContext.countrySlug, placeName, { context, kind });
  // Reference photo only; it must never be treated as evidence about the place.
  return `
    <button
      type="button"
      class="draft-item-photo-button"
      data-draft-place-photo
      data-photo-state="queued"
      data-place-name="${escapeHtml(placeName)}"
      data-place-context="${escapeHtml(context)}"
      data-place-kind="${escapeHtml(kind)}"
      aria-label="View reference photo for ${escapeHtml(placeName)}"
    >
      <span class="draft-item-photo-frame">
        <img
          class="draft-item-photo"
          data-src="${escapeHtml(src)}"
          alt=""
          loading="eager"
          fetchpriority="high"
          decoding="async"
          referrerpolicy="no-referrer"
        />
        <span class="draft-photo-progress" aria-hidden="true"><span></span></span>
        <span class="draft-photo-spinner" aria-hidden="true"></span>
        <span class="draft-photo-fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect>
            <circle cx="9" cy="9.5" r="1.5"></circle>
            <path d="m5.5 17 4.25-4.25 2.75 2.75 2-2 3.5 3.5"></path>
            <path d="M4 3 20 21"></path>
          </svg>
        </span>
        <span class="draft-photo-status">Queued</span>
        <span class="draft-photo-ready" aria-hidden="true">${renderRegionRailCheck()}</span>
      </span>
    </button>
  `;
}

function hydrateDraftPlacePhotos(root) {
  const buttons = [...root.querySelectorAll("[data-draft-place-photo]")];
  if (!buttons.length) return;

  const loadedUrls = new Set();
  for (const button of buttons) {
    const image = button.querySelector(".draft-item-photo");
    const src = image?.dataset.src;
    if (!image || !src || button.dataset.photoHydrated === "true") continue;

    button.dataset.photoHydrated = "true";
    // These thumbnails are part of the immediately visible config tree. Native
    // lazy-loading can defer even local cached images in the embedded webview
    // until the user scrolls or clicks, so always start their request now.
    image.loading = "eager";
    image.fetchPriority = "high";
    setDraftPhotoState(button, "searching", "Searching", 0.18);

    const timers = [
      window.setTimeout(() => setDraftPhotoState(button, "selecting", "Selecting", 0.52), 650),
      window.setTimeout(() => setDraftPhotoState(button, "caching", "Caching", 0.78), 1500)
    ];
    let settled = false;
    const clearTimers = () => timers.forEach((timer) => window.clearTimeout(timer));
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimers();
      callback();
    };
    timers.push(window.setTimeout(() => {
      if (!settled) setDraftPhotoState(button, "searching", "Still searching", 0.82);
    }, 15_000));
    timers.push(window.setTimeout(() => {
      settle(() => {
        retryDraftPlacePhoto(root, button, image, src, "Retrying search");
      });
    }, DRAFT_PLACE_PHOTO_TIMEOUT_MS));

    image.addEventListener("load", () => {
      settle(() => {
        const imageUrl = normalizeLoadedDraftPhotoUrl(image.currentSrc || image.src);
        if (loadedUrls.has(imageUrl)) {
          setDraftPhotoState(button, "duplicate", "Duplicate", 1);
          image.removeAttribute("src");
          return;
        }
        loadedUrls.add(imageUrl);
        setDraftPhotoState(button, "ready", "Ready", 1);
      });
    }, { once: true });

    image.addEventListener("error", () => {
      settle(() => {
        retryDraftPlacePhoto(root, button, image, src, "Retrying");
      });
    }, { once: true });

    image.src = src;
    delete image.dataset.src;
  }
}

function retryDraftPlacePhoto(root, button, image, src, label) {
  const retryCount = Number(button.dataset.photoRetryCount ?? "0");
  if (retryCount >= 2) {
    setDraftPhotoState(button, "failed", "No photo", 1);
    image.removeAttribute("src");
    return;
  }

  button.dataset.photoRetryCount = String(retryCount + 1);
  setDraftPhotoState(button, "searching", label, 0.22);
  image.removeAttribute("src");
  window.setTimeout(() => {
    if (!root.isConnected || !button.isConnected) return;
    button.dataset.photoHydrated = "false";
    image.dataset.src = src;
    hydrateDraftPlacePhotos(root);
  }, 900 * (retryCount + 1));
}

function setDraftPhotoState(button, stateName, label, progress) {
  button.dataset.photoState = stateName;
  button.style.setProperty("--draft-photo-progress", `${Math.round(clamp01(progress) * 100)}%`);
  const status = button.querySelector(".draft-photo-status");
  if (status) status.textContent = label;
  const placeName = button.dataset.placeName ?? "this place";
  button.setAttribute("aria-label", `Reference photo for ${placeName}: ${label}`);
}

function normalizeLoadedDraftPhotoUrl(value) {
  try {
    const parsed = new URL(value, window.location.origin);
    // Reference photos are served through one endpoint. Keep its query string
    // because it carries the country and place identity; dropping it makes
    // every /api/place-image response look like the same photo.
    return `${parsed.origin}${parsed.pathname}${parsed.search}`.toLowerCase();
  } catch {
    return String(value ?? "").trim().toLowerCase();
  }
}

function renderDraftChildNodes(children, parentIndexPath) {
  if (!Array.isArray(children) || children.length === 0) return "";
  return `
    <ul class="draft-child-list">
      ${children
        .map((child, index) => {
          const indexPath = [...parentIndexPath, index + 1];
          const target = `node:${indexPath.join(".")}`;
          return `
            <li class="draft-child-item">
              <div class="draft-item-heading">
                ${renderDraftItemCounter(indexPath)}
                <strong>${escapeHtml(child.name)}</strong>
                ${renderDraftMetadata(child.kind, child.confidence, {
                  approveTarget: target,
                  item: child
                })}
                ${renderDraftCandidateEditButton(child, indexPath)}
                ${renderDraftDeleteButton("node", null, child.name, indexPath.join("."))}
              </div>
              ${renderDraftChildNodes(child.children, indexPath)}
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderDraftCandidateEditButton(item, indexPath) {
  if (isDraftItemApproved(item)) return "";
  return `
    <button
      type="button"
      class="draft-candidate-edit-button"
      data-country-action="edit-draft-candidate"
      data-draft-path="${escapeHtml(indexPath.join("."))}"
      aria-label="Edit unconfirmed candidate ${escapeHtml(item.name)}"
      title="Edit unconfirmed candidate"
    >Edit</button>
  `;
}

function renderDraftTheme(theme, indexPath, genAiContext) {
  const index = indexPath[0] - 1;
  const nested = [`<li>${escapeHtml(theme.note)}</li>`];
  if (theme.sourceUrl) {
    nested.push(
      `<li>Source: <a href="${escapeHtml(theme.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(theme.sourceUrl)}</a></li>`
    );
  }
  return `
    <li class="draft-item" data-draft-list="themes" data-draft-sort-index="${index}">
      <div class="draft-item-heading">
        ${renderDraftSortHandle("themes", index, theme.label)}
        ${renderDraftItemCounter(indexPath)}
        <strong>${escapeHtml(theme.label)}</strong>
        ${renderDraftMetadata("theme", theme.confidence, {
          kindLabel: theme.label,
          approveTarget: `theme:${theme.label}`,
          item: theme
        })}
        ${renderDraftGenAiButton(`theme:${theme.label}`, theme.label, genAiContext)}
        ${renderDraftDeleteButton("themes", index, theme.label)}
      </div>
      <ul class="draft-item-nested">
        ${nested.join("")}
      </ul>
    </li>
  `;
}

function renderDraftSortHandle(list, index, label) {
  return `
    <button
      type="button"
      class="draft-sort-handle"
      draggable="true"
      data-draft-drag-handle
      data-draft-list="${escapeHtml(list)}"
      data-draft-index="${index}"
      aria-label="Drag to reorder ${escapeHtml(label)}"
      title="Drag to reorder"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
        <path d="M5 3h1.5v1.5H5V3Zm4.5 0H11v1.5H9.5V3ZM5 7.25h1.5v1.5H5v-1.5Zm4.5 0H11v1.5H9.5v-1.5ZM5 11.5h1.5V13H5v-1.5Zm4.5 0H11V13H9.5v-1.5Z"></path>
      </svg>
    </button>
  `;
}

function renderDraftDescendantApprovalButton(item) {
  if (!Array.isArray(item?.children) || item.children.length === 0) return "";
  const allApproved = areDraftDescendantsApproved(item);
  const label = allApproved ? "Clear all" : "Curate all";
  return `
    <button
      type="button"
      class="draft-descendant-approval"
      data-country-action="approve-draft-descendants"
      data-approve-target="region:${escapeHtml(item.name)}"
      data-approved="${allApproved ? "true" : "false"}"
      aria-pressed="${allApproved}"
      aria-label="${allApproved ? "Return all nested nodes to needs review" : "Mark all nested nodes as curated"}"
      title="${allApproved ? "Return all nested nodes to needs review" : "Mark all nested nodes as curated"}"
    >${label}</button>
  `;
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
  return `
    <button
      type="button"
      class="draft-delete-button"
      data-country-action="delete-draft-item"
      data-draft-list="${escapeHtml(list)}"
      ${Number.isInteger(index) ? `data-draft-index="${index}"` : ""}
      ${path ? `data-draft-path="${escapeHtml(path)}"` : ""}
      data-draft-label="${escapeHtml(label)}"
      aria-label="Delete ${escapeHtml(label)} from starter map"
      title="Delete from starter map"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
        <path d="M6.2 2h3.6l.6 1.2H13v1.3H3V3.2h2.6L6.2 2Zm-1.7 4h1.3l.3 7h3.8l.3-7h1.3l-.4 8.2H4.9L4.5 6Zm2.3.5H8v5.8H6.8V6.5Zm2.2 0h1.2v5.8H9V6.5Z"></path>
      </svg>
    </button>
  `;
}

function renderDraftItemCounter(indexPath) {
  return `<span class="draft-item-counter" aria-hidden="true">${escapeHtml(indexPath.join("."))}</span>`;
}

function renderDraftMetadata(kind, confidence, options = null) {
  const kindLabel = typeof options === "string" ? options : options?.kindLabel ?? kind;
  const approveTarget = typeof options === "object" ? options?.approveTarget : null;
  const item = typeof options === "object" ? options?.item : null;
  const approved = item?.confidence === "confirmed" || item?.reviewStatus === "human_approved";
  const approveLabel = approveTarget?.split(":")[1] ?? "item";
  const kindValue = formatDraftKind(kindLabel);
  const confidenceValue = formatDraftConfidence(confidence);
  const kindDescription = describeDraftKind(kindLabel);
  const confidenceDescription = describeDraftConfidence(confidence);
  const trustTitle = approved
    ? `Approved. Click to return ${approveLabel} to needs-review.`
    : `Click to mark ${approveLabel} as curated.`;

  const trustChip = approveTarget
    ? `
      <button
        type="button"
        class="draft-meta-chip draft-meta-chip--trust draft-meta-chip--${escapeHtml(confidence)} draft-meta-chip--action${approved ? " is-approved" : ""}"
        data-country-action="approve-draft-item"
        data-approve-target="${escapeHtml(approveTarget)}"
        data-approved="${approved ? "true" : "false"}"
        aria-label="${escapeHtml(approved ? `Unapprove ${approveLabel}` : `Approve ${approveLabel}`)}"
        aria-pressed="${approved}"
      >
        <span class="draft-meta-label">Trust</span>
        <span class="draft-meta-value">${escapeHtml(confidenceValue)}</span>
        ${renderDraftTrustTick(approved)}
        ${renderDraftButtonTooltip(`Trust: ${confidenceValue}`, trustTitle)}
      </button>
    `
    : `
      <span class="draft-meta-chip draft-meta-chip--trust draft-meta-chip--${escapeHtml(confidence)}">
        <span class="draft-meta-label">Trust</span>
        <span>${escapeHtml(confidenceValue)}</span>
        ${renderDraftButtonTooltip(`Trust: ${confidenceValue}`, confidenceDescription)}
      </span>
    `;

  return `
    <span class="draft-meta" aria-label="${escapeHtml(`${kindDescription}. ${confidenceDescription}`)}">
      <span class="draft-meta-chip">
        <span class="draft-meta-label">Type</span>
        <span>${escapeHtml(kindValue)}</span>
        ${renderDraftButtonTooltip(`Type: ${kindValue}`, kindDescription)}
      </span>
      ${trustChip}
    </span>
  `;
}

function renderDraftTrustTick(approved) {
  return `
    <span class="draft-trust-tick${approved ? " is-approved" : ""}" aria-hidden="true">
      <svg viewBox="0 0 12 12" focusable="false">
        <circle class="draft-trust-tick-ring" cx="6" cy="6" r="5.25" />
        <path class="draft-trust-tick-mark" d="M3.4 6.1 5.2 7.9 8.7 4.3" />
      </svg>
    </span>
  `;
}

function formatDraftKind(kind) {
  const labels = {
    area: "Area",
    attraction: "Attraction",
    city: "City",
    region: "Region",
    state: "State",
    theme: "Theme",
    zone: "Zone",
    animal: "Animal"
  };
  return labels[kind] ?? titleCaseText(kind);
}

function describeDraftKind(kind) {
  const descriptions = {
    area: "A broad place candidate or sub-area in the map.",
    attraction: "A specific place a traveller can visit.",
    city: "A city-level candidate for future curation.",
    region: "A broad district or region in the country map.",
    state: "A state-level candidate for future curation.",
    theme: "A research lens used to organize the map.",
    zone: "A sub-area inside a larger attraction.",
    animal: "A wildlife or encyclopedia node."
  };
  return descriptions[kind] ?? "The kind of RoamAtlas node this item represents.";
}

function formatDraftConfidence(confidence) {
  const labels = {
    confirmed: "Curated",
    likely: "Likely",
    general: "General",
    unconfirmed: "Needs review"
  };
  return labels[confidence] ?? titleCaseText(confidence);
}

function describeDraftConfidence(confidence) {
  const descriptions = {
    confirmed: "Backed by the source-controlled RoamAtlas data.",
    likely: "Supported by a grounding source, but still needs human review.",
    general: "General background, not a specific travel claim.",
    unconfirmed: "Planning scaffold only; not verified for user-facing claims."
  };
  return descriptions[confidence] ?? "Confidence level for this item.";
}

function titleCaseText(value) {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderDraftChat(draftState) {
  const messages = draftState.messages ?? [];
  const isSending = Boolean(draftState.isSending);

  return `
    <section class="draft-chat" aria-label="Starter map chat">
      <h3>Edit starter map</h3>
      <div class="draft-chat-log" aria-live="polite" aria-atomic="false">
        ${renderDraftChatLog(messages, {
          emptyText: "Ask for a different angle, such as states first, weekend trips, nature, food, family travel, or cross-border ideas.",
          isSending
        })}
      </div>
      <form class="draft-chat-form" data-country-chat-form>
        <textarea
          name="instruction"
          rows="2"
          maxlength="420"
          placeholder="Example: focus on regions first, then nearby cities"
          ${isSending ? "disabled" : ""}
        ></textarea>
        <button type="submit" ${isSending ? "disabled" : ""}>${isSending ? "Applying" : "Apply"}</button>
      </form>
      <p class="muted">This only changes the unconfirmed starter map. Sources are still required before promotion.</p>
    </section>
  `;
}

function renderDraftChatLog(messages, { emptyText, isSending } = {}) {
  const visibleMessages = (messages ?? []).filter((message) => !message.hidden);
  if (!visibleMessages.length) {
    return `<p class="muted">${escapeHtml(emptyText ?? "No chat history yet.")}</p>`;
  }

  const renderedMessages = visibleMessages.map(renderDraftChatMessage).join("");
  const status = isSending
    ? `<p class="draft-chat-status" role="status">Processing starter-map update...</p>`
    : "";
  return `${renderedMessages}${status}`;
}

function renderDraftChatMessage(message) {
  const status = message.status ? ` data-status="${escapeHtml(message.status)}"` : "";
  const label = draftChatMessageLabel(message);
  return `
    <article class="draft-chat-message draft-chat-message--${escapeHtml(message.role)}${message.status ? ` draft-chat-message--${escapeHtml(message.status)}` : ""}"${status}>
      <strong>${escapeHtml(label)}</strong>
      <p>${escapeHtml(message.text)}</p>
    </article>
  `;
}

function draftChatMessageLabel(message) {
  if (message.status === "processing") return "Processing";
  if (message.status === "done") return "Done";
  if (message.status === "error") return "Error";
  return message.role === "user" ? "You" : "RoamAtlas";
}

function draftMessagesForTarget(messages, target) {
  if (target === "starter-map") {
    return (messages ?? []).filter((message) => !message.target || message.target === "starter-map");
  }
  return (messages ?? []).filter((message) => message.target === target);
}

function scopedDraftMessage(message, target) {
  return { ...message, target };
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
    const forceParam = force ? "&force=true" : "";
    const response = await fetch(
      apiPath(`/api/country-draft?countrySlug=${encodeURIComponent(country.slug)}${forceParam}`),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error(`Starter map failed: ${response.status}`);
    const { draft } = await response.json();
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

      const response = await fetch(
        apiPath(`/api/country-draft?countrySlug=${encodeURIComponent(country.slug)}&generate=false`),
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const { draft: storedDraft } = await response.json();
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

    const response = await fetch(
      apiPath(`/api/country-draft?countrySlug=${encodeURIComponent(country.slug)}&generate=false`),
      { cache: "no-store" }
    );
    if (!response.ok) return;
    const { draft } = await response.json();
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
    const response = await fetch(apiPath("/api/country-draft/influence"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        instruction,
        target,
        currentDraft: existing?.draft ?? null
      })
    });
    if (!response.ok) {
      throw new Error(await readResponseError(response, "Starter map update failed"));
    }
    const { draft, message } = await response.json();
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
    const response = await fetch(apiPath("/api/country-draft/approve-item"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        currentDraft: existing.draft,
        target,
        approved,
        recursive
      })
    });
    if (!response.ok) {
      throw new Error(await readResponseError(response, "Starter map approval failed"));
    }
    const payload = await response.json();
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
    const response = await fetch(apiPath("/api/country-draft/confirm"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        currentDraft: existing.draft
      })
    });
    if (!response.ok) {
      throw new Error(await readResponseError(response, "Starter map confirmation failed"));
    }
    const confirmation = await response.json();
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
        ? `Reset generated visuals for ${country.name}? This clears generated map illustrations, image jobs, and ambience. Starter-map builder information, reference photos, and review artifacts stay.`
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
    const response = await fetch(apiPath("/api/runtime-cache/flush"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countrySlug: country.slug, scope })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Cache flush failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }

    const result = await response.json();
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
        ? "Generated map visuals were cleared. Starter-map builder information and reference photos were kept."
        : "Generated runtime artifacts were cleared. Open the map or rebuild starter info to create fresh data."
    });
    render();
    showAppToast({
      title: visualsOnly ? "Generated visuals reset" : "Runtime artifacts reset",
      message: visualsOnly
        ? "Map illustrations and visual cache were cleared. Builder information and reference photos were kept."
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
      durationMs: 8000
    });
    return false;
  }
}

async function requestPlaceImageReset(country, { place = "" } = {}) {
  const normalizedPlace = String(place ?? "").trim();
  const isSinglePlace = Boolean(normalizedPlace);
  const scrollSnapshot = captureCountryShellScroll();

  try {
    const response = await fetch(apiPath("/api/place-image/reset"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        ...(isSinglePlace ? { place: normalizedPlace } : {})
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Reference photo reset failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }

    await response.json();
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
      durationMs: 8000
    });
    return false;
  }
}

async function requestPlaceImageFeedback(country, place, feedback) {
  const normalizedPlace = String(place ?? "").trim();
  const normalizedFeedback = String(feedback ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (!normalizedPlace || !normalizedFeedback) return false;
  const scrollSnapshot = captureCountryShellScroll();

  try {
    const response = await fetch(apiPath("/api/place-image/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        place: normalizedPlace,
        feedback: normalizedFeedback
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Reference photo feedback failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }

    await response.json();
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
      durationMs: 8000
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
    const response = await fetch(apiPath("/api/place-image/suggestions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countrySlug: country.slug,
        place: String(place ?? "").trim(),
        context: String(context ?? "").trim(),
        kind: String(kind ?? "region").trim(),
        currentFeedback: String(currentFeedback ?? "").trim()
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Prompt suggestions failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }
    const payload = await response.json();
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    return {
      source: payload?.source === "llm" ? "llm" : "curated-fallback",
      suggestions: suggestions
      .map((suggestion) => String(suggestion ?? "").replace(/\s+/g, " ").trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 3)
    };
  } catch (error) {
    showAppToast({
      title: "Prompt suggestions unavailable",
      message: explainClickError(error),
      tone: "error",
      durationMs: 7000
    });
    return { source: "curated-fallback", suggestions: [] };
  }
}

async function loadDraftPhotoHistory(backdrop, country, place) {
  const history = backdrop.querySelector("[data-draft-photo-history]");
  const image = backdrop.querySelector(".draft-photo-lightbox-image");
  if (!history || !image) return;

  try {
    const params = new URLSearchParams({ countrySlug: country.slug, place });
    const response = await fetch(apiPath(`/api/place-image/history?${params.toString()}`));
    if (!response.ok) return;
    const payload = await response.json();
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
    const response = await fetch(apiPath("/api/place-image/history/select"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countrySlug: country.slug, place, entryId })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Saved reference photo selection failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }

    await response.json();
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
      durationMs: 8000
    });
    return false;
  }
}

async function requestPlaceImageHistoryDelete(country, place, entryId) {
  try {
    const response = await fetch(apiPath("/api/place-image/history/delete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countrySlug: country.slug, place, entryId })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Saved reference photo deletion failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }

    const payload = await response.json();
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
      durationMs: 8000
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

function clearCountryGeneratedState(countrySlug) {
  const pack = getCountryPack(countrySlug);
  clearPendingJob();
  cancelPendingNavigation();
  for (const artworkJobKey of [...state.artworkJobs.keys()]) {
    stopArtworkPoller(artworkJobKey);
  }
  state.artworkJobs.clear();
  state.artworkByScene.clear();
  state.artworkByPage.clear();
  state.artworkImageLoads.clear();
  invalidatePrefetchState();
  environmentPlanEpoch += 1;
  if (state.currentPage?.countrySlug === countrySlug) {
    state.currentPage = {
      ...state.currentPage,
      imageUrl: null,
      environmentUrl: null,
      artworkDecoded: false
    };
  }
  if (!pack) return;
  const environmentPrefix = `/runtime-cache/${countrySlug}/environment/`;
  for (const environmentUrl of state.environmentPlans.keys()) {
    if (String(environmentUrl).includes(environmentPrefix)) {
      state.environmentPlans.delete(environmentUrl);
    }
  }
  for (const environmentUrl of state.environmentPlanRequests.keys()) {
    if (String(environmentUrl).includes(environmentPrefix)) {
      state.environmentPlanRequests.delete(environmentUrl);
    }
  }
}

function enterMappedCountry(pack, { updateUrl = true, shouldRender = true } = {}) {
  if (!pack) return;
  clearPendingJob();
  cancelPendingNavigation();
  invalidatePrefetchState();
  state.currentView = "explorer";
  state.activeCountrySlug = pack.countrySlug;
  state.activePack = pack;
  state.selectedCountry = null;
  state.currentPage = createRootPage(pack);
  state.currentSceneId = pack.overviewSceneId;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(`/${pack.countrySlug}`);
  if (shouldRender) render();
}

function enterCountryShell(country, { updateUrl = true, shouldRender = true, replaceUrl = false } = {}) {
  clearPendingJob();
  cancelPendingNavigation();
  invalidatePrefetchState();
  state.currentView = "country";
  state.selectedCountry = country;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(routeForCountryConfig(country), { replace: replaceUrl });
  if (shouldRender) render();
  loadStoredCountryDraft(country);
}

function enterCuratedPlace({ countrySlug, nodeId, pack }, { updateUrl = true, shouldRender = true } = {}) {
  cancelPendingNavigation();
  invalidatePrefetchState();
  const node = pack?.nodes[nodeId];
  if (!node) {
    if (pack) enterMappedCountry(pack, { updateUrl: false, shouldRender: false });
    state.routeNotice = {
      confidence: "unconfirmed",
      title: "Unknown RoamAtlas node",
      message: `${nodeId} is not mapped in RoamAtlas' verified ${pack?.title ?? countrySlug} graph.`
    };
    if (shouldRender) render();
    return;
  }

  const sceneId = findSceneIdForNode({ nodeId, nodes: pack.nodes, scenes: pack.scenes });
  state.currentView = "explorer";
  state.activeCountrySlug = countrySlug;
  state.activePack = pack;
  state.selectedCountry = null;
  state.currentSceneId = sceneId;
  state.currentPage = {
    id: nodeId === pack.rootNodeId ? "root" : `node-${nodeId}`,
    countrySlug,
    sceneId,
    nodeId,
    imageUrl: null,
    parentId: null,
    parentClick: null,
    status: "ready",
    plan: {
      title: node.title,
      factMode: hasUnconfirmedNodeFacts(node) ? "unconfirmed" : "verified"
    }
  };
  state.selectedNodeId = nodeId === pack.rootNodeId ? null : nodeId;
  state.history = [];
  state.pendingJob = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(canonicalRouteForNode(countrySlug, nodeId, pack));
  if (shouldRender) render();
}

async function applyRouteFromLocation({ shouldRender = true } = {}) {
  let route = resolveAppRoute(window.location.pathname, {
    countries: worldCountries,
    countryPacks
  });

  if (
    route.type === "country_overview" ||
    route.type === "curated_place" ||
    route.type === "invalid_place"
  ) {
    const pack = await ensureCountryPack(route.countrySlug);
    route = resolveAppRoute(window.location.pathname, {
      countries: worldCountries,
      countryPacks: pack ? { ...countryPacks, [route.countrySlug]: pack } : countryPacks
    });
  }

  if (route.type === "country_landing") {
    enterCountryLanding({ updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "country_overview") {
    enterMappedCountry(route.pack, { updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "curated_place") {
    enterCuratedPlace(route, { updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "invalid_place") {
    enterMappedCountry(route.pack, { updateUrl: false, shouldRender: false });
    state.routeNotice = {
      confidence: "unconfirmed",
      title: "Unknown RoamAtlas node",
      message: `${route.nodeId} is not mapped in RoamAtlas' verified ${route.pack.title} graph.`
    };
    if (shouldRender) render();
    return;
  }

  if (route.type === "country_config") {
    enterCountryShell(route.country, { updateUrl: false, shouldRender });
    return;
  }

  if (route.type === "country_needs_config") {
    enterCountryShell(route.country, { updateUrl: true, shouldRender, replaceUrl: true });
    return;
  }

  enterCountryLanding({ updateUrl: false, shouldRender: false });
  if (shouldRender) render();
}

async function bootstrap() {
  bindCountryLanding();
  bindCountryShell();
  bindPageClick();
  state.currentView = "countries";
  renderCountryLanding();

  try {
    await initCountryPackRegistry();
    await applyRouteFromLocation({ shouldRender: false });
    render();
    loadExperienceConfig();
  } catch (error) {
    showBootstrapError(error);
  }
}

function showBootstrapError(error) {
  elements.countryCount.textContent = "Could not load RoamAtlas";
  elements.countryNotice.classList.add("is-open");
  elements.countryNotice.textContent = explainClickError(error);
}

function enterCountryLanding({ updateUrl = true, shouldRender = true } = {}) {
  clearPendingJob();
  cancelPendingNavigation();
  invalidatePrefetchState();
  state.currentView = "countries";
  state.selectedCountry = null;
  state.selectedNodeId = null;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(routeForCountryLanding());
  if (shouldRender) render();
}

function renderScene() {
  const nodes = state.activePack.nodes;
  const scenes = state.activePack.scenes;
  const scene = scenes[state.currentSceneId];
  const rootNode = nodes[scene.rootNodeId];
  const pageNode = nodes[state.currentPage.nodeId];
  const sceneArtwork = state.artworkByScene.get(scene.id);
  const pageArtwork = state.artworkByPage.get(getPageArtworkCacheKey(state.currentPage));
  const pageTitle = state.currentPage.plan?.title ?? pageNode?.title ?? scene.title;
  const canUseSceneArtwork = canCurrentPageUseSceneArtwork(scene);
  elements.sceneTitle.textContent = pageTitle;
  const imageUrl =
    state.currentPage.sceneId === scene.id
      ? state.currentPage.imageUrl ?? (canUseSceneArtwork ? sceneArtwork?.imageUrl : pageArtwork?.imageUrl) ?? null
      : sceneArtwork?.imageUrl;
  const breadcrumbTitle = pageNode?.title ?? rootNode?.title;
  elements.breadcrumb.textContent = breadcrumbTitle
    ? `${breadcrumbTitle} · ${getPageReadinessLabel(state.currentPage.status, Boolean(imageUrl))}`
    : "Curated scene";
  const environmentUrl = getSceneEnvironmentUrl(scene, imageUrl);
  const environmentPlan = environmentUrl ? state.environmentPlans.get(environmentUrl) : null;
  const artworkJobKey = canUseSceneArtwork ? scene.id : getPageArtworkJobKey(state.currentPage);
  const artworkJob = state.artworkJobs.get(artworkJobKey);
  const previewImageUrl = !imageUrl ? artworkJob?.decodedPartialImageUrl ?? null : null;
  const displayImageUrl = imageUrl ?? previewImageUrl;
  const isArtworkPending = !imageUrl && isArtworkJobPending(artworkJob);
  const hasArtworkJob = state.artworkJobs.has(artworkJobKey);
  elements.stage.classList.toggle("has-local-art", Boolean(imageUrl));
  elements.stage.classList.toggle("has-artwork-preview", Boolean(previewImageUrl));
  elements.stage.classList.toggle("is-artwork-pending", isArtworkPending);
  elements.stage.classList.toggle("scroll-stage--placeholder", !imageUrl);
  elements.stage.setAttribute("aria-busy", isArtworkPending ? "true" : "false");
  applySceneLayout(scene, { hasArtwork: Boolean(displayImageUrl) });
  const nextDestinations = listNextArtworkDestinations({
    scene,
    scenes: state.activePack.scenes,
    nodes: state.activePack.nodes,
    currentPage: state.currentPage,
    limit: state.experienceConfig.maxParallelImageJobs
  });
  const canvas = renderSceneCanvas(scene, {
    hasArtwork: Boolean(displayImageUrl),
    isArtworkPending
  });
  canvas.replaceChildren(
    ...(displayImageUrl
      ? [renderSceneImage(displayImageUrl, scene.title, elements.stage, { isPreview: Boolean(previewImageUrl) })]
      : []),
    ...(imageUrl ? renderEnvironmentLayerNodes(scene, environmentPlan) : []),
    ...scene.tiles.map((tile) => renderTile(tile, scene.coordinateSpace)),
    ...(imageUrl ? renderImageTargetHotspots(environmentPlan, nodes) : [])
  );
  elements.stage.replaceChildren(
    canvas,
    ...(!imageUrl
      ? [
          renderLoadingSceneBoard({
            scene,
            nodes,
            targets: nextDestinations,
            pageTitle,
            artworkJobKey,
            isArtworkPending
          })
        ]
      : []),
    ...(isArtworkPending ? [renderArtworkPending(pageTitle)] : [])
  );
  elements.viewport.querySelector(".region-rail")?.remove();
  if (imageUrl && nextDestinations.length) {
    elements.viewport.appendChild(renderRegionRail(scene, nodes, nextDestinations));
  }
  elements.stage.dataset.scene = scene.id;
  if (environmentUrl && !environmentPlan) {
    requestEnvironmentPlan(environmentUrl);
  }
  if (!imageUrl && !hasArtworkJob) {
    if (canUseSceneArtwork) {
      requestSceneArtwork(scene.id, { jobKind: "interactive" });
    } else {
      requestCurrentPageArtwork({ jobKind: "interactive" });
    }
  }
  prefetchNextDestinations();
}

function applySceneLayout(scene, { hasArtwork = false } = {}) {
  const width = scene.coordinateSpace.width;
  const height = scene.coordinateSpace.height;
  const spaceAspect = width / height;
  elements.stage.style.setProperty("--scene-space-aspect", String(spaceAspect));
  elements.stage.style.setProperty("--scene-space-width", String(width));
  elements.stage.style.setProperty("--scene-space-height", String(height));
  // Runtime artwork defaults to 1536x1024 (3:2). The image load handler
  // replaces this with the exact decoded ratio when an asset is available.
  elements.stage.style.setProperty("--scene-display-aspect", String(hasArtwork ? 3 / 2 : spaceAspect));
}

function renderSceneCanvas(scene, { hasArtwork = false, isArtworkPending = false } = {}) {
  const canvas = document.createElement("div");
  canvas.className = hasArtwork ? "scene-canvas scene-canvas--artwork" : "scene-canvas";
  canvas.dataset.sceneId = scene.id;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", scene.title);
  canvas.setAttribute("aria-busy", isArtworkPending ? "true" : "false");
  return canvas;
}

function toScenePercent(value, total) {
  return `${(value / total) * 100}%`;
}

function renderRegionRail(scene, nodes, targets) {
  const rail = document.createElement("nav");
  rail.className = "region-rail";
  rail.setAttribute("aria-label", "Explore regions");

  const readiness = getPrefetchReadinessLabel();
  if (readiness) {
    const status = document.createElement("span");
    status.className = "visually-hidden";
    status.textContent = readiness;
    rail.appendChild(status);
  }

  const list = document.createElement("div");
  list.className = "region-rail-list";
  list.setAttribute("role", "list");

  const orderedTargets = orderArtworkTargetsByMapNumber(scene, targets);

  const controls = document.createElement("div");
  controls.className = "region-rail-controls";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "region-rail-scroll-button";
  previous.setAttribute("aria-label", "Show previous destinations");
  previous.innerHTML = "&#8592;";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "region-rail-scroll-button";
  next.setAttribute("aria-label", "Show more destinations");
  next.innerHTML = "&#8594;";

  const syncScrollControls = () => {
    const maxScrollLeft = Math.max(0, list.scrollWidth - list.clientWidth);
    previous.disabled = list.scrollLeft <= 2;
    next.disabled = list.scrollLeft >= maxScrollLeft - 2;
  };

  previous.addEventListener("click", () => {
    list.scrollBy({ left: -Math.max(240, list.clientWidth * 0.65), behavior: "smooth" });
  });
  next.addEventListener("click", () => {
    list.scrollBy({ left: Math.max(240, list.clientWidth * 0.65), behavior: "smooth" });
  });
  list.addEventListener("scroll", syncScrollControls, { passive: true });

  const space = scene.coordinateSpace;
  for (const target of orderedTargets) {
    const node = nodes[target.nodeId];
    if (!node) continue;

    const hotspot = findHotspotForTarget(scene, target.nodeId);
    // The rail is navigation, not an illustration caption. Keep its text in
    // sync with the curated node title; CSS may truncate it, but never replace
    // it with a different name such as "NTU / NUS".
    const label = node.title;
    const mapNumber = getHotspotMapNumber(hotspot);
    const centerX = hotspot
      ? hotspot.shape.x + hotspot.shape.width / 2
      : space.width / 2;
    const centerY = hotspot
      ? hotspot.shape.y + hotspot.shape.height / 2
      : space.height / 2;
    const prefetchState = getPrefetchTargetState(target);

    const button = document.createElement("button");
    button.type = "button";
    button.className = `region-rail-item region-rail-item--${prefetchState.phase}`;
    if (prefetchState.phase === "ready") {
      button.style.setProperty("--prefetch-progress", "100%");
    }
    button.dataset.roamFocusKey = `region:${target.key}`;
    button.title = `${node.title} - ${prefetchState.label}`;
    button.setAttribute(
      "aria-label",
      `${mapNumber ? `Map ${mapNumber}, ` : ""}${node.title}, ${prefetchState.label}`
    );
    button.innerHTML = `
      <span class="region-rail-progress" aria-hidden="true"></span>
      ${mapNumber ? `<span class="region-rail-number" aria-hidden="true">${escapeHtml(mapNumber)}</span>` : ""}
      <span class="region-rail-label">${escapeHtml(label)}</span>
      ${prefetchState.phase === "ready" ? renderRegionRailCheck() : ""}
    `;
    button.addEventListener("click", () => {
      resolveOverlayTarget({
        normalizedClick: {
          x: clamp01(centerX / space.width),
          y: clamp01(centerY / space.height)
        },
        nodeId: target.nodeId
      });
    });
    list.appendChild(button);
  }

  controls.append(previous, list, next);
  rail.appendChild(controls);
  requestAnimationFrame(syncScrollControls);
  return rail;
}

function renderLoadingSceneBoard({ scene, nodes, targets, pageTitle, artworkJobKey, isArtworkPending }) {
  const board = document.createElement("section");
  board.className = "loading-scene-board";
  board.setAttribute("aria-label", `${pageTitle} loading`);

  const job = state.artworkJobs.get(artworkJobKey) ?? {
    status: isArtworkPending ? "pending_codex_image_generation" : "starting",
    title: pageTitle
  };
  const isFailed = isArtworkJobFailed(job);
  const isPending = isArtworkJobPending(job);
  const isUnmappedStarterCountry =
    state.activePack?.confidence !== "confirmed" &&
    scene.pageType === "homepage_overview" &&
    targets.length === 0;
  const trail = buildLoadingStepTrail({
    job: isFailed
      ? { ...job, status: "failed" }
      : job.status === "partial_ready"
      ? { ...job, status: "processing_openai_image" }
      : job,
    pageTitle
  });
  board.setAttribute("aria-busy", isPending ? "true" : "false");
  const readyCount = targets.filter(isArtworkTargetReady).length;

  const header = document.createElement("div");
  header.className = "loading-scene-board-head";
  header.innerHTML = `
    <div>
      <span class="loading-scene-eyebrow">Illustration layer</span>
      <strong>${escapeHtml(isUnmappedStarterCountry ? `No mapped regions for ${pageTitle} yet` : trail.current.message)}</strong>
      <p aria-live="polite">${escapeHtml(
        isUnmappedStarterCountry
          ? "This country has an unconfirmed explorer shell but no reviewed location chapters yet."
          : isFailed
          ? getArtworkFailureMessage(job.error)
          : trail.current.detail
      )}</p>
    </div>
    ${isFailed
      ? `<button type="button" class="artwork-retry-button" data-artwork-retry>Retry illustration</button>`
      : isUnmappedStarterCountry
      ? `<button type="button" class="artwork-retry-button" data-open-country-setup>Set up locations</button>`
      : `<span class="loading-scene-count">${readyCount}/${targets.length || 0} ready</span>`}
  `;

  const retryButton = header.querySelector("[data-artwork-retry]");
  if (retryButton) {
    retryButton.dataset.roamFocusKey = `artwork-retry:${artworkJobKey}`;
    retryButton.addEventListener("click", () => retryArtwork(artworkJobKey));
  }

  const setupButton = header.querySelector("[data-open-country-setup]");
  if (setupButton) {
    setupButton.addEventListener("click", () => {
      const country = worldCountries.find((item) => item.slug === state.activeCountrySlug);
      if (country) enterCountryShell(country);
    });
  }

  const progress = document.createElement("div");
  progress.className = `loading-scene-progress${isPending ? " loading-scene-progress--indeterminate" : ""}${isFailed ? " loading-scene-progress--failed" : ""}`;
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<span></span>";

  const grid = document.createElement("div");
  grid.className = "loading-destination-grid";
  grid.setAttribute("aria-label", "Available destinations");

  if (isUnmappedStarterCountry) {
    grid.classList.add("loading-destination-grid--empty");
    grid.innerHTML = `
      <section class="loading-destination-empty" aria-label="Locations pending review">
        <span class="loading-destination-empty-icon" aria-hidden="true">+</span>
        <div>
          <strong>Locations pending review</strong>
          <p>Build an AI starter map in setup to create clearly labelled, unconfirmed candidate regions. Review sources before they become verified travel locations.</p>
        </div>
      </section>
    `;
  }

  const space = scene.coordinateSpace;
  const orderedTargets = orderArtworkTargetsByMapNumber(scene, targets);
  orderedTargets.forEach((target, index) => {
    const node = nodes[target.nodeId];
    if (!node) return;

    const hotspot = findHotspotForTarget(scene, target.nodeId);
    const label = hotspot?.label ?? node.title;
    const mapNumber = getHotspotMapNumber(hotspot) || String(index + 1);
    const centerX = hotspot && "width" in hotspot.shape
      ? hotspot.shape.x + hotspot.shape.width / 2
      : space.width / 2;
    const centerY = hotspot && "height" in hotspot.shape
      ? hotspot.shape.y + hotspot.shape.height / 2
      : space.height / 2;
    const prefetchState = getPrefetchTargetState(target);
    const statusText = prefetchState.phase === "ready"
      ? "Ready"
      : prefetchState.phase === "failed"
      ? "Retry later"
      : prefetchState.phase === "queued"
      ? "Queued"
      : prefetchState.phase === "idle"
      ? "Not queued"
      : "Drawing";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `loading-destination-card loading-destination-card--${prefetchState.phase}`;
    if (prefetchState.phase === "ready") {
      button.style.setProperty("--prefetch-progress", "100%");
    }
    button.dataset.roamFocusKey = `loading-destination:${target.key}`;
    button.setAttribute("aria-label", `${node.title}, ${prefetchState.label}`);
    button.innerHTML = `
      <span class="loading-destination-progress" aria-hidden="true"></span>
      <span class="loading-destination-index">${escapeHtml(mapNumber)}</span>
      <span class="loading-destination-copy">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(statusText)}</span>
      </span>
      ${prefetchState.phase === "ready" ? renderRegionRailCheck() : ""}
    `;
    button.addEventListener("click", () => {
      resolveOverlayTarget({
        normalizedClick: {
          x: clamp01(centerX / space.width),
          y: clamp01(centerY / space.height)
        },
        nodeId: target.nodeId
      });
    });
    grid.appendChild(button);
  });

  board.append(header, progress, grid);
  return board;
}

function orderArtworkTargetsByMapNumber(scene, targets) {
  // The prefetch queue is deliberately prioritized by likely navigation, but
  // the loading board is a numbered chapter index. Keep its visual order
  // stable and aligned with the map numbers regardless of queue timing.
  return [...targets].sort((left, right) => {
    const leftNumber = Number(getHotspotMapNumber(findHotspotForTarget(scene, left.nodeId)));
    const rightNumber = Number(getHotspotMapNumber(findHotspotForTarget(scene, right.nodeId)));
    const leftHasNumber = Number.isFinite(leftNumber);
    const rightHasNumber = Number.isFinite(rightNumber);
    if (leftHasNumber && rightHasNumber) return leftNumber - rightNumber;
    if (leftHasNumber) return -1;
    if (rightHasNumber) return 1;
    return 0;
  });
}

function getHotspotMapNumber(hotspot) {
  const value = hotspot?.mapNumber ?? hotspot?.displayNumber ?? hotspot?.anchorNumber;
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function getPrefetchTargetState(target) {
  if (isArtworkTargetReady(target)) {
    return {
      phase: "ready",
      label: "illustration ready"
    };
  }

  const job = state.prefetchJobs.get(target.key);
  if (!job) {
    return {
      phase: "idle",
      label: "not started yet"
    };
  }

  if (isArtworkJobFailed(job)) {
    return {
      phase: "failed",
      label: getArtworkFailureMessage(job.error)
    };
  }

  const current = buildLoadingStepTrail({
    job: job.status === "partial_ready"
      ? { ...job, status: "processing_openai_image" }
      : job,
    pageTitle: target.title
  }).current;

  return {
    phase: current.phase === "failed"
      ? "failed"
      : current.phase === "queued"
      ? "queued"
      : current.phase === "generating"
      ? "loading"
      : "starting",
    label: current.phase === "failed" ? "illustration failed" : current.detail
  };
}

function renderRegionRailCheck() {
  return `
    <span class="region-rail-check" aria-hidden="true">
      <svg viewBox="0 0 14 14" focusable="false">
        <path d="M3.1 7.1 5.8 9.8 11 4.2"></path>
      </svg>
    </span>
  `;
}

function findHotspotForTarget(scene, nodeId) {
  return (scene.hotspots ?? []).find(
    (hotspot) => hotspot.nodeId === nodeId || hotspot.action?.nodeId === nodeId
  );
}

function renderScenePlaceholderHint(isArtworkPending) {
  const hint = document.createElement("p");
  hint.className = "scene-placeholder-hint";
  const readiness = getPrefetchReadinessLabel();
  if (isArtworkPending) {
    hint.textContent = readiness
      ? `Illustration is generating. ${readiness}. Choose a region below to keep exploring.`
      : "Illustration is generating. Choose a region below to keep exploring.";
  } else if (readiness) {
    hint.textContent = `${readiness}. Choose a region to explore the scroll.`;
  } else {
    hint.textContent = "Choose a region to explore the scroll.";
  }
  return hint;
}

function canCurrentPageUseSceneArtwork(scene) {
  return state.currentPage.nodeId === scene.rootNodeId;
}

function getPageArtworkJobKey(page) {
  return `page:${page?.id ?? page?.nodeId ?? "unknown"}`;
}

function getPageArtworkCacheKey(page) {
  return page?.nodeId ? `node:${page.nodeId}` : `page:${page?.id ?? "unknown"}`;
}

function isArtworkJobFailed(job) {
  return ["failed", "cancelled", "timed_out", "error"].includes(job?.status);
}

function isArtworkJobPending(job) {
  return Boolean(job) && job.status !== "ready" && !isArtworkJobFailed(job);
}

function getPageReadinessLabel(status, hasImage) {
  if (hasImage) return "facts + illustration ready";
  if (isArtworkJobFailed({ status }) || status === "artwork_failed") {
    return "facts ready · illustration unavailable";
  }
  return "facts ready · illustration loading";
}

function getArtworkFailureMessage(error) {
  const originalMessage = String(error ?? "");
  const message = originalMessage.toLowerCase();
  if (message.includes("the factual page remains available")) return originalMessage;
  if (message.includes("401") || message.includes("api key") || message.includes("authentication")) {
    return "The illustration service is not configured right now. The factual page remains available.";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("capacity")) {
    return "The illustration service is busy. The factual page remains available; retry shortly.";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("taking longer")) {
    return "The illustration is taking longer than expected. The factual page remains available.";
  }
  return "We could not finish this illustration. The factual page remains available; retry when ready.";
}

function getSceneEnvironmentUrl(scene, imageUrl) {
  if (!imageUrl) return null;
  const sceneArtwork = state.artworkByScene.get(scene.id);
  const pageArtwork = state.artworkByPage.get(getPageArtworkCacheKey(state.currentPage));
  if (state.currentPage.sceneId === scene.id && imageUrl === state.currentPage.imageUrl) {
    return getPageEnvironmentUrl(state.currentPage);
  }
  if (imageUrl === pageArtwork?.imageUrl) {
    return pageArtwork.environmentUrl ?? getPageEnvironmentUrl(pageArtwork.page);
  }
  if (imageUrl === sceneArtwork?.imageUrl) {
    return sceneArtwork.environmentUrl ?? getPageEnvironmentUrl(sceneArtwork.page);
  }
  return null;
}

function getPageEnvironmentUrl(page) {
  const status = page?.environmentStatus ?? page?.generated?.environmentStatus;
  if (status === "deferred") return null;
  return page?.environmentUrl ?? page?.generated?.environmentUrl ?? null;
}

async function requestEnvironmentPlan(environmentUrl) {
  const cachedPlan = state.environmentPlans.get(environmentUrl);
  const retryAt = Number(cachedPlan?.retryAt ?? 0);
  if (
    !environmentUrl
    || state.environmentPlanRequests.has(environmentUrl)
    || (cachedPlan && cachedPlan.status !== "request_failed")
    || (cachedPlan?.status === "request_failed" && Date.now() < retryAt)
  ) {
    return;
  }

  if (cachedPlan?.status === "request_failed") {
    state.environmentPlans.delete(environmentUrl);
  }

  const requestEpoch = environmentPlanEpoch;
  let request;
  request = fetchEnvironmentPlanWithRetry(environmentUrl)
    .then((plan) => {
      if (requestEpoch !== environmentPlanEpoch) return;
      if (!plan) throw new Error("Environment plan is not ready");
      state.environmentPlans.set(environmentUrl, normalizeEnvironmentPlan(plan));
    })
    .catch(() => {
      if (requestEpoch !== environmentPlanEpoch) return;
      const retryAt = Date.now() + ENVIRONMENT_PLAN_REQUEST_RETRY_MS;
      state.environmentPlans.set(environmentUrl, {
        version: "environment-plan-v2",
        status: "request_failed",
        retryAt,
        targets: [],
        layers: []
      });
      window.setTimeout(() => {
        if (requestEpoch !== environmentPlanEpoch) return;
        const failedPlan = state.environmentPlans.get(environmentUrl);
        if (failedPlan?.status !== "request_failed" || Number(failedPlan.retryAt ?? 0) > Date.now()) return;
        state.environmentPlans.delete(environmentUrl);
        requestEnvironmentPlan(environmentUrl);
      }, ENVIRONMENT_PLAN_REQUEST_RETRY_MS);
    })
    .finally(() => {
      if (state.environmentPlanRequests.get(environmentUrl) === request) {
        state.environmentPlanRequests.delete(environmentUrl);
      }
      if (requestEpoch === environmentPlanEpoch && state.currentView === "explorer") render();
    });

  state.environmentPlanRequests.set(environmentUrl, request);
}

async function fetchEnvironmentPlanWithRetry(environmentUrl) {
  for (let attempt = 0; attempt < ENVIRONMENT_PLAN_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = ENVIRONMENT_PLAN_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      await waitFor(delayMs);
    }

    const response = await fetch(toApiUrl(environmentUrl), { cache: "no-store" });
    const canRetry = response.status === 202 || response.status === 404 || response.status === 409 || response.status === 425;
    if (canRetry) continue;
    if (!response.ok) throw new Error(`Environment plan failed: ${response.status}`);

    const plan = await response.json();
    if (["pending", "queued", "processing"].includes(plan?.status)) continue;
    return plan;
  }
  return null;
}

function waitFor(delayMs) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function normalizeEnvironmentPlan(plan) {
  const targets = Array.isArray(plan?.targets)
    ? plan.targets
        .map((target) => ({
          ...target,
          nodeId: String(target?.nodeId ?? ""),
          coordinateSpace: "normalized",
          bounds: normalizeEnvironmentPlanBounds(target.bounds)
        }))
        .filter((target) => target.nodeId && target.bounds)
    : [];
  const layers = Array.isArray(plan?.layers)
    ? plan.layers
        .map((layer) => ({
          ...layer,
          kind: normalizeEnvironmentKind(layer.kind),
          coordinateSpace: "normalized",
          bounds: normalizeEnvironmentPlanBounds(layer.bounds)
        }))
        .filter((layer) => layer.bounds)
    : [];
  return {
    ...plan,
    version: "environment-plan-v2",
    targets,
    layers
  };
}

function renderImageTargetHotspots(environmentPlan, nodes) {
  const targets = Array.isArray(environmentPlan?.targets) ? environmentPlan.targets : [];
  return targets
    .filter((target) => target?.nodeId && nodes[target.nodeId] && target.bounds)
    .map((target) => {
      const node = nodes[target.nodeId];
      const { x, y, width, height } = target.bounds;
      const hit = document.createElement("button");
      hit.type = "button";
      hit.className = "image-target-hotspot";
      hit.setAttribute("aria-label", `Explore ${node.title}`);
      hit.style.left = `${x * 100}%`;
      hit.style.top = `${y * 100}%`;
      hit.style.width = `${width * 100}%`;
      hit.style.height = `${height * 100}%`;
      hit.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveOverlayTarget({
          normalizedClick: {
            x: clamp01(x + width / 2),
            y: clamp01(y + height / 2)
          },
          nodeId: target.nodeId
        });
      });
      return hit;
    });
}

function normalizeEnvironmentPlanBounds(bounds) {
  if (!bounds) return null;
  const x = clamp01(Number(bounds.x));
  const y = clamp01(Number(bounds.y));
  const width = Math.min(clamp(Number(bounds.width), 0.04, 1), 1 - x);
  const height = Math.min(clamp(Number(bounds.height), 0.04, 1), 1 - y);
  if (width < 0.04 || height < 0.04) return null;
  return { x, y, width, height };
}

function renderMapHotspotLabels(scene, nodes, { mode = "hidden", countrySlug }) {
  if (mode === "hidden") return [];

  const space = scene.coordinateSpace;
  return (scene.hotspots ?? [])
    .filter((hotspot) => hotspot.nodeId && nodes[hotspot.nodeId] && "width" in hotspot.shape)
    .sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0))
    .map((hotspot, index) => {
      const node = nodes[hotspot.nodeId];
      const centerX = hotspot.shape.x + hotspot.shape.width / 2;
      const centerY = hotspot.shape.y + hotspot.shape.height / 2;
      const wrapper = document.createElement("div");
      wrapper.className = "map-hotspot";
      wrapper.style.zIndex = String((hotspot.zIndex ?? 2) + 10);

      const hit = document.createElement("button");
      hit.type = "button";
      hit.className = "map-hotspot-hit";
      hit.setAttribute("aria-label", `Explore ${node.title}`);
      hit.style.left = toScenePercent(hotspot.shape.x, space.width);
      hit.style.top = toScenePercent(hotspot.shape.y, space.height);
      hit.style.width = toScenePercent(hotspot.shape.width, space.width);
      hit.style.height = toScenePercent(hotspot.shape.height, space.height);
      hit.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveOverlayTarget({
          normalizedClick: {
            x: clamp01(centerX / space.width),
            y: clamp01(centerY / space.height)
          },
          nodeId: hotspot.nodeId
        });
      });

      const photoUrl = buildPlaceImageUrl(countrySlug, node.title, {
        context: getNodePlaceImageContext(node, nodes),
        kind: getNodePlaceImageKind(node),
        tags: node.tags ?? []
      });

      const chip = document.createElement("article");
      chip.className = "map-hotspot-chip";
      chip.style.left = toScenePercent(centerX, space.width);
      chip.style.top = toScenePercent(centerY, space.height);
      chip.style.setProperty("--chip-offset", `${(index % 4) * 4 - 6}px`);
      chip.innerHTML = `
        <div class="map-hotspot-chip-inner">
          ${
            photoUrl
              ? `<img
                  class="map-hotspot-chip-photo"
                  src="${escapeHtml(photoUrl)}"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  title="Reference photo from external search. Not verified travel data."
                />`
              : `<div class="map-hotspot-chip-photo map-hotspot-chip-photo--fallback" aria-hidden="true"></div>`
          }
          <div class="map-hotspot-chip-copy">
            <span class="map-hotspot-chip-title">${escapeHtml(node.title)}</span>
            <span class="map-hotspot-chip-meta">${escapeHtml(factConfidenceLabel(hotspot.confidence))}</span>
          </div>
        </div>
      `;

      const photo = chip.querySelector(".map-hotspot-chip-photo");
      if (photo?.tagName === "IMG") {
        photo.addEventListener("error", () => {
          photo.replaceWith(createMapHotspotPhotoFallback());
        });
        photo.addEventListener("click", (event) => {
          event.stopPropagation();
          openDraftPhotoLightbox({
            src: photo.currentSrc || photo.src,
            placeName: node.title
          });
        });
      }

      wrapper.append(hit, chip);
      return wrapper;
    });
}

function createMapHotspotPhotoFallback() {
  const fallback = document.createElement("div");
  fallback.className = "map-hotspot-chip-photo map-hotspot-chip-photo--fallback";
  fallback.setAttribute("aria-hidden", "true");
  return fallback;
}

function renderArtworkPending(title) {
  const el = document.createElement("div");
  el.className = "artwork-pending";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <span class="scroll-status-dot" aria-hidden="true"></span>
    <span>${escapeHtml(title)}</span>
  `;
  return el;
}

function renderSceneImage(imageUrl, title, stageElement, { isPreview = false } = {}) {
  const image = document.createElement("img");
  image.className = `scene-image${isPreview ? " scene-image--preview" : ""}`;
  image.src = imageUrl;
  image.alt = isPreview ? `${title} illustration preview` : `${title} illustration`;
  image.decoding = "async";
  image.draggable = false;
  const syncDisplayAspect = () => {
    if (!stageElement || !image.naturalWidth || !image.naturalHeight) return;
    stageElement.style.setProperty(
      "--scene-display-aspect",
      String(image.naturalWidth / image.naturalHeight)
    );
  };
  image.addEventListener("load", syncDisplayAspect, { once: true });
  if (image.complete) syncDisplayAspect();
  return image;
}

function preloadArtworkImage(imageUrl) {
  if (!imageUrl) return Promise.reject(new Error("Artwork response did not include an image URL."));
  if (state.artworkImageLoads.has(imageUrl)) {
    return state.artworkImageLoads.get(imageUrl);
  }

  const load = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") {
          await image.decode();
        }
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      } catch (error) {
        reject(new Error(`Artwork could not be decoded: ${String(error?.message ?? error)}`));
      }
    };
    image.onerror = () => reject(new Error("Artwork could not be loaded by the browser."));
    image.src = imageUrl;
  }).catch((error) => {
    state.artworkImageLoads.delete(imageUrl);
    throw error;
  });

  state.artworkImageLoads.set(imageUrl, load);
  return load;
}

function renderEnvironmentLayerNodes(scene, environmentPlan) {
  const plannedLayers = Array.isArray(environmentPlan?.layers) ? environmentPlan.layers : [];
  const layers = plannedLayers.length
    ? plannedLayers.filter(isRenderableEnvironmentLayer)
    : (scene.ambientLayers ?? []).filter(isSafeFallbackEnvironmentLayer);
  if (!layers.length) return [];

  const root = document.createElement("div");
  root.className = "environment-layer-root";
  root.dataset.environmentSource = environmentPlan?.source ?? "scene-fallback";
  root.dataset.renderPipeline = "image-plan-atmosphere-code-replacement";
  root.setAttribute("aria-hidden", "true");
  root.replaceChildren(
    renderAtmosphereLayer(layers),
    ...layers.map((layer) => renderEnvironmentLayer(layer, scene))
  );
  return [root];
}

function renderAtmosphereLayer(layers) {
  const root = document.createElement("div");
  root.className = "atmosphere-layer";
  root.dataset.atmosphere = getAtmosphereProfile(layers);

  const waterLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "water");
  const foliageLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "foliage");
  const cloudLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "cloud");
  const birdLayers = layers.filter((layer) => normalizeEnvironmentKind(layer.kind) === "birds");

  if (waterLayers.length) {
    root.append(renderWaterAtmosphere(waterLayers));
  }

  if (foliageLayers.length) {
    root.append(renderFoliageAtmosphere(foliageLayers));
  }

  root.append(renderAirAtmosphere(cloudLayers, {
    hasWater: waterLayers.length > 0,
    hasBirdPlan: birdLayers.length > 0
  }));
  return root;
}

function getAtmosphereProfile(layers) {
  const kinds = new Set(layers.map((layer) => normalizeEnvironmentKind(layer.kind)));
  if (kinds.has("water") && kinds.has("foliage")) return "coastal-park";
  if (kinds.has("water")) return "coastal";
  if (kinds.has("foliage")) return "garden";
  return "air";
}

function renderWaterAtmosphere(waterLayers) {
  const el = document.createElement("div");
  el.className = "atmosphere-water-field";
  applyNormalizedBounds(el, { x: 0, y: 0, width: 1, height: 1 });
  el.replaceChildren(...waterLayers.flatMap((layer, index) => renderWaterZone(layer, index)));
  return el;
}

function renderWaterZone(layer, zoneIndex) {
  const layerBounds = getNormalizedEnvironmentBounds(layer);
  const bounds = expandNormalizedBounds(layerBounds, {
    x: 0.035,
    y: 0.028,
    width: 0.07,
    height: 0.075
  });
  const zone = document.createElement("div");
  zone.className = "atmosphere-water-zone";
  zone.dataset.safePlacement = layer.safePlacement ?? "open_water";
  applyNormalizedBounds(zone, bounds);
  zone.replaceChildren(
    ...Array.from({ length: 6 }, (_, index) => {
      const band = document.createElement("span");
      band.className = "atmosphere-sea-band";
      band.style.setProperty("--ambient-delay", `${-((zoneIndex * 0.9) + index * 0.55)}s`);
      band.style.setProperty("--ambient-duration", `${4.8 + (index % 3) * 0.7}s`);
      band.style.setProperty("--band-y", `${8 + index * 13}%`);
      band.style.setProperty("--band-x", `${(index * 19 + zoneIndex * 11) % 42}%`);
      return band;
    }),
    ...Array.from({ length: 4 }, (_, index) => {
      const glint = document.createElement("span");
      glint.className = "atmosphere-water-glint";
      glint.style.setProperty("--ambient-x", `${10 + ((index * 29 + zoneIndex * 13) % 78)}%`);
      glint.style.setProperty("--ambient-y", `${14 + ((index * 23 + zoneIndex * 17) % 70)}%`);
      glint.style.setProperty("--ambient-delay", `${-(index * 0.7 + zoneIndex * 0.4)}s`);
      return glint;
    }),
    renderShorelineTrace(zoneIndex),
    ...renderMarineAtmosphere(layerBounds, zoneIndex)
  );
  return [zone];
}

function renderShorelineTrace(zoneIndex = 0) {
  const wrap = document.createElement("div");
  wrap.className = "atmosphere-shoreline";
  wrap.style.setProperty("--ambient-delay", `${-(zoneIndex * 0.8)}s`);
  wrap.innerHTML = `
    <svg class="ambient-svg atmosphere-shoreline-svg" viewBox="0 0 900 160" aria-hidden="true" focusable="false">
      <path class="atmosphere-shoreline-line atmosphere-shoreline-line--foam" d="M10 92 C125 42 214 128 331 78 S541 34 676 82 S800 126 890 66" />
      <path class="atmosphere-shoreline-line atmosphere-shoreline-line--wash" d="M40 119 C162 77 253 143 367 102 S574 63 704 107 S812 144 884 101" />
    </svg>
  `;
  return wrap;
}

function renderMarineAtmosphere(bounds, zoneIndex) {
  if (bounds.width < 0.075 || bounds.height < 0.038) return [];
  return Array.from({ length: bounds.width > 0.1 ? 2 : 1 }, (_, index) => {
    const dolphin = document.createElement("span");
    dolphin.className = "atmosphere-dolphin";
    dolphin.style.setProperty("--ambient-x", `${24 + ((index * 34 + zoneIndex * 21) % 48)}%`);
    dolphin.style.setProperty("--ambient-y", `${42 + ((index * 18 + zoneIndex * 9) % 22)}%`);
    dolphin.style.setProperty("--ambient-delay", `${-(zoneIndex * 1.1 + index * 2.6)}s`);
    dolphin.style.setProperty("--ambient-duration", `${6.8 + index * 1.2}s`);
    dolphin.innerHTML = renderEnvironmentParticleMarkup("marine_life");
    return dolphin;
  });
}

function renderFoliageAtmosphere(foliageLayers) {
  const bounds = expandNormalizedBounds(mergeNormalizedBounds(foliageLayers.map(getNormalizedEnvironmentBounds)), {
    x: 0.14,
    y: 0.12,
    width: 0.2,
    height: 0.16
  });
  const el = document.createElement("div");
  el.className = "atmosphere-foliage-field";
  applyNormalizedBounds(el, bounds);
  el.replaceChildren(
    ...Array.from({ length: 14 }, (_, index) => {
      const leaf = document.createElement("span");
      leaf.className = "atmosphere-leaf";
      leaf.style.setProperty("--ambient-x", `${7 + ((index * 19) % 84)}%`);
      leaf.style.setProperty("--ambient-y", `${8 + ((index * 31) % 78)}%`);
      leaf.style.setProperty("--ambient-delay", `${-(index * 0.38)}s`);
      leaf.style.setProperty("--ambient-duration", `${4.6 + (index % 4) * 0.45}s`);
      return leaf;
    })
  );
  return el;
}

function renderAirAtmosphere(cloudLayers, { hasWater, hasBirdPlan }) {
  const el = document.createElement("div");
  el.className = hasWater ? "atmosphere-air atmosphere-air--coastal" : "atmosphere-air";
  const cloudsBounds = { x: 0.04, y: 0.01, width: 0.92, height: hasWater ? 0.22 : 0.2 };
  applyNormalizedBounds(el, cloudsBounds);
  el.replaceChildren(
    ...Array.from({ length: hasWater ? 5 : 4 }, (_, index) => {
      const bank = document.createElement("span");
      bank.className = "atmosphere-cloud-bank";
      bank.style.setProperty("--ambient-x", `${10 + ((index * 23) % 78)}%`);
      bank.style.setProperty("--ambient-y", `${6 + ((index * 11) % 42)}%`);
      bank.style.setProperty("--ambient-delay", `${-(index * 2.1)}s`);
      bank.style.setProperty("--ambient-duration", `${18 + (index % 3) * 4}s`);
      bank.style.setProperty("--cloud-scale", `${0.82 + (index % 3) * 0.14}`);
      bank.innerHTML = renderEnvironmentParticleMarkup("cloud");
      return bank;
    }),
    ...Array.from({ length: hasWater ? 4 : 3 }, (_, index) => {
      const cloud = document.createElement("span");
      cloud.className = "atmosphere-cloud-wisp";
      cloud.style.setProperty("--ambient-x", `${5 + ((index * 28) % 74)}%`);
      cloud.style.setProperty("--ambient-y", `${6 + ((index * 17) % 62)}%`);
      cloud.style.setProperty("--ambient-delay", `${-(index * 1.3)}s`);
      cloud.style.setProperty("--ambient-duration", `${18 + (index % 3) * 3}s`);
      cloud.innerHTML = renderEnvironmentParticleMarkup("cloud");
      return cloud;
    }),
    ...Array.from({ length: hasWater ? 6 : 4 }, (_, index) => {
      const breeze = document.createElement("span");
      breeze.className = "atmosphere-breeze";
      breeze.style.setProperty("--ambient-y", `${15 + ((index * 18) % 64)}%`);
      breeze.style.setProperty("--ambient-delay", `${-(index * 0.8)}s`);
      breeze.style.setProperty("--ambient-duration", `${8 + (index % 3) * 1.4}s`);
      return breeze;
    }),
    ...Array.from({ length: hasWater || hasBirdPlan ? 5 : 0 }, (_, index) => {
      const bird = document.createElement("span");
      bird.className = "atmosphere-bird";
      bird.style.setProperty("--ambient-x", `${8 + ((index * 19) % 78)}%`);
      bird.style.setProperty("--ambient-y", `${18 + ((index * 13) % 56)}%`);
      bird.style.setProperty("--ambient-delay", `${-(index * 0.65)}s`);
      bird.style.setProperty("--ambient-duration", `${5.8 + (index % 3) * 0.9}s`);
      bird.innerHTML = renderEnvironmentParticleMarkup("birds");
      return bird;
    })
  );
  return el;
}

function mergeNormalizedBounds(boundsList) {
  const validBounds = boundsList.filter(Boolean);
  if (!validBounds.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x1 = Math.min(...validBounds.map((bounds) => bounds.x));
  const y1 = Math.min(...validBounds.map((bounds) => bounds.y));
  const x2 = Math.max(...validBounds.map((bounds) => bounds.x + bounds.width));
  const y2 = Math.max(...validBounds.map((bounds) => bounds.y + bounds.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function getNormalizedEnvironmentBounds(layer) {
  return isNormalizedBounds(layer?.bounds) ? layer.bounds : { x: 0, y: 0, width: 1, height: 1 };
}

function expandNormalizedBounds(bounds, amount) {
  const x = clamp01(bounds.x - amount.x);
  const y = clamp01(bounds.y - amount.y);
  const x2 = clamp01(bounds.x + bounds.width + amount.width);
  const y2 = clamp01(bounds.y + bounds.height + amount.height);
  return {
    x,
    y,
    width: Math.max(0.04, x2 - x),
    height: Math.max(0.04, y2 - y)
  };
}

function applyNormalizedBounds(el, bounds) {
  el.style.left = `${bounds.x * 100}%`;
  el.style.top = `${bounds.y * 100}%`;
  el.style.width = `${bounds.width * 100}%`;
  el.style.height = `${bounds.height * 100}%`;
}

function isRenderableEnvironmentLayer(layer) {
  const kind = normalizeEnvironmentKind(layer.kind);
  const bounds = layer.bounds;
  if (kind === "marine_life") {
    return bounds?.width >= 0.07 && bounds?.height >= 0.05 && bounds.y <= 0.86;
  }
  return true;
}

function renderEnvironmentLayer(layer, scene) {
  const el = document.createElement("div");
  const kind = normalizeEnvironmentKind(layer.kind);
  const intensity = layer.intensity === "medium" ? "medium" : "subtle";
  const bounds = layer.bounds ?? scene.coordinateSpace;
  const space = scene.coordinateSpace;
  const isNormalized = layer.coordinateSpace === "normalized" || isNormalizedBounds(bounds);
  el.className = `environment-layer environment-layer--${kind} environment-layer--${intensity}`;
  el.style.left = `${(isNormalized ? bounds.x : bounds.x / space.width) * 100}%`;
  el.style.top = `${(isNormalized ? bounds.y : bounds.y / space.height) * 100}%`;
  el.style.width = `${(isNormalized ? bounds.width : bounds.width / space.width) * 100}%`;
  el.style.height = `${(isNormalized ? bounds.height : bounds.height / space.height) * 100}%`;
  el.dataset.replacement = "code";
  el.replaceChildren(...createEnvironmentParticles(layer, kind, intensity));
  return el;
}

function isSafeFallbackEnvironmentLayer(layer) {
  return ["light", "cloud"].includes(normalizeEnvironmentKind(layer.kind));
}

function isNormalizedBounds(bounds) {
  return (
    Number.isFinite(bounds?.x) &&
    Number.isFinite(bounds?.y) &&
    Number.isFinite(bounds?.width) &&
    Number.isFinite(bounds?.height) &&
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.width <= 1 &&
    bounds.height <= 1
  );
}

function createEnvironmentParticles(layer, kind, intensity) {
  const countByKind = {
    cloud: intensity === "medium" ? 6 : 4,
    water: intensity === "medium" ? 8 : 6,
    foliage: intensity === "medium" ? 8 : 5,
    marine_life: intensity === "medium" ? 4 : 3,
    birds: intensity === "medium" ? 6 : 4,
    traffic: intensity === "medium" ? 5 : 3,
    crowd: intensity === "medium" ? 5 : 3,
    light: 1
  };
  const count = countByKind[kind] ?? 2;
  return Array.from({ length: count }, (_, index) => {
    const particle = document.createElement("span");
    particle.className = `environment-particle environment-particle--${kind}`;
    particle.style.setProperty("--ambient-x", `${seededPercent(layer.id, index, 17)}%`);
    particle.style.setProperty("--ambient-y", `${seededPercent(layer.id, index, 53)}%`);
    particle.style.setProperty("--ambient-delay", `${-(index * 0.9)}s`);
    particle.style.setProperty("--ambient-duration", `${environmentParticleDuration(kind, index, intensity)}s`);
    particle.innerHTML = renderEnvironmentParticleMarkup(kind);
    return particle;
  });
}

function renderEnvironmentParticleMarkup(kind) {
  if (kind === "birds") {
    return `
      <svg class="ambient-svg ambient-bird-svg" viewBox="0 0 64 32" aria-hidden="true" focusable="false">
        <path class="ambient-bird-wing ambient-bird-wing--left" d="M31 17 C22 6 12 4 3 15" />
        <path class="ambient-bird-wing ambient-bird-wing--right" d="M33 17 C43 5 53 4 61 15" />
      </svg>
    `;
  }

  if (kind === "water") {
    return `
      <svg class="ambient-svg ambient-water-svg" viewBox="0 0 160 36" aria-hidden="true" focusable="false">
        <path class="ambient-water-line ambient-water-line--wide" d="M3 18 C24 7 42 29 65 18 S108 8 132 18 S151 28 157 18" />
        <path class="ambient-water-line ambient-water-line--thin" d="M24 27 C43 19 58 31 77 27 S116 19 138 27" />
      </svg>
    `;
  }

  if (kind === "marine_life") {
    return `
      <svg class="ambient-svg ambient-marine-svg" viewBox="0 0 96 56" aria-hidden="true" focusable="false">
        <path class="ambient-marine-body" d="M23 32 C36 12 59 8 75 22 C61 22 49 30 38 42 C33 38 28 35 23 32 Z" />
        <path class="ambient-marine-fin" d="M51 22 C48 13 53 8 61 5 C60 14 58 21 51 22 Z" />
        <path class="ambient-marine-splash" d="M10 43 C23 36 35 48 49 42 S76 37 88 44" />
      </svg>
    `;
  }

  if (kind === "foliage") {
    return `
      <svg class="ambient-svg ambient-leaf-svg" viewBox="0 0 40 52" aria-hidden="true" focusable="false">
        <path class="ambient-leaf-body" d="M20 3 C34 14 35 33 20 49 C5 33 6 14 20 3 Z" />
        <path class="ambient-leaf-vein" d="M20 9 L20 45" />
      </svg>
    `;
  }

  if (kind === "cloud") {
    return `
      <svg class="ambient-svg ambient-cloud-svg" viewBox="0 0 180 70" aria-hidden="true" focusable="false">
        <path class="ambient-cloud-fill" d="M23 45 C28 25 47 20 62 29 C72 10 104 10 114 31 C130 24 153 32 158 47 C128 56 59 58 23 45 Z" />
        <path class="ambient-cloud-line" d="M29 45 C45 50 65 49 81 44 C100 51 131 52 153 47" />
      </svg>
    `;
  }

  return "";
}

function environmentParticleDuration(kind, index, intensity) {
  const mediumOffset = intensity === "medium" ? -0.7 : 0;
  const baseByKind = {
    birds: 4.8,
    marine_life: 4.2,
    water: 4.6,
    foliage: 5.4,
    cloud: 11,
    traffic: 4.8,
    crowd: 4.8,
    light: 16
  };
  const base = baseByKind[kind] ?? 6;
  return Math.max(3.2, base + mediumOffset + (index % 3) * 0.55);
}

function normalizeEnvironmentKind(kind) {
  const value = String(kind ?? "light").trim().toLowerCase().replace(/[-\s]+/g, "_");
  return ["cloud", "water", "foliage", "marine_life", "birds", "traffic", "crowd", "light"].includes(value)
    ? value
    : "light";
}

function seededPercent(seed, index, salt) {
  const text = String(seed ?? "ambient");
  let value = salt + index * 31;
  for (let i = 0; i < text.length; i += 1) {
    value = (value + text.charCodeAt(i) * (i + 3)) % 100;
  }
  return Math.max(5, Math.min(95, value));
}

function bindPageClick() {
  elements.viewport.addEventListener("click", (event) => {
    if (event.target.closest("button, a, .detail-sheet, .scene-hud, .map-hotspot-hit, .image-target-hotspot")) {
      return;
    }
    resolveClickAt(event);
  });
}

function getSceneCanvasRect() {
  return elements.stage.querySelector(".scene-canvas")?.getBoundingClientRect() ?? elements.stage.getBoundingClientRect();
}

function getSceneClickRect() {
  const image = elements.stage.querySelector(".scene-image");
  if (image?.naturalWidth && image.naturalHeight) {
    return getContainedImageRect(image);
  }
  return getSceneCanvasRect();
}

function getContainedImageRect(image) {
  const elementRect = image.getBoundingClientRect();
  const scale = Math.min(
    elementRect.width / image.naturalWidth,
    elementRect.height / image.naturalHeight
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const left = elementRect.left + (elementRect.width - width) / 2;
  const top = elementRect.top + (elementRect.height - height) / 2;
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

async function resolveClickAt(event) {
  if (state.isResolvingClick || state.pendingJob) {
    return;
  }

  const stageRect = getSceneClickRect();
  const normalizedClick = {
    x: clamp01((event.clientX - stageRect.left) / stageRect.width),
    y: clamp01((event.clientY - stageRect.top) / stageRect.height)
  };
  const imageClick = computeImageClick(event);
  const requestPage = getCurrentRequestPage();
  const environmentUrl = imageClick ? getPageEnvironmentUrl(requestPage) : null;
  const environmentPlan = environmentUrl ? state.environmentPlans.get(environmentUrl) : null;
  // Runtime artwork must navigate through its image-specific target map. A
  // background click is deliberately not sent to the per-click VLM: that
  // guess could turn a Heritage Belt click into Changi or Sentosa. Exact
  // target buttons stop propagation above and submit their curated node id.
  if (imageClick && isRuntimeArtworkPage(requestPage)) {
    if (!environmentUrl || !environmentPlan || environmentPlan.status === "request_failed") {
      if (environmentUrl) requestEnvironmentPlan(environmentUrl);
      renderTransientScrollStatus("Preparing accurate location targets…");
      return;
    }
    renderTransientScrollStatus(
      environmentPlan.targets?.length
        ? "Click directly on a mapped location."
        : "Location targets are not ready yet."
    );
    return;
  }
  // Non-runtime artwork can still use the image-aware resolver. Runtime
  // artwork with a target plan has already returned above unless an exact
  // curated target button handled the click.
  const immediatePage = imageClick ? null : buildImmediatePageFromClick(normalizedClick);
  if (immediatePage) {
    enterReadyPage(immediatePage);
    return;
  }

  const navigationRequest = beginNavigationRequest();
  beginNavigationFeedback();
  try {
    const result = await requestFlipbookPage({
      normalizedClick,
      imageClick,
      signal: navigationRequest.signal
    });
    if (!isNavigationRequestCurrent(navigationRequest.id)) return;
    runFlipbookResult(result);
    finishNavigationRequest(navigationRequest.id);
  } catch (error) {
    if (!isNavigationRequestCurrent(navigationRequest.id)) return;
    cancelPendingNavigation();
    renderDetour({
      confidence: "unconfirmed",
      title: "Click failed",
      message: explainClickError(error)
    });
  }
}

function isRuntimeArtworkPage(page) {
  const imageUrl = page?.imageUrl ?? page?.generated?.imageUrl;
  return typeof imageUrl === "string" && imageUrl.includes("/runtime-cache/");
}

function renderTransientScrollStatus(message) {
  renderScrollStatus(message);
  window.setTimeout(() => {
    const label = elements.viewport.querySelector(".scroll-status-label");
    if (label?.textContent === message) clearScrollStatus();
  }, 1800);
}

function buildImmediatePageFromClick(normalizedClick) {
  if (!state.activePack || !state.currentPage || !normalizedClick) return null;

  const result = resolveFlipbookClick({
    currentPage: getCurrentRequestPage(),
    normalizedClick,
    scenes: state.activePack.scenes,
    nodes: state.activePack.nodes,
    sceneArtwork: {},
    countryName: state.activePack.title
  });

  return result.click?.status === "matched" ? mergePrefetchedArtwork(result.page) : null;
}

async function resolveOverlayTarget(target) {
  if (state.isResolvingClick || state.pendingJob) {
    return;
  }

  const immediatePage = buildImmediatePageFromTarget(target);
  if (immediatePage) {
    enterReadyPage(immediatePage);
    return;
  }

  const navigationRequest = beginNavigationRequest();
  const node = target.nodeId ? state.activePack.nodes[target.nodeId] : null;
  beginNavigationFeedback(node?.title);
  try {
    const result = await requestFlipbookPage({
      normalizedClick: target.normalizedClick,
      targetNodeId: target.nodeId,
      detourPhrase: target.detourPhrase,
      signal: navigationRequest.signal
    });
    if (!isNavigationRequestCurrent(navigationRequest.id)) return;
    runFlipbookResult(result);
    finishNavigationRequest(navigationRequest.id);
  } catch (error) {
    if (!isNavigationRequestCurrent(navigationRequest.id)) return;
    cancelPendingNavigation();
    renderDetour({
      confidence: "unconfirmed",
      title: "Click failed",
      message: explainClickError(error)
    });
  }
}

function buildImmediatePageFromTarget(target) {
  if (!target?.nodeId || !state.activePack?.nodes[target.nodeId]) return null;

  const result = resolveFlipbookClick({
    currentPage: getCurrentRequestPage(),
    normalizedClick: target.normalizedClick ?? { x: 0.5, y: 0.5 },
    targetNodeId: target.nodeId,
    scenes: state.activePack.scenes,
    nodes: state.activePack.nodes,
    sceneArtwork: {},
    countryName: state.activePack.title
  });

  return mergePrefetchedArtwork(result.page);
}

function beginNavigationFeedback(title) {
  elements.viewport.classList.add("is-busy");
  renderLoadingPanel({
    pageTitle: title ?? "next page",
    fallbackMessage: title ? `Opening ${title}…` : "Exploring…"
  });
}

function endNavigationFeedback() {
  elements.viewport.classList.remove("is-busy");
  clearLoadingPanel();
}

function beginNavigationRequest() {
  navigationAbortController?.abort();
  navigationAbortController = new AbortController();
  const id = ++navigationRequestSequence;
  state.activeNavigationRequestId = id;
  state.isResolvingClick = true;
  return { id, signal: navigationAbortController.signal };
}

function isNavigationRequestCurrent(id) {
  return state.activeNavigationRequestId === id;
}

function finishNavigationRequest(id) {
  if (!isNavigationRequestCurrent(id)) return;
  navigationAbortController = null;
  state.activeNavigationRequestId = null;
  state.isResolvingClick = false;
  endNavigationFeedback();
}

function cancelPendingNavigation() {
  navigationAbortController?.abort();
  navigationAbortController = null;
  state.activeNavigationRequestId = null;
  state.isResolvingClick = false;
  endNavigationFeedback();
}

async function requestFlipbookPage({
  normalizedClick,
  imageClick = null,
  targetNodeId = null,
  detourPhrase = null,
  signal = undefined
}) {
  const response = await fetch(apiPath("/api/flipbook/click"), {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPage: getCurrentRequestPage(),
      normalizedClick,
      imageClick,
      targetNodeId,
      detourPhrase
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Flipbook click failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
  }

  return response.json();
}

function getCurrentRequestPage() {
  const sceneArtwork = state.artworkByScene.get(state.currentSceneId);
  const pageArtwork = state.artworkByPage.get(getPageArtworkCacheKey(state.currentPage));
  const scene = state.activePack?.scenes?.[state.currentSceneId];
  const cachedArtwork = scene && state.currentPage.nodeId === scene.rootNodeId
    ? sceneArtwork
    : pageArtwork;
  const imageUrl = state.currentPage.imageUrl ?? cachedArtwork?.imageUrl ?? null;
  return imageUrl === state.currentPage.imageUrl
    ? state.currentPage
    : {
        ...state.currentPage,
        imageUrl,
        environmentUrl: cachedArtwork?.environmentUrl,
        artworkDecoded: Boolean(cachedArtwork?.decoded),
        status: imageUrl ? "ready" : state.currentPage.status
      };
}

async function requestSceneArtwork(sceneId, { jobKind = "interactive" } = {}) {
  if (state.artworkByScene.has(sceneId) || state.artworkJobs.has(sceneId)) {
    return;
  }

  const attemptId = ++artworkAttemptSequence;
  state.artworkJobs.set(sceneId, {
    status: "requesting",
    jobKind,
    countrySlug: state.activeCountrySlug,
    attemptId,
    startedAt: Date.now(),
    attempts: 0
  });
  render();
  try {
    const params = new URLSearchParams({
      countrySlug: state.activeCountrySlug,
      sceneId
    });
    if (jobKind === "interactive") {
      params.set("priority", "interactive");
    }
    const response = await fetchArtworkResource(apiPath(`/api/artwork?${params.toString()}`), { cache: "no-store" });
    if (!response.ok) throw new Error(`Artwork request failed: ${response.status}`);
    const { page } = await response.json();
    if (!isCurrentArtworkAttempt(sceneId, attemptId)) return;
    if (page.status === "ready" && page.imageUrl) {
      await completeSceneArtwork(sceneId, page, page, attemptId);
      return;
    }

    const jobUrl = page.generated?.jobUrl;
    if (!jobUrl) {
      markArtworkJobFailed(sceneId, "The illustration job did not provide a status URL. Retry to start it again.");
      return;
    }
    state.artworkJobs.set(sceneId, {
      ...state.artworkJobs.get(sceneId),
      status: page.status ?? "pending_codex_image_generation",
      page,
      jobKind,
      jobUrl
    });
    startArtworkPoller(
      sceneId,
      (currentAttemptId) => pollArtworkJob(sceneId, jobUrl, page, currentAttemptId),
      attemptId
    );
  } catch (error) {
    if (!isCurrentArtworkAttempt(sceneId, attemptId)) return;
    markArtworkJobFailed(sceneId, explainClickError(error));
  }
}

async function requestCurrentPageArtwork({ jobKind = "interactive" } = {}) {
  const page = state.currentPage;
  const artworkJobKey = getPageArtworkJobKey(page);
  if (!page.nodeId || page.imageUrl || state.artworkJobs.has(artworkJobKey)) {
    return;
  }

  const attemptId = ++artworkAttemptSequence;
  state.artworkJobs.set(artworkJobKey, {
    status: "requesting",
    jobKind,
    countrySlug: state.activeCountrySlug,
    page,
    attemptId,
    startedAt: Date.now(),
    attempts: 0
  });
  render();
  try {
    const params = new URLSearchParams({
      countrySlug: state.activeCountrySlug,
      sceneId: page.sceneId,
      nodeId: page.nodeId
    });
    if (jobKind === "interactive") {
      params.set("priority", "interactive");
    }
    const response = await fetchArtworkResource(apiPath(`/api/artwork?${params.toString()}`), { cache: "no-store" });
    if (!response.ok) throw new Error(`Artwork request failed: ${response.status}`);
    const { page: artworkPage } = await response.json();
    if (!isCurrentArtworkAttempt(artworkJobKey, attemptId)) return;
    if (artworkPage.status === "ready" && artworkPage.imageUrl) {
      await completeCurrentPageArtwork(artworkJobKey, page, artworkPage, attemptId);
      return;
    }

    const jobUrl = artworkPage.generated?.jobUrl;
    if (!jobUrl) {
      markArtworkJobFailed(artworkJobKey, "The illustration job did not provide a status URL. Retry to start it again.");
      return;
    }
    state.artworkJobs.set(artworkJobKey, {
      ...state.artworkJobs.get(artworkJobKey),
      status: artworkPage.status ?? "pending_codex_image_generation",
      page: artworkPage,
      targetPage: page,
      jobKind,
      jobUrl
    });
    startArtworkPoller(
      artworkJobKey,
      (currentAttemptId) => pollCurrentPageArtworkJob(
        artworkJobKey,
        jobUrl,
        page,
        artworkPage,
        currentAttemptId
      ),
      attemptId
    );
  } catch (error) {
    if (!isCurrentArtworkAttempt(artworkJobKey, attemptId)) return;
    markArtworkJobFailed(artworkJobKey, explainClickError(error));
  }
}

async function pollArtworkJob(sceneId, jobUrl, page, attemptId) {
  if (shouldStopArtworkPolling(sceneId, attemptId)) return;
  try {
    const response = await fetchArtworkResource(toApiUrl(jobUrl), { cache: "no-store" });
    if (!isCurrentArtworkAttempt(sceneId, attemptId, jobUrl)) return;
    recordArtworkPollAttempt(sceneId, attemptId);
    if (!response.ok) {
      if (shouldStopArtworkPolling(sceneId, attemptId)) return;
      return;
    }
    const job = await response.json();
    if (!isCurrentArtworkAttempt(sceneId, attemptId, jobUrl)) return;
    const activeJob = state.artworkJobs.get(sceneId);
    if (!activeJob || activeJob.status === "decoding_image" || activeJob.status === "ready") return;
    const didChange = copyArtworkJobStatus(sceneId, job, page);
    if (job.partialImageUrl && job.status !== "ready") {
      preparePartialArtwork(sceneId, job.partialImageUrl, attemptId);
    }
    if (isArtworkJobFailed(job)) {
      markArtworkJobFailed(sceneId, job.error ?? "Illustration generation failed.", { status: job.status });
      return;
    }
    if (job.status === "ready" && !job.imageUrl) {
      markArtworkJobFailed(sceneId, "Illustration completed without an image. Retry to generate it again.");
      return;
    }
    if (job.status === "ready" && job.imageUrl) {
      stopArtworkPoller(sceneId);
      await completeSceneArtwork(sceneId, page, job, attemptId);
      return;
    }
    if (didChange && isArtworkJobVisible(sceneId)) render();
  } catch (error) {
    if (!isCurrentArtworkAttempt(sceneId, attemptId, jobUrl)) return;
    recordArtworkPollAttempt(sceneId, attemptId);
    if (shouldStopArtworkPolling(sceneId, attemptId)) return;
    copyArtworkJobStatus(sceneId, {
      status: state.artworkJobs.get(sceneId)?.status ?? "waiting_for_job",
      lastPollError: explainClickError(error)
    }, page);
  }
}

async function pollCurrentPageArtworkJob(
  artworkJobKey,
  jobUrl,
  targetPage,
  artworkPage = targetPage,
  attemptId
) {
  if (shouldStopArtworkPolling(artworkJobKey, attemptId)) return;
  try {
    const response = await fetchArtworkResource(toApiUrl(jobUrl), { cache: "no-store" });
    if (!isCurrentArtworkAttempt(artworkJobKey, attemptId, jobUrl)) return;
    recordArtworkPollAttempt(artworkJobKey, attemptId);
    if (!response.ok) {
      if (shouldStopArtworkPolling(artworkJobKey, attemptId)) return;
      return;
    }
    const job = await response.json();
    if (!isCurrentArtworkAttempt(artworkJobKey, attemptId, jobUrl)) return;
    const activeJob = state.artworkJobs.get(artworkJobKey);
    if (!activeJob || activeJob.status === "decoding_image" || activeJob.status === "ready") return;
    const didChange = copyArtworkJobStatus(artworkJobKey, job, artworkPage);
    if (job.partialImageUrl && job.status !== "ready") {
      preparePartialArtwork(artworkJobKey, job.partialImageUrl, attemptId);
    }
    if (isArtworkJobFailed(job)) {
      markArtworkJobFailed(artworkJobKey, job.error ?? "Illustration generation failed.", { status: job.status });
      return;
    }
    if (job.status === "ready" && !job.imageUrl) {
      markArtworkJobFailed(artworkJobKey, "Illustration completed without an image. Retry to generate it again.");
      return;
    }
    if (job.status === "ready" && job.imageUrl) {
      stopArtworkPoller(artworkJobKey);
      await completeCurrentPageArtwork(
        artworkJobKey,
        targetPage,
        { ...artworkPage, ...job },
        attemptId
      );
      return;
    }
    if (didChange && isArtworkJobVisible(artworkJobKey)) render();
  } catch (error) {
    if (!isCurrentArtworkAttempt(artworkJobKey, attemptId, jobUrl)) return;
    recordArtworkPollAttempt(artworkJobKey, attemptId);
    if (shouldStopArtworkPolling(artworkJobKey, attemptId)) return;
    copyArtworkJobStatus(artworkJobKey, {
      status: state.artworkJobs.get(artworkJobKey)?.status ?? "waiting_for_job",
      lastPollError: explainClickError(error)
    }, artworkPage);
  }
}

function startArtworkPoller(artworkJobKey, tick, attemptId) {
  stopArtworkPoller(artworkJobKey);
  const current = state.artworkJobs.get(artworkJobKey) ?? {};
  let pollInFlight = false;
  const guardedTick = async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      await tick(attemptId);
    } finally {
      pollInFlight = false;
    }
  };
  const intervalId = window.setInterval(guardedTick, ARTWORK_POLL_INTERVAL_MS);
  state.artworkJobs.set(artworkJobKey, {
    ...current,
    attemptId,
    intervalId,
    startedAt: current.startedAt ?? Date.now(),
    attempts: current.attempts ?? 0
  });
  guardedTick();
}

function stopArtworkPoller(artworkJobKey) {
  const current = state.artworkJobs.get(artworkJobKey);
  if (current?.intervalId) {
    window.clearInterval(current.intervalId);
    state.artworkJobs.set(artworkJobKey, { ...current, intervalId: null });
  }
}

function recordArtworkPollAttempt(artworkJobKey, attemptId) {
  const current = state.artworkJobs.get(artworkJobKey);
  if (!current || current.attemptId !== attemptId) return;
  state.artworkJobs.set(artworkJobKey, {
    ...current,
    attempts: (current.attempts ?? 0) + 1
  });
}

function shouldStopArtworkPolling(artworkJobKey, attemptId) {
  const current = state.artworkJobs.get(artworkJobKey);
  if (!current || current.attemptId !== attemptId || isArtworkJobFailed(current)) return true;
  if (current.status === "ready") {
    if (!current.imageUrl) {
      markArtworkJobFailed(
        artworkJobKey,
        "Illustration completed without an image. Retry to generate it again."
      );
    } else {
      stopArtworkPoller(artworkJobKey);
    }
    return true;
  }
  const elapsed = Date.now() - (current.startedAt ?? Date.now());
  if (elapsed < ARTWORK_POLL_TIMEOUT_MS && (current.attempts ?? 0) < ARTWORK_POLL_MAX_ATTEMPTS) {
    return false;
  }
  markArtworkJobFailed(
    artworkJobKey,
    "The illustration is taking longer than expected. The page remains usable; retry when you are ready.",
    { status: "timed_out" }
  );
  return true;
}

function copyArtworkJobStatus(artworkJobKey, job, page) {
  const current = state.artworkJobs.get(artworkJobKey);
  if (!current) return false;
  const didChange = ["status", "partialImageUrl", "imageUrl", "error", "environmentStatus"]
    .some((field) => current[field] !== job[field]);
  state.artworkJobs.set(artworkJobKey, {
    ...current,
    ...job,
    page: current.page ?? page,
    intervalId: current.intervalId,
    startedAt: current.startedAt,
    attempts: current.attempts
  });
  return didChange;
}

function isCurrentArtworkAttempt(artworkJobKey, attemptId, jobUrl = null) {
  const current = state.artworkJobs.get(artworkJobKey);
  return Boolean(
    current &&
    current.attemptId === attemptId &&
    (!jobUrl || current.jobUrl === jobUrl)
  );
}

function isArtworkJobVisible(artworkJobKey) {
  return state.currentView === "explorer" &&
    getArtworkJobKeyForPage(state.currentPage) === artworkJobKey;
}

function markArtworkJobFailed(artworkJobKey, error, { status = "failed" } = {}) {
  stopArtworkPoller(artworkJobKey);
  const current = state.artworkJobs.get(artworkJobKey) ?? {};
  state.artworkJobs.set(artworkJobKey, {
    ...current,
    status,
    error: getArtworkFailureMessage(error),
    intervalId: null
  });
  if (getArtworkJobKeyForPage(state.currentPage) === artworkJobKey) {
    state.currentPage = { ...state.currentPage, status: "artwork_failed" };
  }
  if (isArtworkJobVisible(artworkJobKey)) render();
}

async function completeSceneArtwork(sceneId, page, imageResult, attemptId = null) {
  if (attemptId != null && !isCurrentArtworkAttempt(sceneId, attemptId)) return;
  const imageUrl = imageResult.imageUrl ?? page.imageUrl;
  const current = state.artworkJobs.get(sceneId) ?? {};
  state.artworkJobs.set(sceneId, {
    ...current,
    status: "decoding_image",
    serverStatus: imageResult.status ?? page.status,
    imageUrl
  });
  if (isArtworkJobVisible(sceneId)) render();
  try {
    await preloadArtworkImage(imageUrl);
  } catch (error) {
    if (attemptId != null && !isCurrentArtworkAttempt(sceneId, attemptId)) return;
    markArtworkJobFailed(sceneId, explainClickError(error));
    return;
  }
  if (attemptId != null && !isCurrentArtworkAttempt(sceneId, attemptId)) return;

  stopArtworkPoller(sceneId);
  const environmentUrl = getPageEnvironmentUrl({ ...page, ...imageResult });
  const readyPage = { ...page, imageUrl, environmentUrl, status: "ready", artworkDecoded: true };
  state.artworkByScene.set(sceneId, {
    imageUrl,
    environmentUrl,
    page: readyPage,
    decoded: true
  });
  state.artworkJobs.delete(sceneId);
  const scene = state.activePack?.scenes?.[sceneId];
  if (
    scene &&
    state.currentSceneId === sceneId &&
    state.currentPage.nodeId === scene.rootNodeId &&
    !state.currentPage.imageUrl
  ) {
    state.currentPage = {
      ...state.currentPage,
      imageUrl,
      environmentUrl,
      status: "ready",
      artworkDecoded: true
    };
  }
  if (isArtworkJobVisible(sceneId)) render();
}

async function completeCurrentPageArtwork(artworkJobKey, targetPage, imageResult, attemptId = null) {
  if (attemptId != null && !isCurrentArtworkAttempt(artworkJobKey, attemptId)) return;
  const imageUrl = imageResult.imageUrl;
  const current = state.artworkJobs.get(artworkJobKey) ?? {};
  state.artworkJobs.set(artworkJobKey, {
    ...current,
    status: "decoding_image",
    serverStatus: imageResult.status,
    imageUrl
  });
  if (isArtworkJobVisible(artworkJobKey)) render();
  try {
    await preloadArtworkImage(imageUrl);
  } catch (error) {
    if (attemptId != null && !isCurrentArtworkAttempt(artworkJobKey, attemptId)) return;
    markArtworkJobFailed(artworkJobKey, explainClickError(error));
    return;
  }
  if (attemptId != null && !isCurrentArtworkAttempt(artworkJobKey, attemptId)) return;

  stopArtworkPoller(artworkJobKey);
  const environmentUrl = getPageEnvironmentUrl({ ...targetPage, ...imageResult });
  const readyPage = {
    ...targetPage,
    ...imageResult,
    imageUrl,
    environmentUrl,
    status: "ready",
    artworkDecoded: true
  };
  state.artworkByPage.set(getPageArtworkCacheKey(targetPage), {
    imageUrl,
    environmentUrl,
    page: readyPage,
    decoded: true
  });
  state.artworkJobs.delete(artworkJobKey);
  if (
    state.currentPage.nodeId === targetPage.nodeId &&
    state.currentPage.sceneId === targetPage.sceneId &&
    !state.currentPage.imageUrl
  ) {
    state.currentPage = {
      ...state.currentPage,
      imageUrl,
      environmentUrl,
      status: "ready",
      artworkDecoded: true
    };
  }
  if (isArtworkJobVisible(artworkJobKey)) render();
}

async function preparePartialArtwork(artworkJobKey, partialImageUrl, attemptId) {
  const current = state.artworkJobs.get(artworkJobKey);
  if (
    !current ||
    current.attemptId !== attemptId ||
    current.decodedPartialImageUrl === partialImageUrl ||
    current.loadingPartialImageUrl === partialImageUrl
  ) {
    return;
  }
  state.artworkJobs.set(artworkJobKey, {
    ...current,
    loadingPartialImageUrl: partialImageUrl
  });
  try {
    await preloadArtworkImage(partialImageUrl);
    const latest = state.artworkJobs.get(artworkJobKey);
    if (
      !latest ||
      latest.attemptId !== attemptId ||
      latest.status === "ready" ||
      isArtworkJobFailed(latest)
    ) return;
    state.artworkJobs.set(artworkJobKey, {
      ...latest,
      decodedPartialImageUrl: partialImageUrl,
      loadingPartialImageUrl: null
    });
    if (isArtworkJobVisible(artworkJobKey)) render();
  } catch {
    const latest = state.artworkJobs.get(artworkJobKey);
    if (!latest || latest.attemptId !== attemptId) return;
    state.artworkJobs.set(artworkJobKey, {
      ...latest,
      loadingPartialImageUrl: null,
      partialImageFailed: true
    });
  }
}

function computeImageClick(event) {
  const image = elements.stage.querySelector(".scene-image");
  if (!image?.naturalWidth || !image?.naturalHeight) {
    return null;
  }

  const imageRect = getContainedImageRect(image);
  const scale = imageRect.width / image.naturalWidth;
  const imageX = clamp(event.clientX - imageRect.left, 0, imageRect.width) / scale;
  const imageY = clamp(event.clientY - imageRect.top, 0, imageRect.height) / scale;

  return {
    normalizedImage: {
      x: clamp01(imageX / image.naturalWidth),
      y: clamp01(imageY / image.naturalHeight)
    },
    pixel: {
      x: Math.round(imageX),
      y: Math.round(imageY)
    },
    naturalSize: {
      width: image.naturalWidth,
      height: image.naturalHeight
    },
    objectFit: "contain"
  };
}

function runFlipbookResult(result) {
  if (result.click?.resolver === "vlm_guard") {
    endNavigationFeedback();
    renderDetour({
      confidence: "unresolved",
      title: "Click not resolved",
      message: "RoamAtlas could not identify that exact image region confidently enough, so it did not turn to the wrong page."
    });
    return;
  }
  const page = mergePrefetchedArtwork(result.page);
  if (page.nodeId) {
    setBrowserPath(canonicalRouteForNode(state.activeCountrySlug, page.nodeId, state.activePack));
  }
  if (
    page.status === "generation_required" ||
    page.status === "pending_codex_image_generation" ||
    (page.imageUrl && !page.artworkDecoded)
  ) {
    renderImageGenerationPending(page, result);
    return;
  }

  enterReadyPage(page);
}

function renderTile(tile, coordinateSpace) {
  const el = document.createElement("div");
  el.className = `tile tile--${tile.column % 4}`;
  el.style.left = toScenePercent(tile.bounds.x, coordinateSpace.width);
  el.style.top = toScenePercent(tile.bounds.y, coordinateSpace.height);
  el.style.width = toScenePercent(tile.bounds.width, coordinateSpace.width);
  el.style.height = toScenePercent(tile.bounds.height, coordinateSpace.height);
  const generated = findGeneratedTile(tile);
  if (generated?.imageUrl) {
    el.classList.add("tile--image");
    el.style.backgroundImage = `url("${generated.imageUrl}")`;
  } else {
    el.append(renderTileArt(tile));
  }
  return el;
}

function findGeneratedTile(tile) {
  return (
    generatedTiles[tile.cacheKey] ??
    Object.values(generatedTiles).find((item) => item.tileId === tile.id)
  );
}

function renderTileArt(tile) {
  const art = document.createElement("div");
  art.className = "tile-art";
  art.dataset.column = String(tile.column);
  art.innerHTML = `
    <span class="wash wash-a"></span>
    <span class="wash wash-b"></span>
    <span class="ink-line line-a"></span>
    <span class="ink-line line-b"></span>
    <span class="motif motif-a"></span>
    <span class="motif motif-b"></span>
    <span class="motif motif-c"></span>
    <span class="path path-a"></span>
    <span class="path path-b"></span>
  `;
  return art;
}

function getDetailNode() {
  const nodeId = state.currentPage?.nodeId;
  if (!nodeId || nodeId === state.activePack.rootNodeId) return null;
  return state.activePack.nodes[nodeId] ?? null;
}

function formatNodeType(type) {
  return String(type ?? "place").replace(/_/g, " ");
}

function renderNodeDetail() {
  if (state.detailOverride) {
    const detour = state.detailOverride;
    elements.detailSheet.classList.add("is-open", "is-expanded");
    elements.detailSheet.classList.remove("is-compact");
    elements.nodeDetail.innerHTML = `
      <div class="detail-sheet-head">
        <div class="detail-sheet-copy">
          <span class="detail-sheet-type">${escapeHtml(detour.confidence)}</span>
          <strong class="detail-sheet-title">${escapeHtml(detour.title)}</strong>
        </div>
      </div>
      <p class="detail-sheet-fact">${escapeHtml(detour.message)}</p>
    `;
    return;
  }

  const node = getDetailNode();
  const isVisible = Boolean(node) && state.detailPanelMode !== "hidden";
  elements.detailSheet.classList.toggle("is-open", isVisible);
  elements.detailSheet.classList.toggle("is-expanded", state.detailPanelMode === "expanded");
  elements.detailSheet.classList.toggle("is-compact", state.detailPanelMode === "compact");

  if (!isVisible || !node) {
    elements.nodeDetail.innerHTML = "";
    return;
  }

  const primaryFact = node.facts?.[0];
  if (state.detailPanelMode === "compact") {
    elements.nodeDetail.innerHTML = `
      <div class="detail-sheet-head">
        <div class="detail-sheet-copy">
          <span class="detail-sheet-type">${escapeHtml(formatNodeType(node.type))}</span>
          <strong class="detail-sheet-title">${escapeHtml(node.title)}</strong>
        </div>
        <button
          type="button"
          class="detail-sheet-icon-button"
          data-detail-action="expand"
          aria-label="Show facts for ${escapeHtml(node.title)}"
        >Facts</button>
      </div>
    `;
    return;
  }

  elements.nodeDetail.innerHTML = `
    <div class="detail-sheet-head">
      <div class="detail-sheet-copy">
        <span class="detail-sheet-type">${escapeHtml(formatNodeType(node.type))}</span>
        <strong class="detail-sheet-title">${escapeHtml(node.title)}</strong>
      </div>
      <button
        type="button"
        class="detail-sheet-icon-button detail-sheet-icon-button--ghost"
        data-detail-action="collapse"
        aria-label="Collapse detail"
      >Less</button>
    </div>
    ${primaryFact ? renderDetailFact(primaryFact, { hasUnconfirmedFacts: hasUnconfirmedNodeFacts(node) }) : `<p class="detail-sheet-empty">No curated facts yet.</p>`}
  `;
}

function renderDetailFact(fact, { hasUnconfirmedFacts }) {
  const source = fact.sourceUrl
    ? `<a href="${escapeHtml(fact.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>`
    : "";
  return `
    <p class="detail-sheet-fact">${escapeHtml(fact.text)}</p>
    <div class="detail-sheet-meta">
      <span>${escapeHtml(factConfidenceLabel(fact.confidence))}</span>
      ${source ? `<span aria-hidden="true">·</span>${source}` : ""}
    </div>
    ${hasUnconfirmedFacts ? `<p class="detail-sheet-note">Some facts here are still unconfirmed.</p>` : ""}
  `;
}

function hasUnconfirmedNodeFacts(node) {
  return node.facts?.some(
    (fact) => fact.confidence === "unconfirmed" || fact.sourceType === "ai_generated"
  );
}

function renderDetour(detour) {
  state.selectedNodeId = null;
  state.detailOverride = detour;
  state.detailPanelMode = "expanded";
  endNavigationFeedback();
  renderNodeDetail();
}

function explainClickError(error) {
  const message = String(error?.message ?? error);
  if (message === "Failed to fetch" || error?.name === "TypeError") {
    return "The browser could not reach the RoamAtlas dev server. Open the app through npm run dev, not as a file, and make sure the server is still running.";
  }
  return message;
}

async function readResponseError(response, fallback) {
  const body = await response.text().catch(() => "");
  let serverMessage = "";
  try {
    serverMessage = JSON.parse(body)?.error ?? "";
  } catch {
    serverMessage = body;
  }

  return serverMessage ? `${fallback}: ${serverMessage}` : `${fallback}: ${response.status}`;
}

function renderGenerationRequired(page) {
  state.selectedNodeId = null;
  elements.detailSheet.classList.remove("is-open");
  elements.nodeDetail.innerHTML = "";
  renderScrollStatus(`Preparing ${page.plan?.title ?? "next page"}…`);
}

function renderImageGenerationPending(page, result) {
  const artworkJobKey = getArtworkJobKeyForPage(page);
  const attemptId = ++artworkAttemptSequence;
  const jobUrl = page.generated?.jobUrl;
  const pendingPage = {
    ...page,
    imageUrl: null,
    environmentUrl: null,
    status: page.imageUrl ? "decoding_image" : page.status
  };

  state.artworkJobs.set(artworkJobKey, {
    status: pendingPage.status ?? "pending_codex_image_generation",
    serverStatus: page.status,
    jobKind: "interactive",
    countrySlug: state.activeCountrySlug,
    page,
    result,
    jobUrl,
    attemptId,
    startedAt: Date.now(),
    attempts: 0
  });

  enterReadyPage(pendingPage);

  if (page.imageUrl) {
    const scene = state.activePack.scenes[page.sceneId];
    if (scene && page.nodeId === scene.rootNodeId) {
      completeSceneArtwork(page.sceneId, page, page, attemptId);
    } else {
      completeCurrentPageArtwork(artworkJobKey, pendingPage, page, attemptId);
    }
    return;
  }

  if (!jobUrl) {
    state.artworkJobs.delete(artworkJobKey);
    requestArtworkForCurrentPage();
    return;
  }

  const scene = state.activePack.scenes[page.sceneId];
  if (scene && page.nodeId === scene.rootNodeId) {
    startArtworkPoller(
      artworkJobKey,
      (currentAttemptId) => pollArtworkJob(page.sceneId, jobUrl, page, currentAttemptId),
      attemptId
    );
  } else {
    startArtworkPoller(
      artworkJobKey,
      (currentAttemptId) => pollCurrentPageArtworkJob(
        artworkJobKey,
        jobUrl,
        pendingPage,
        page,
        currentAttemptId
      ),
      attemptId
    );
  }
}

function getArtworkJobKeyForPage(page) {
  const scene = state.activePack?.scenes?.[page?.sceneId];
  return scene && page?.nodeId === scene.rootNodeId ? scene.id : getPageArtworkJobKey(page);
}

function requestArtworkForCurrentPage() {
  const scene = state.activePack.scenes[state.currentPage.sceneId];
  if (scene && state.currentPage.nodeId === scene.rootNodeId) {
    requestSceneArtwork(scene.id, { jobKind: "interactive" });
  } else {
    requestCurrentPageArtwork({ jobKind: "interactive" });
  }
}

function retryArtwork(artworkJobKey) {
  if (getArtworkJobKeyForPage(state.currentPage) !== artworkJobKey) return;
  stopArtworkPoller(artworkJobKey);
  state.artworkJobs.delete(artworkJobKey);
  state.currentPage = {
    ...state.currentPage,
    imageUrl: null,
    environmentUrl: null,
    status: "pending_codex_image_generation"
  };
  requestArtworkForCurrentPage();
}

async function loadExperienceConfig() {
  try {
    const response = await fetch(apiPath("/api/experience-config"), { cache: "no-store" });
    if (!response.ok) return;
    state.experienceConfig = await response.json();
    if (state.currentView === "explorer") {
      prefetchNextDestinations();
      render();
    }
  } catch {
    // Keep bundled defaults when the config endpoint is unavailable.
  }
}

function prefetchNextDestinations() {
  if (!state.experienceConfig.loadNextDestinationsEarly || state.currentView !== "explorer") {
    return;
  }

  const scene = state.activePack.scenes[state.currentSceneId];
  if (!scene) return;

  resetPrefetchForSceneChange(scene.id);

  const targets = listNextArtworkDestinations({
    scene,
    scenes: state.activePack.scenes,
    nodes: state.activePack.nodes,
    currentPage: state.currentPage,
    limit: getPrefetchDestinationLimit()
  });

  for (const target of targets) {
    prefetchArtworkTarget(target);
  }
}

function getPrefetchDestinationLimit() {
  const preferred = Number(state.experienceConfig.prefetchDestinationLimit);
  const fallback = Number(state.experienceConfig.maxParallelImageJobs);
  const limit = Number.isFinite(preferred) ? preferred : fallback;
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
}

function resetPrefetchForSceneChange(sceneId) {
  const sceneKey = [
    state.activeCountrySlug,
    sceneId,
    state.currentPage?.id,
    state.currentPage?.nodeId
  ].join(":");
  if (state.prefetchSceneId === sceneKey) return;
  invalidatePrefetchState();
  state.prefetchSceneId = sceneKey;
}

function invalidatePrefetchState() {
  prefetchEpoch += 1;
  state.prefetchSceneId = null;
  state.prefetchRequests.clear();
  state.prefetchJobs.clear();
  for (const key of [...prefetchPollers.keys()]) {
    stopPrefetchPoller(key);
  }
}

function isArtworkTargetReady(target) {
  const scene = state.activePack.scenes[target.sceneId];
  if (scene && target.nodeId === scene.rootNodeId) {
    return Boolean(state.artworkByScene.get(target.sceneId)?.imageUrl);
  }
  return Boolean(state.artworkByPage.get(target.key)?.imageUrl);
}

function getPrefetchReadinessLabel() {
  if (!state.experienceConfig.loadNextDestinationsEarly) return null;
  const scene = state.activePack.scenes[state.currentSceneId];
  if (!scene) return null;

  const targets = listNextArtworkDestinations({
    scene,
    scenes: state.activePack.scenes,
    nodes: state.activePack.nodes,
    currentPage: state.currentPage,
    limit: getPrefetchDestinationLimit()
  });
  if (!targets.length) return null;

  const readyCount = targets.filter(isArtworkTargetReady).length;
  if (!readyCount) return null;
  return `${readyCount} of ${targets.length} destinations ready`;
}

function prefetchArtworkTarget(target) {
  if (
    isArtworkTargetReady(target) ||
    state.prefetchRequests.has(target.key) ||
    state.prefetchJobs.has(target.key)
  ) {
    return;
  }

  const scene = state.activePack.scenes[target.sceneId];
  const requestEpoch = prefetchEpoch;
  const requestSceneId = state.currentSceneId;
  const isSceneRootTarget = scene && target.nodeId === scene.rootNodeId;
  const trackKey = isSceneRootTarget ? target.sceneId : target.key;
  if (state.artworkJobs.has(trackKey)) return;

  state.prefetchRequests.add(target.key);
  state.prefetchJobs.set(target.key, {
    status: "pending_codex_image_generation",
    jobKind: "prefetch",
    title: target.title,
    requestEpoch,
    startedAt: Date.now(),
    attempts: 0
  });
  schedulePrefetchRailRender();

  const params = new URLSearchParams({
    countrySlug: state.activeCountrySlug,
    sceneId: target.sceneId,
    prefetch: "priority"
  });
  if (!isSceneRootTarget && target.nodeId) {
    params.set("nodeId", target.nodeId);
  }

  fetchArtworkResource(apiPath(`/api/artwork?${params.toString()}`), { cache: "no-store" })
    .then(async (response) => {
      if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      if (!response.ok) throw new Error(`Prefetch artwork failed: ${response.status}`);
      const { page } = await response.json();
      if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      if (page.status === "ready" && page.imageUrl) {
        const stored = await storeArtworkCache(target, page, null, {
          requestEpoch,
          requestSceneId
        });
        if (!stored || !isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
        state.prefetchRequests.delete(target.key);
        state.prefetchJobs.set(target.key, {
          status: "ready",
          jobKind: "prefetch",
          title: target.title,
          requestEpoch,
          imageUrl: page.imageUrl
        });
        schedulePrefetchRailRender();
        return;
      }

      const jobUrl = page.generated?.jobUrl;
      if (!jobUrl) {
        state.prefetchRequests.delete(target.key);
        state.prefetchJobs.delete(target.key);
        schedulePrefetchRailRender();
        return;
      }
      state.prefetchJobs.set(target.key, {
        ...state.prefetchJobs.get(target.key),
        status: page.status ?? "pending_codex_image_generation",
        jobKind: "prefetch",
        title: page.plan?.title ?? target.title,
        requestEpoch,
        generated: page.generated
      });
      schedulePrefetchRailRender();
      pollPrefetchJob(target, jobUrl, page, requestEpoch, requestSceneId);
    })
    .catch(() => {
      if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      state.prefetchRequests.delete(target.key);
      state.prefetchJobs.set(target.key, {
        status: "failed",
        jobKind: "prefetch",
        title: target.title,
        requestEpoch,
        error: "Could not start background illustration."
      });
      schedulePrefetchRailRender();
    });
}

async function storeArtworkCache(
  target,
  page,
  job = null,
  { requestEpoch = null, requestSceneId = null } = {}
) {
  const imageUrl = job?.imageUrl ?? page.imageUrl;
  await preloadArtworkImage(imageUrl);
  if (
    requestEpoch != null &&
    !isCurrentPrefetchRequest(requestEpoch, requestSceneId)
  ) return false;
  const environmentUrl = job?.environmentStatus === "deferred"
    ? null
    : job?.environmentUrl ?? getPageEnvironmentUrl(page);
  const payload = {
    imageUrl,
    environmentUrl,
    page: {
      ...page,
      imageUrl,
      environmentUrl,
      status: "ready",
      artworkDecoded: true
    },
    decoded: true
  };
  const scene = state.activePack.scenes[target.sceneId];
  if (scene && target.nodeId === scene.rootNodeId) {
    state.artworkByScene.set(target.sceneId, payload);
  } else {
    state.artworkByPage.set(target.key, payload);
  }
  return true;
}

function pollPrefetchJob(target, jobUrl, page, requestEpoch, requestSceneId) {
  stopPrefetchPoller(target.key);

  const tick = async () => {
    if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) {
      stopPrefetchPoller(target.key, requestEpoch);
      return;
    }
    const existing = state.prefetchJobs.get(target.key);
    const elapsed = Date.now() - (existing?.startedAt ?? Date.now());
    if (
      !existing ||
      elapsed >= ARTWORK_POLL_TIMEOUT_MS ||
      (existing.attempts ?? 0) >= ARTWORK_POLL_MAX_ATTEMPTS
    ) {
      stopPrefetchPoller(target.key, requestEpoch);
      state.prefetchRequests.delete(target.key);
      if (existing) {
        state.prefetchJobs.set(target.key, {
          ...existing,
          status: "timed_out",
          error: "Background illustration timed out."
        });
      }
      schedulePrefetchRailRender();
      return;
    }
    try {
      const response = await fetchArtworkResource(toApiUrl(jobUrl), { cache: "no-store" });
      if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      state.prefetchJobs.set(target.key, {
        ...state.prefetchJobs.get(target.key),
        attempts: (state.prefetchJobs.get(target.key)?.attempts ?? 0) + 1
      });
      if (!response.ok) return;
      const job = await response.json();
      if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      const previous = state.prefetchJobs.get(target.key) ?? {};
      const didChange = ["status", "partialImageUrl", "imageUrl", "error"]
        .some((field) => previous[field] !== job[field]);
      state.prefetchJobs.set(target.key, {
        ...previous,
        ...job,
        jobKind: job.jobKind ?? "prefetch",
        title: job.title ?? page.plan?.title ?? target.title
      });
      if (isArtworkJobFailed(job)) {
        stopPrefetchPoller(target.key, requestEpoch);
        state.prefetchRequests.delete(target.key);
        schedulePrefetchRailRender();
        return;
      }
      if (job.status === "ready" && !job.imageUrl) {
        stopPrefetchPoller(target.key, requestEpoch);
        state.prefetchRequests.delete(target.key);
        state.prefetchJobs.set(target.key, {
          ...state.prefetchJobs.get(target.key),
          status: "failed",
          error: "Background illustration completed without an image."
        });
        schedulePrefetchRailRender();
        return;
      }
      if (job.status !== "ready" || !job.imageUrl) {
        if (didChange) schedulePrefetchRailRender();
        return;
      }
      stopPrefetchPoller(target.key, requestEpoch);
      state.prefetchRequests.delete(target.key);
      try {
        const stored = await storeArtworkCache(target, page, job, {
          requestEpoch,
          requestSceneId
        });
        if (!stored || !isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      } catch (error) {
        state.prefetchJobs.set(target.key, {
          ...state.prefetchJobs.get(target.key),
          status: "failed",
          error: explainClickError(error)
        });
        schedulePrefetchRailRender();
        return;
      }
      state.prefetchJobs.set(target.key, {
        ...state.prefetchJobs.get(target.key),
        status: "ready",
        imageUrl: job.imageUrl
      });
      schedulePrefetchRailRender();
    } catch (error) {
      if (!isCurrentPrefetchRequest(requestEpoch, requestSceneId)) return;
      const latest = state.prefetchJobs.get(target.key);
      if (!latest) return;
      state.prefetchJobs.set(target.key, {
        ...latest,
        lastPollError: explainClickError(error)
      });
    }
  };

  let pollInFlight = false;
  const guardedTick = async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      await tick();
    } finally {
      pollInFlight = false;
    }
  };

  guardedTick();
  prefetchPollers.set(target.key, {
    intervalId: window.setInterval(guardedTick, ARTWORK_POLL_INTERVAL_MS),
    requestEpoch
  });
}

function isCurrentPrefetchRequest(requestEpoch, requestSceneId) {
  return prefetchEpoch === requestEpoch &&
    state.currentView === "explorer" &&
    state.currentSceneId === requestSceneId;
}

function schedulePrefetchRailRender() {
  if (prefetchRenderFrame) return;
  prefetchRenderFrame = window.requestAnimationFrame(() => {
    prefetchRenderFrame = null;
    if (state.currentView === "explorer") {
      render();
    }
  });
}

function stopPrefetchPoller(key, expectedEpoch = null) {
  const poller = prefetchPollers.get(key);
  if (!poller || (expectedEpoch != null && poller.requestEpoch !== expectedEpoch)) return;
  if (poller.intervalId) {
    window.clearInterval(poller.intervalId);
  }
  prefetchPollers.delete(key);
}

function mergePrefetchedArtwork(page) {
  if (!page?.sceneId) return page;

  const scene = state.activePack.scenes[page.sceneId];
  if (scene && page.nodeId === scene.rootNodeId) {
    const cached = state.artworkByScene.get(scene.id);
    if (cached?.imageUrl) {
      return {
        ...page,
        imageUrl: cached.imageUrl,
        environmentUrl: cached.environmentUrl,
        artworkDecoded: true,
        status: "ready"
      };
    }
  }

  if (page.nodeId) {
    const cached = state.artworkByPage.get(`node:${page.nodeId}`);
    if (cached?.imageUrl) {
      return {
        ...page,
        imageUrl: cached.imageUrl,
        environmentUrl: cached.environmentUrl,
        artworkDecoded: true,
        status: "ready"
      };
    }
  }

  return page;
}

function renderLoadingPanel({ job = null, pageTitle, fallbackMessage }) {
  if (!state.experienceConfig.showLoadingSteps) {
    renderScrollStatus(fallbackMessage ?? pageTitle ?? "Loading…");
    return;
  }

  clearScrollStatus();
  const trail = buildLoadingStepTrail({
    job: job ?? { status: "pending_codex_image_generation" },
    pageTitle
  });
  const progressState = trail.current.phase === "ready"
    ? "loading-panel-progress--complete"
    : trail.current.phase === "failed"
    ? "loading-panel-progress--failed"
    : "loading-panel-progress--indeterminate";

  let panel = elements.viewport.querySelector(".loading-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "loading-panel";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    elements.viewport.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="loading-panel-head">
      <span class="scroll-status-dot" aria-hidden="true"></span>
      <strong>${escapeHtml(trail.current.message)}</strong>
    </div>
    <p class="loading-panel-detail">${escapeHtml(trail.current.detail)}</p>
    <div class="loading-panel-progress ${progressState}" aria-hidden="true">
      <span></span>
    </div>
    <ol class="loading-panel-steps">
      ${trail.steps
        .map(
          (step) =>
            `<li class="loading-panel-step loading-panel-step--${step.state}">${escapeHtml(step.label)}</li>`
        )
        .join("")}
    </ol>
  `;
}

function clearLoadingPanel() {
  elements.viewport.querySelector(".loading-panel")?.remove();
  clearScrollStatus();
}

function renderScrollStatus(message) {
  let status = elements.viewport.querySelector(".scroll-status");
  if (status) {
    const label = status.querySelector(".scroll-status-label");
    if (label) {
      label.textContent = message;
      return;
    }
  }

  status = document.createElement("div");
  status.className = "scroll-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.innerHTML = `
    <span class="scroll-status-dot" aria-hidden="true"></span>
    <span class="scroll-status-label">${escapeHtml(message)}</span>
  `;
  elements.viewport.appendChild(status);
}

function clearScrollStatus() {
  elements.viewport.querySelector(".scroll-status")?.remove();
}

function toApiUrl(path) {
  if (String(path).startsWith("http")) return path;
  return apiPath(String(path).replace(/^\.\//, "/"));
}

function fetchArtworkResource(resource, options = {}) {
  const timeoutSignal = typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(ARTWORK_REQUEST_TIMEOUT_MS)
    : createTimeoutAbortSignal(ARTWORK_REQUEST_TIMEOUT_MS);
  const signal = options.signal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([options.signal, timeoutSignal])
    : options.signal ?? timeoutSignal;
  return fetch(resource, { ...options, signal });
}

function createTimeoutAbortSignal(timeoutMs) {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(new Error("Artwork request timed out.")), timeoutMs);
  return controller.signal;
}

function apiPath(path) {
  if (!window.location.origin.startsWith("http")) {
    throw new Error("RoamAtlas must be opened through the dev server, not as a local file.");
  }
  return path;
}

function clearPendingJob() {
  if (state.pendingJob?.intervalId) {
    window.clearInterval(state.pendingJob.intervalId);
  }
  state.pendingJob = null;
  endNavigationFeedback();
}

function enterReadyPage(page) {
  clearPendingJob();
  state.history.push({
    page: state.currentPage,
    nodeId: state.selectedNodeId
  });
  state.currentPage = page;
  state.currentSceneId = page.sceneId;
  state.selectedNodeId = page.nodeId;
  state.detailOverride = null;
  const detailNode =
    page.nodeId && page.nodeId !== state.activePack.rootNodeId
      ? state.activePack.nodes[page.nodeId]
      : null;
  state.detailPanelMode = detailNode ? "compact" : "hidden";
  if (page.nodeId) {
    setBrowserPath(canonicalRouteForNode(state.activeCountrySlug, page.nodeId, state.activePack));
  }
  render();
}

function createRootPage(pack) {
  return {
    id: "root",
    countrySlug: pack.countrySlug,
    sceneId: pack.overviewSceneId,
    nodeId: pack.rootNodeId,
    imageUrl: null,
    parentId: null,
    parentClick: null,
    status: "ready"
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function normalizeCountryQuery(value) {
  return String(value).trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setBrowserPath(path, { replace = false } = {}) {
  if (window.location.pathname === path) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", path);
}
