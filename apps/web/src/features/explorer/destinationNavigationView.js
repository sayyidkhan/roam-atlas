export function renderRegionRailCheck() {
  return `
    <span class="region-rail-check" aria-hidden="true">
      <svg viewBox="0 0 14 14" focusable="false">
        <path d="M3.1 7.1 5.8 9.8 11 4.2"></path>
      </svg>
    </span>
  `;
}

export function createDestinationNavigationView({
  buildLoadingStepTrail,
  clamp01,
  enterCountryShell,
  escapeHtml,
  getArtworkFailureMessage,
  getExplorerState,
  getPrefetchReadinessLabel,
  isArtworkJobFailed,
  isArtworkJobPending,
  isArtworkTargetReady,
  resolveOverlayTarget,
  retryArtwork,
  worldCountries
}) {
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
        <span class="region-rail-label">${escapeHtml(node.title)}</span>
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
    const state = getExplorerState();
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

  function getPrefetchTargetState(target) {
    if (isArtworkTargetReady(target)) {
      return { phase: "ready", label: "illustration ready" };
    }

    const job = getExplorerState().prefetchJobs.get(target.key);
    if (!job) {
      return { phase: "idle", label: "not started yet" };
    }

    if (isArtworkJobFailed(job)) {
      return { phase: "failed", label: getArtworkFailureMessage(job.error) };
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

  return { renderLoadingSceneBoard, renderRegionRail };
}

function orderArtworkTargetsByMapNumber(scene, targets) {
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

function findHotspotForTarget(scene, nodeId) {
  return (scene.hotspots ?? []).find(
    (hotspot) => hotspot.nodeId === nodeId || hotspot.action?.nodeId === nodeId
  );
}
