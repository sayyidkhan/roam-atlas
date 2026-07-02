import { worldCountries } from "../data/countries.js";
import {
  DEFAULT_COUNTRY_SLUG,
  countryPacks,
  getCountryPack,
  hasCountryPack
} from "../data/countryPacks/index.js";
import { generatedTiles } from "../data/generatedTiles.js";
import { factConfidenceLabel } from "../domain/guardrails.js";
import {
  canonicalRouteForNode,
  findSceneIdForNode,
  resolveAppRoute,
  routeForCountryConfig,
  routeForCountryLanding,
} from "../domain/routes.js";

const defaultCountryPack = getCountryPack(DEFAULT_COUNTRY_SLUG);

const state = {
  currentView: "countries",
  selectedCountry: null,
  activeCountrySlug: DEFAULT_COUNTRY_SLUG,
  activePack: defaultCountryPack,
  countryQuery: "",
  countryDrafts: new Map(),
  checkedStoredDrafts: new Set(),
  currentPage: createRootPage(defaultCountryPack),
  currentSceneId: defaultCountryPack.overviewSceneId,
  selectedNodeId: null,
  history: [],
  pendingJob: null,
  artworkJobs: new Map(),
  artworkByScene: new Map(),
  isResolvingClick: false,
  routeNotice: null
};

const elements = {
  landing: document.querySelector("#country-landing"),
  countryShell: document.querySelector("#country-shell"),
  countryGrid: document.querySelector("#country-grid"),
  countrySearch: document.querySelector("#country-search"),
  countryCount: document.querySelector("#country-count"),
  countryNotice: document.querySelector("#country-notice"),
  startSingaporeButton: document.querySelector("#start-singapore"),
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

applyRouteFromLocation({ shouldRender: false });
render();
bindCountryLanding();
bindCountryShell();
bindPageClick();

window.addEventListener("popstate", () => {
  applyRouteFromLocation();
});

elements.startSingaporeButton.addEventListener("click", () => {
  enterMappedCountry(getCountryPack(DEFAULT_COUNTRY_SLUG));
});

elements.countryButton.addEventListener("click", () => {
  enterCountryLanding();
});

elements.backButton.addEventListener("click", () => {
  clearPendingJob();
  state.isResolvingClick = false;
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
  state.selectedNodeId = null;
  renderNodeDetail();
});

function render() {
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

  renderScene();
  renderNodeDetail();
  if (state.routeNotice) {
    renderDetour(state.routeNotice);
  }
  elements.backButton.disabled = state.history.length === 0;
  elements.viewport.classList.toggle("is-busy", state.isResolvingClick || Boolean(state.pendingJob));
}

function bindCountryLanding() {
  elements.countrySearch.addEventListener("input", (event) => {
    state.countryQuery = event.target.value;
    renderCountryLanding();
  });

  elements.countryGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-country-code]");
    if (!card) return;
    const country = worldCountries.find((item) => item.code === card.dataset.countryCode);
    if (!country) return;
    if (hasCountryPack(country.slug)) {
      enterMappedCountry(getCountryPack(country.slug));
      return;
    }
    enterCountryShell(country);
  });
}

function bindCountryShell() {
  elements.countryShell.addEventListener("click", (event) => {
    const action = event.target.closest("[data-country-action]")?.dataset.countryAction;
    if (action === "countries") {
      enterCountryLanding();
      return;
    }
    if (action === "singapore") {
      enterMappedCountry(getCountryPack(DEFAULT_COUNTRY_SLUG));
      return;
    }
    if (action === "build-starter-map" && state.selectedCountry) {
      const draftState = state.countryDrafts.get(state.selectedCountry.slug);
      requestCountryDraft(state.selectedCountry, { force: Boolean(draftState?.draft) });
      return;
    }
    if (action === "confirm-starter-map" && state.selectedCountry) {
      requestCountryDraftConfirmation(state.selectedCountry);
    }
  });

  elements.countryShell.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-country-chat-form]");
    if (!form || !state.selectedCountry) return;
    event.preventDefault();
    const input = form.querySelector("[name='instruction']");
    requestCountryDraftInfluence(state.selectedCountry, input?.value);
  });
}

function renderCountryLanding() {
  elements.countryNotice.classList.remove("is-open");
  elements.countryNotice.replaceChildren();
  const query = normalizeCountryQuery(state.countryQuery);
  const filteredCountries = worldCountries.filter((country) => {
    if (!query) return true;
    return (
      normalizeCountryQuery(country.name).includes(query) ||
      country.code.toLowerCase().includes(query)
    );
  });

  elements.countryCount.textContent = `${filteredCountries.length} of ${worldCountries.length} countries`;
  elements.countryGrid.replaceChildren(...filteredCountries.map(renderCountryCard));
}

function renderCountryCard(country) {
  const isMapped = hasCountryPack(country.slug);
  const card = document.createElement("button");
  card.type = "button";
  card.className = `country-card country-card--${country.status}`;
  card.dataset.countryCode = country.code;
  card.setAttribute("aria-label", `${country.name}, ${isMapped ? "mapped explorer" : "country page available"}`);

  const code = document.createElement("span");
  code.className = "country-code";
  code.textContent = country.code;

  const title = document.createElement("span");
  title.className = "country-name";
  title.textContent = country.name;

  const status = document.createElement("span");
  status.className = "country-status";
  status.textContent = isMapped ? "Mapped" : "Open";

  card.append(code, title, status);
  return card;
}

function renderCountryShell() {
  const country = state.selectedCountry;
  if (!country) return;
  const draftState = state.countryDrafts.get(country.slug);
  const isDraftLoading = draftState?.status === "loading" || draftState?.isSending;
  const hasStarterMap = Boolean(draftState?.draft);

  elements.countryShell.innerHTML = `
    <article class="country-shell-panel">
      <p class="eyebrow">${country.code} country config</p>
      <h1>${country.name}</h1>
      <p>Configure an unconfirmed starter map for ${country.name} before it becomes a live country explorer.</p>
      <div class="coverage-row" aria-label="Country coverage status">
        <div class="coverage-item">
          <strong>Route</strong>
          <span>${routeForCountryConfig(country)}</span>
        </div>
        <div class="coverage-item">
          <strong>Explorer graph</strong>
          <span>No mapped country pack</span>
        </div>
        <div class="coverage-item">
          <strong>Fact boundary</strong>
          <span>Starter only, not verified</span>
        </div>
      </div>
      <div class="country-shell-actions">
        <button type="button" data-country-action="countries">All countries</button>
        <button type="button" data-country-action="build-starter-map" ${isDraftLoading ? "disabled" : ""}>
          ${isDraftLoading ? "Building starter map" : hasStarterMap ? "Rebuild starter map" : "Build starter map"}
        </button>
        <button type="button" class="ghost-button" data-country-action="singapore">Open Singapore demo</button>
      </div>
      ${renderCountryDraftPanel(country, draftState)}
    </article>
  `;
}

function renderCountryDraftPanel(country, draftState) {
  if (!draftState) {
    return `
      <section class="country-draft country-draft--empty" aria-label="AI starter map">
        <p class="eyebrow">Starter map</p>
        <h2>No starter map yet</h2>
        <p>Build an unconfirmed outline for ${escapeHtml(country.name)}. It will not be treated as a verified country pack.</p>
      </section>
    `;
  }

  if (draftState.status === "loading") {
    return `
      <section class="country-draft" aria-label="AI starter map">
        <p class="eyebrow">Building</p>
        <h2>Preparing ${escapeHtml(country.name)}</h2>
        <p>Creating unconfirmed research leads. This does not add facts to the curated graph.</p>
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
  const regions = draft.regions.length
    ? draft.regions.map(renderDraftRegion).join("")
    : `<p class="muted">No candidate regions were returned.</p>`;
  const themes = draft.themes.length
    ? draft.themes.map(renderDraftTheme).join("")
    : `<p class="muted">No candidate themes were returned.</p>`;

  return `
    <section class="country-draft" aria-label="AI starter map">
      <div class="country-draft-header">
        <div>
          <p class="eyebrow">AI starter map</p>
          <h2>${escapeHtml(draft.countryName)}</h2>
        </div>
        <div class="badge-row">
          <span class="badge">${escapeHtml(draft.confidence)}</span>
          <span class="badge">${escapeHtml(draft.sourceType)}</span>
          <span class="badge">${escapeHtml(draft.generationStatus)}</span>
        </div>
      </div>
      <p>${escapeHtml(draft.summary)}</p>
      ${draft.unavailableReason ? `<p class="muted">${escapeHtml(draft.unavailableReason)}</p>` : ""}
      ${renderDraftConfirmation(draftState)}
      <div class="draft-grid">
        <section>
          <h3>Candidate regions</h3>
          <div class="draft-list">${regions}</div>
        </section>
        <section>
          <h3>Research themes</h3>
          <div class="draft-list">${themes}</div>
        </section>
      </div>
      <section class="draft-review">
        <h3>Before promotion</h3>
        <ul>
          ${draft.reviewChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
      ${renderDraftChat(draftState)}
    </section>
  `;
}

function renderDraftConfirmation(draftState) {
  const draft = draftState.draft;
  if (draft.mode === "curated_pack_snapshot") {
    return `
      <section class="draft-confirmation">
        <h3>Curated country pack</h3>
        <p>This starter map is already derived from source-controlled curated data.</p>
      </section>
    `;
  }

  if (draftState.confirmation) {
    return `
      <section class="draft-confirmation draft-confirmation--ready">
        <div>
          <h3>Confirmed for curation</h3>
          <p>Country-pack draft generated. Facts still require source review before this becomes a live explorer.</p>
        </div>
        <div class="draft-links">
          <a href="${escapeHtml(draftState.confirmation.paths.confirmationUrl)}" target="_blank" rel="noreferrer">confirmation</a>
          <a href="${escapeHtml(draftState.confirmation.paths.countryPackDraftUrl)}" target="_blank" rel="noreferrer">country pack draft</a>
        </div>
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

function renderDraftRegion(region) {
  return `
    <article class="draft-item">
      <div>
        <strong>${escapeHtml(region.name)}</strong>
        <span>${escapeHtml(region.kind)} · ${escapeHtml(region.confidence)}</span>
      </div>
      <p>${escapeHtml(region.why)}</p>
    </article>
  `;
}

function renderDraftTheme(theme) {
  return `
    <article class="draft-item">
      <div>
        <strong>${escapeHtml(theme.label)}</strong>
        <span>${escapeHtml(theme.confidence)}</span>
      </div>
      <p>${escapeHtml(theme.note)}</p>
    </article>
  `;
}

function renderDraftChat(draftState) {
  const messages = draftState.messages ?? [];
  const isSending = Boolean(draftState.isSending);
  const log = messages.length
    ? messages.map(renderDraftChatMessage).join("")
    : `<p class="muted">Ask for a different angle, such as states first, weekend trips, nature, food, family travel, or cross-border ideas.</p>`;

  return `
    <section class="draft-chat" aria-label="Starter map chat">
      <h3>Steer starter map</h3>
      <div class="draft-chat-log" aria-live="polite">${log}</div>
      <form class="draft-chat-form" data-country-chat-form>
        <textarea
          name="instruction"
          rows="2"
          maxlength="420"
          placeholder="Example: focus on states first, then cities near Singapore"
          ${isSending ? "disabled" : ""}
        ></textarea>
        <button type="submit" ${isSending ? "disabled" : ""}>${isSending ? "Applying" : "Apply"}</button>
      </form>
      <p class="muted">This only changes the unconfirmed starter map. Sources are still required before promotion.</p>
    </section>
  `;
}

function renderDraftChatMessage(message) {
  return `
    <article class="draft-chat-message draft-chat-message--${escapeHtml(message.role)}">
      <strong>${message.role === "user" ? "You" : "WanderSG"}</strong>
      <p>${escapeHtml(message.text)}</p>
    </article>
  `;
}

async function requestCountryDraft(country, { force = false } = {}) {
  const existing = state.countryDrafts.get(country.slug);
  if (existing?.status === "loading" || existing?.isSending) return;
  const nextMessages = force ? [] : existing?.messages ?? [];
  const nextConfirmation = force ? null : existing?.confirmation ?? null;

  state.countryDrafts.set(country.slug, {
    ...existing,
    status: "loading",
    messages: nextMessages,
    confirmation: nextConfirmation
  });
  render();
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
  } catch (error) {
    state.countryDrafts.set(country.slug, {
      status: "failed",
      error: explainClickError(error)
    });
  }
  render();
}

async function loadStoredCountryDraft(country) {
  if (state.checkedStoredDrafts.has(country.slug) || state.countryDrafts.has(country.slug)) {
    return;
  }

  state.checkedStoredDrafts.add(country.slug);
  try {
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

async function requestCountryDraftInfluence(country, rawInstruction) {
  const instruction = String(rawInstruction ?? "").trim();
  if (!instruction) return;

  const existing = state.countryDrafts.get(country.slug);
  if (existing?.status === "loading" || existing?.isSending) return;

  const userMessage = { role: "user", text: instruction };
  const messages = [...(existing?.messages ?? []), userMessage].slice(-8);
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
        currentDraft: existing?.draft ?? null
      })
    });
    if (!response.ok) throw new Error(`Starter map update failed: ${response.status}`);
    const { draft, message } = await response.json();
    state.countryDrafts.set(country.slug, {
      status: "ready",
      draft,
      isSending: false,
      confirmation: null,
      messages: [
        ...messages,
        message ?? { role: "assistant", text: "Starter map updated. All candidates remain unconfirmed." }
      ].slice(-8)
    });
  } catch (error) {
    state.countryDrafts.set(country.slug, {
      ...existing,
      status: existing?.draft ? "ready" : "failed",
      isSending: false,
      confirmation: existing?.confirmation ?? null,
      messages: [
        ...messages,
        { role: "assistant", text: explainClickError(error) }
      ].slice(-8),
      error: explainClickError(error)
    });
  }
  render();
}

async function requestCountryDraftConfirmation(country) {
  const existing = state.countryDrafts.get(country.slug);
  if (!existing?.draft || existing.isConfirming || existing.isSending || existing.status === "loading") return;

  state.countryDrafts.set(country.slug, {
    ...existing,
    isConfirming: true
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
    if (!response.ok) throw new Error(`Starter map confirmation failed: ${response.status}`);
    const confirmation = await response.json();
    state.countryDrafts.set(country.slug, {
      ...existing,
      status: "ready",
      isConfirming: false,
      confirmation
    });
  } catch (error) {
    state.countryDrafts.set(country.slug, {
      ...existing,
      status: "ready",
      isConfirming: false,
      messages: [
        ...(existing.messages ?? []),
        { role: "assistant", text: explainClickError(error) }
      ].slice(-8)
    });
  }
  render();
}

function enterMappedCountry(pack, { updateUrl = true, shouldRender = true } = {}) {
  if (!pack) return;
  clearPendingJob();
  state.currentView = "explorer";
  state.activeCountrySlug = pack.countrySlug;
  state.activePack = pack;
  state.selectedCountry = null;
  state.currentPage = createRootPage(pack);
  state.currentSceneId = pack.overviewSceneId;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.isResolvingClick = false;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(`/${pack.countrySlug}`);
  if (shouldRender) render();
}

function enterCountryShell(country, { updateUrl = true, shouldRender = true, replaceUrl = false } = {}) {
  clearPendingJob();
  state.currentView = "country";
  state.selectedCountry = country;
  state.selectedNodeId = null;
  state.history = [];
  state.pendingJob = null;
  state.isResolvingClick = false;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(routeForCountryConfig(country), { replace: replaceUrl });
  if (shouldRender) render();
  loadStoredCountryDraft(country);
}

function enterCuratedPlace({ countrySlug, nodeId, pack }, { updateUrl = true, shouldRender = true } = {}) {
  const node = pack?.nodes[nodeId];
  if (!node) {
    if (pack) enterMappedCountry(pack, { updateUrl: false, shouldRender: false });
    state.routeNotice = {
      confidence: "unconfirmed",
      title: "Unknown WanderSG node",
      message: `${nodeId} is not mapped in WanderSG's verified ${pack?.title ?? countrySlug} graph.`
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
  state.isResolvingClick = false;
  state.routeNotice = null;
  if (updateUrl) setBrowserPath(canonicalRouteForNode(countrySlug, nodeId, pack));
  if (shouldRender) render();
}

function applyRouteFromLocation({ shouldRender = true } = {}) {
  const route = resolveAppRoute(window.location.pathname, {
    countries: worldCountries,
    countryPacks
  });
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
      title: "Unknown WanderSG node",
      message: `${route.nodeId} is not mapped in WanderSG's verified ${route.pack.title} graph.`
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

function enterCountryLanding({ updateUrl = true, shouldRender = true } = {}) {
  clearPendingJob();
  state.isResolvingClick = false;
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
  const pageTitle = state.currentPage.plan?.title ?? pageNode?.title ?? scene.title;
  elements.sceneTitle.textContent = pageTitle;
  elements.breadcrumb.textContent = pageNode
    ? `${pageNode.title} · ${state.currentPage.status}`
    : rootNode
    ? `${rootNode.title} · ${state.currentPage.status}`
    : "Curated scene";
  const imageUrl =
    state.currentPage.sceneId === scene.id
      ? state.currentPage.imageUrl ?? sceneArtwork?.imageUrl
      : sceneArtwork?.imageUrl;
  const isArtworkPending = !imageUrl && state.artworkJobs.has(scene.id);
  elements.stage.classList.toggle("has-local-art", Boolean(imageUrl));
  elements.stage.classList.toggle("is-artwork-pending", isArtworkPending);
  elements.stage.replaceChildren(
    ...(imageUrl ? [renderSceneImage(imageUrl, scene.title)] : []),
    ...(isArtworkPending ? [renderArtworkPending(scene)] : []),
    ...scene.tiles.map(renderTile),
    ...renderMapHotspotLabels(scene, nodes, { isVisible: !imageUrl })
  );
  elements.stage.dataset.scene = scene.id;
  if (!imageUrl && !isArtworkPending) {
    requestSceneArtwork(scene.id);
  }
}

function renderMapHotspotLabels(scene, nodes, { isVisible }) {
  if (!isVisible) return [];

  return (scene.hotspots ?? [])
    .filter((hotspot) => hotspot.nodeId && nodes[hotspot.nodeId] && "width" in hotspot.shape)
    .map((hotspot) => {
      const node = nodes[hotspot.nodeId];
      const el = document.createElement("div");
      el.className = "map-hotspot-label";
      el.style.left = `${(hotspot.shape.x / scene.coordinateSpace.width) * 100}%`;
      el.style.top = `${(hotspot.shape.y / scene.coordinateSpace.height) * 100}%`;
      el.style.width = `${(hotspot.shape.width / scene.coordinateSpace.width) * 100}%`;
      el.style.height = `${(hotspot.shape.height / scene.coordinateSpace.height) * 100}%`;
      el.innerHTML = `
        <strong>${escapeHtml(node.title)}</strong>
        <span>${escapeHtml(hotspot.confidence)}</span>
      `;
      return el;
    });
}

function renderArtworkPending(scene) {
  const el = document.createElement("div");
  el.className = "artwork-pending";
  el.innerHTML = `
    <p class="eyebrow">Generating</p>
    <h2>${scene.title}</h2>
  `;
  return el;
}

function renderSceneImage(imageUrl, title) {
  const image = document.createElement("img");
  image.className = "scene-image";
  image.src = imageUrl;
  image.alt = `${title} illustration`;
  image.decoding = "async";
  image.draggable = false;
  return image;
}

function bindPageClick() {
  elements.viewport.addEventListener("click", (event) => {
    if (event.target.closest("button, a, .detail-sheet, .scene-hud")) {
      return;
    }
    resolveClickAt(event);
  });
}

async function resolveClickAt(event) {
  if (state.isResolvingClick || state.pendingJob) {
    return;
  }

  const stageRect = elements.stage.getBoundingClientRect();
  const normalizedClick = {
    x: clamp01((event.clientX - stageRect.left) / stageRect.width),
    y: clamp01((event.clientY - stageRect.top) / stageRect.height)
  };
  const imageClick = computeImageClick(event, stageRect);
  state.isResolvingClick = true;
  elements.viewport.classList.add("is-busy");
  try {
    const result = await requestFlipbookPage({ normalizedClick, imageClick });
    runFlipbookResult(result);
  } catch (error) {
    state.isResolvingClick = false;
    elements.viewport.classList.remove("is-busy");
    renderDetour({
      confidence: "unconfirmed",
      title: "Click failed",
      message: explainClickError(error)
    });
  }
}

async function resolveOverlayTarget(target) {
  if (state.isResolvingClick || state.pendingJob) {
    return;
  }

  state.isResolvingClick = true;
  elements.viewport.classList.add("is-busy");
  try {
    const result = await requestFlipbookPage({
      normalizedClick: target.normalizedClick,
      targetNodeId: target.nodeId,
      detourPhrase: target.detourPhrase
    });
    runFlipbookResult(result);
  } catch (error) {
    state.isResolvingClick = false;
    elements.viewport.classList.remove("is-busy");
    renderDetour({
      confidence: "unconfirmed",
      title: "Click failed",
      message: explainClickError(error)
    });
  }
}

async function requestFlipbookPage({ normalizedClick, imageClick = null, targetNodeId = null, detourPhrase = null }) {
  const response = await fetch(apiPath("/api/flipbook/click"), {
    method: "POST",
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
  const imageUrl = state.currentPage.imageUrl ?? sceneArtwork?.imageUrl ?? null;
  return imageUrl === state.currentPage.imageUrl
    ? state.currentPage
    : {
        ...state.currentPage,
        imageUrl,
        status: imageUrl ? "ready" : state.currentPage.status
      };
}

async function requestSceneArtwork(sceneId) {
  if (state.artworkByScene.has(sceneId) || state.artworkJobs.has(sceneId)) {
    return;
  }

  state.artworkJobs.set(sceneId, { status: "requesting" });
  render();
  try {
    const response = await fetch(
      apiPath(`/api/artwork?countrySlug=${encodeURIComponent(state.activeCountrySlug)}&sceneId=${encodeURIComponent(sceneId)}`),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error(`Artwork request failed: ${response.status}`);
    const { page } = await response.json();
    if (page.status === "ready" && page.imageUrl) {
      state.artworkByScene.set(sceneId, { imageUrl: page.imageUrl, page });
      state.artworkJobs.delete(sceneId);
      if (state.currentSceneId === sceneId && !state.currentPage.imageUrl) {
        state.currentPage = { ...state.currentPage, imageUrl: page.imageUrl, status: "ready" };
      }
      render();
      return;
    }

    const jobUrl = page.generated?.jobUrl;
    state.artworkJobs.set(sceneId, {
      page,
      intervalId: jobUrl ? window.setInterval(() => pollArtworkJob(sceneId, jobUrl, page), 1600) : null
    });
    if (jobUrl) {
      pollArtworkJob(sceneId, jobUrl, page);
    }
  } catch (error) {
    state.artworkJobs.set(sceneId, { status: "failed", error: explainClickError(error) });
    render();
  }
}

async function pollArtworkJob(sceneId, jobUrl, page) {
  try {
    const response = await fetch(toApiUrl(jobUrl), { cache: "no-store" });
    if (!response.ok) return;
    const job = await response.json();
    if (job.status !== "ready" || !job.imageUrl) return;
    const artworkJob = state.artworkJobs.get(sceneId);
    if (artworkJob?.intervalId) {
      window.clearInterval(artworkJob.intervalId);
    }
    state.artworkJobs.delete(sceneId);
    state.artworkByScene.set(sceneId, {
      imageUrl: job.imageUrl,
      page: { ...page, imageUrl: job.imageUrl, status: "ready" }
    });
    if (state.currentSceneId === sceneId && !state.currentPage.imageUrl) {
      state.currentPage = { ...state.currentPage, imageUrl: job.imageUrl, status: "ready" };
    }
    render();
  } catch {
    // Keep polling; runtime artwork may still be generating.
  }
}

function computeImageClick(event, stageRect) {
  const image = elements.stage.querySelector(".scene-image");
  if (!image?.naturalWidth || !image?.naturalHeight) {
    return null;
  }

  const imageRect = image.getBoundingClientRect();
  const scale = Math.min(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const offsetX = imageRect.left + (imageRect.width - renderedWidth) / 2;
  const offsetY = imageRect.top + (imageRect.height - renderedHeight) / 2;
  const imageX = clamp(event.clientX - offsetX, 0, renderedWidth) / scale;
  const imageY = clamp(event.clientY - offsetY, 0, renderedHeight) / scale;

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
  state.isResolvingClick = false;
  if (result.click?.resolver === "vlm_guard") {
    elements.viewport.classList.remove("is-busy");
    renderDetour({
      confidence: "unresolved",
      title: "Click not resolved",
      message: "WanderSG could not identify that exact image region confidently enough, so it did not turn to the wrong page."
    });
    return;
  }
  const page = result.page;
  if (page.nodeId) {
    setBrowserPath(canonicalRouteForNode(state.activeCountrySlug, page.nodeId, state.activePack));
  }
  if (page.status === "generation_required" || page.status === "pending_codex_image_generation") {
    renderImageGenerationPending(page, result);
    return;
  }

  enterReadyPage(page);
}

function renderTile(tile) {
  const el = document.createElement("div");
  el.className = `tile tile--${tile.column % 4}`;
  el.style.left = `${tile.bounds.x}px`;
  el.style.top = `${tile.bounds.y}px`;
  el.style.width = `${tile.bounds.width}px`;
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

function renderNodeDetail() {
  const node = state.selectedNodeId ? state.activePack.nodes[state.selectedNodeId] : null;
  elements.detailSheet.classList.toggle("is-open", Boolean(node));

  if (!node) {
    elements.nodeDetail.innerHTML = "";
    return;
  }

  const hasUnconfirmedFacts = hasUnconfirmedNodeFacts(node);
  elements.nodeDetail.innerHTML = `
    <p class="eyebrow">${node.type.replace("_", " ")}</p>
    <h2>${node.title}</h2>
    <p class="muted">${
      hasUnconfirmedFacts
        ? "This node is part of the actual country map, but these facts are unconfirmed until source review."
        : "Facts are curated. The scroll is only the visual layer."
    }</p>
    <div class="fact-list">
      ${node.facts.slice(0, 2).map(renderFact).join("")}
    </div>
  `;
}

function hasUnconfirmedNodeFacts(node) {
  return node.facts?.some(
    (fact) => fact.confidence === "unconfirmed" || fact.sourceType === "ai_generated"
  );
}

function renderFact(fact) {
  const source = fact.sourceUrl
    ? `<a href="${fact.sourceUrl}" target="_blank" rel="noreferrer">source</a>`
    : fact.sourceType === "ai_generated"
    ? "no source"
    : "general";
  return `
    <article class="fact">
      <p>${fact.text}</p>
      <div class="badge-row">
        <span class="badge">${factConfidenceLabel(fact.confidence)}</span>
        <span class="badge">${fact.sourceType}</span>
        <span class="badge">${source}</span>
      </div>
    </article>
  `;
}

function renderDetour(detour) {
  state.selectedNodeId = null;
  elements.detailSheet.classList.add("is-open");
  elements.nodeDetail.innerHTML = `
    <p class="eyebrow">${detour.confidence}</p>
    <h2>${detour.title}</h2>
    <p class="muted">${detour.message}</p>
  `;
}

function explainClickError(error) {
  const message = String(error?.message ?? error);
  if (message === "Failed to fetch" || error?.name === "TypeError") {
    return "The browser could not reach the WanderSG dev server. Open the app through npm run dev, not as a file, and make sure the server is still running.";
  }
  return message;
}

function renderGenerationRequired(page) {
  elements.detailSheet.classList.add("is-open");
  elements.nodeDetail.innerHTML = `
    <p class="eyebrow">generation required</p>
    <h2>${page.plan?.title ?? "Next page"}</h2>
    <p class="muted">This click resolved to a next flipbook page, but no generated artwork is ready yet.</p>
    <article class="fact">
      <p>${page.plan?.imagePrompt ?? "No image prompt available."}</p>
    </article>
  `;
}

function renderImageGenerationPending(page, result) {
  clearPendingJob();
  const jobUrl = page.generated?.jobUrl;
  state.pendingJob = {
    page,
    result,
    intervalId: jobUrl ? window.setInterval(() => pollImageJob(jobUrl, page), 1600) : null
  };
  elements.detailSheet.classList.add("is-open");
  elements.viewport.classList.add("is-busy");
  elements.nodeDetail.innerHTML = `
    <p class="eyebrow">image generation</p>
    <h2>${page.plan?.title ?? "Next page"}</h2>
    <p class="muted">Generating the next flipbook page. WanderSG will turn the page automatically when the image is ready.</p>
    <article class="fact">
      <p>${page.generated?.jobUrl ?? "Job file pending."}</p>
    </article>
  `;
  if (jobUrl) {
    pollImageJob(jobUrl, page);
  }
}

async function pollImageJob(jobUrl, page) {
  try {
    const response = await fetch(toApiUrl(jobUrl), { cache: "no-store" });
    if (!response.ok) return;
    const job = await response.json();
    if (job.status !== "ready" || !job.imageUrl) return;
    clearPendingJob();
    enterReadyPage({
      ...page,
      imageUrl: job.imageUrl,
      status: "ready",
      generated: {
        source: job.source ?? "image-api",
        jobUrl,
        reused: true
      }
    });
  } catch {
    // Keep polling; the job may not exist yet during development.
  }
}

function toApiUrl(path) {
  if (String(path).startsWith("http")) return path;
  return apiPath(String(path).replace(/^\.\//, "/"));
}

function apiPath(path) {
  if (!window.location.origin.startsWith("http")) {
    throw new Error("WanderSG must be opened through the dev server, not as a local file.");
  }
  return path;
}

function clearPendingJob() {
  if (state.pendingJob?.intervalId) {
    window.clearInterval(state.pendingJob.intervalId);
  }
  state.pendingJob = null;
  elements.viewport.classList.remove("is-busy");
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
  return Math.min(max, Math.max(min, value));
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
