import { atlasNodes, scrollScenes } from "../data/sceneGraph.js";
import { generatedTiles } from "../data/generatedTiles.js";
import { factConfidenceLabel } from "../domain/guardrails.js";

const rootPage = {
  id: "root",
  sceneId: "singapore-overview",
  nodeId: "singapore",
  imageUrl: "./public/generated/scenes/singapore-overview/overview-codex-local.png",
  parentId: null,
  parentClick: null,
  status: "ready"
};

const state = {
  currentPage: { ...rootPage },
  currentSceneId: "singapore-overview",
  selectedNodeId: null,
  history: [],
  pendingJob: null,
  isResolvingClick: false
};

const elements = {
  viewport: document.querySelector("#scroll-viewport"),
  sceneTitle: document.querySelector("#scene-title"),
  breadcrumb: document.querySelector("#breadcrumb"),
  stage: document.querySelector("#scroll-stage"),
  detailSheet: document.querySelector("#detail-sheet"),
  nodeDetail: document.querySelector("#node-detail"),
  backButton: document.querySelector("#back-button"),
  closeDetail: document.querySelector("#close-detail")
};

render();
bindPageClick();

elements.backButton.addEventListener("click", () => {
  clearPendingJob();
  state.isResolvingClick = false;
  const previous = state.history.pop();
  if (!previous) return;
  state.currentPage = previous.page;
  state.currentSceneId = previous.page.sceneId;
  state.selectedNodeId = previous.nodeId;
  render();
});

elements.closeDetail.addEventListener("click", () => {
  state.selectedNodeId = null;
  renderNodeDetail();
});

function render() {
  renderScene();
  renderNodeDetail();
  elements.backButton.disabled = state.history.length === 0;
  elements.viewport.classList.toggle("is-busy", state.isResolvingClick || Boolean(state.pendingJob));
}

function renderScene() {
  const scene = scrollScenes[state.currentSceneId];
  const rootNode = atlasNodes[scene.rootNodeId];
  const pageNode = atlasNodes[state.currentPage.nodeId];
  const pageTitle = state.currentPage.plan?.title ?? pageNode?.title ?? scene.title;
  elements.sceneTitle.textContent = pageTitle;
  elements.breadcrumb.textContent = pageNode
    ? `${pageNode.title} · ${state.currentPage.status}`
    : rootNode
    ? `${rootNode.title} · ${state.currentPage.status}`
    : "Curated scene";
  const imageUrl = state.currentPage.sceneId === scene.id ? state.currentPage.imageUrl : null;
  const isArtworkPending = false;
  elements.stage.classList.toggle("has-local-art", Boolean(imageUrl));
  elements.stage.classList.toggle("is-artwork-pending", isArtworkPending);
  if (imageUrl) {
    elements.stage.style.setProperty("--scene-art-url", `url("${imageUrl}")`);
  } else {
    elements.stage.style.removeProperty("--scene-art-url");
  }
  elements.stage.replaceChildren(
    ...(imageUrl ? [renderSceneImage(imageUrl, scene.title)] : []),
    ...(isArtworkPending ? [renderArtworkPending(scene)] : []),
    ...scene.tiles.map(renderTile)
  );
  elements.stage.dataset.scene = scene.id;
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

  state.isResolvingClick = true;
  elements.viewport.classList.add("is-busy");
  const stageRect = elements.stage.getBoundingClientRect();
  const scene = scrollScenes[state.currentSceneId];
  const normalizedClick = {
    x: clamp01((event.clientX - stageRect.left) / stageRect.width),
    y: clamp01((event.clientY - stageRect.top) / stageRect.height)
  };
  const imageClick = computeImageClick(event, stageRect);
  try {
    const result = await requestFlipbookPage({ normalizedClick, imageClick });
    runFlipbookResult(result, scene, normalizedClick);
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
  const response = await fetch("/api/flipbook/click", {
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
    throw new Error(`Flipbook click failed: ${response.status}`);
  }

  return response.json();
}

function getCurrentRequestPage() {
  return state.currentPage;
}

function computeImageClick(event, stageRect) {
  const image = elements.stage.querySelector(".scene-image");
  if (!image?.naturalWidth || !image?.naturalHeight) {
    return null;
  }

  const scale = Math.max(stageRect.width / image.naturalWidth, stageRect.height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const offsetX = (stageRect.width - renderedWidth) / 2;
  const offsetY = (stageRect.height - renderedHeight) / 2;
  const imageX = clamp(event.clientX - stageRect.left - offsetX, 0, renderedWidth) / scale;
  const imageY = clamp(event.clientY - stageRect.top - offsetY, 0, renderedHeight) / scale;

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
    objectFit: "cover"
  };
}

function runFlipbookResult(result, scene, normalizedClick) {
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
  const node = state.selectedNodeId ? atlasNodes[state.selectedNodeId] : null;
  elements.detailSheet.classList.toggle("is-open", Boolean(node));

  if (!node) {
    elements.nodeDetail.innerHTML = "";
    return;
  }

  elements.nodeDetail.innerHTML = `
    <p class="eyebrow">${node.type.replace("_", " ")}</p>
    <h2>${node.title}</h2>
    <p class="muted">Facts are curated. The scroll is only the visual layer.</p>
    <div class="fact-list">
      ${node.facts.slice(0, 2).map(renderFact).join("")}
    </div>
  `;
}

function renderFact(fact) {
  const source = fact.sourceUrl
    ? `<a href="${fact.sourceUrl}" target="_blank" rel="noreferrer">source</a>`
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
    return "The browser could not reach the WanderSG dev server. Open the app at http://127.0.0.1:4173 and make sure npm run dev is still running.";
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
}

async function pollImageJob(jobUrl, page) {
  try {
    const response = await fetch(jobUrl.replace(/^\.\//, "/"));
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
  render();
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
