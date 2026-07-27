export function createExplorerController(dependencies) {
  const {
    APP_CONFIG,
    ENVIRONMENT_PLAN_PROMPT_VERSION,
    ENVIRONMENT_PLAN_REQUEST_RETRY_MS,
    ENVIRONMENT_PLAN_RETRY_DELAYS_MS,
    ENVIRONMENT_PLAN_SCHEMA_VERSION,
    applySceneLayoutCallback,
    apiPath,
    canonicalRouteForNode,
    clamp,
    clamp01,
    clearLoadingPanel,
    clearPendingJob,
    clearScrollStatus,
    elements,
    enterReadyPage,
    environmentPlanNeedsTargetRecovery,
    escapeHtml,
    explorerClient,
    factConfidenceLabel,
    fetchArtworkResource,
    findSceneIdForNode,
    generatedTiles,
    getArtworkFailureMessage,
    getContainedImageRect,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    getPageReadinessLabel,
    hasUnconfirmedNodeFacts,
    isArtworkJobPending,
    isArtworkTargetReady,
    isCurrentEnvironmentPlan,
    listNextArtworkDestinations,
    mergePrefetchedArtwork,
    normalizeEnvironmentPlan,
    prefetchNextDestinations,
    preloadArtworkImageCallback,
    render,
    renderEnvironmentLayerNodes,
    renderExplorerDetailPanel,
    renderImageGenerationPending,
    renderLoadingSceneBoard,
    renderLoadingPanel,
    renderRegionRail,
    renderScrollStatus,
    requestArtworkForCurrentPage,
    requestCurrentPageArtwork,
    requestSceneArtwork,
    resolveFlipbookClick,
    setBrowserPath,
    state,
    toApiUrl,
  } = dependencies;
  let environmentPlanEpoch = 0;
  let navigationRequestSequence = 0;
  let navigationAbortController = null;
  let sceneArtworkResizeObserver = null;
  let sceneImageOverlayLayoutFrame = null;

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
    const imageOverlayFrame = imageUrl
      ? renderSceneImageOverlayFrame([
          ...renderEnvironmentLayerNodes(scene, environmentPlan),
          ...renderImageTargetHotspots(environmentPlan, nodes)
        ])
      : null;
    canvas.replaceChildren(
      ...(displayImageUrl
        ? [renderSceneImage(displayImageUrl, scene.title, elements.stage, { isPreview: Boolean(previewImageUrl) })]
        : []),
      ...scene.tiles.map((tile) => renderTile(tile, scene.coordinateSpace)),
      ...(imageOverlayFrame ? [imageOverlayFrame] : [])
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
    observeSceneImageOverlayLayout(canvas);
    elements.viewport.querySelector(".region-rail")?.remove();
    if (imageUrl && nextDestinations.length) {
      elements.viewport.appendChild(renderRegionRail(scene, nodes, nextDestinations));
    }
    elements.stage.dataset.scene = scene.id;
    if (
      environmentUrl
      && (!environmentPlan || environmentPlanNeedsTargetRecovery(
        environmentPlan,
        getCurrentRequestPage(),
        state.activePack?.nodes
      ))
    ) {
      requestEnvironmentPlan(environmentUrl);
    }
    if (
      imageUrl
      && !environmentUrl
      && (pageNode?.childIds?.length ?? 0) > 0
    ) {
      promoteCurrentPageEnvironmentPlan(imageUrl);
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
  
  function renderSceneImageOverlayFrame(children) {
    const frame = document.createElement("div");
    frame.className = "scene-image-overlay-frame";
    frame.dataset.coordinateSpace = "rendered-artwork";
    frame.replaceChildren(...children);
    return frame;
  }
  
  function observeSceneImageOverlayLayout(canvas) {
    sceneArtworkResizeObserver?.disconnect();
    sceneArtworkResizeObserver = null;
    if (!canvas?.querySelector(".scene-image-overlay-frame")) return;
    if (typeof ResizeObserver === "function") {
      sceneArtworkResizeObserver = new ResizeObserver(scheduleSceneImageOverlayLayout);
      sceneArtworkResizeObserver.observe(canvas);
    }
    scheduleSceneImageOverlayLayout();
  }
  
  function scheduleSceneImageOverlayLayout() {
    if (sceneImageOverlayLayoutFrame !== null) {
      window.cancelAnimationFrame(sceneImageOverlayLayoutFrame);
    }
    sceneImageOverlayLayoutFrame = window.requestAnimationFrame(() => {
      sceneImageOverlayLayoutFrame = null;
      syncSceneImageOverlayLayout();
    });
  }
  
  function syncSceneImageOverlayLayout() {
    const canvas = elements.stage.querySelector(".scene-canvas");
    const image = canvas?.querySelector(".scene-image");
    const frame = canvas?.querySelector(".scene-image-overlay-frame");
    if (!canvas || !image || !frame || !image.naturalWidth || !image.naturalHeight) return;
  
    const canvasRect = canvas.getBoundingClientRect();
    const imageRect = getContainedImageRect(image);
    if (!canvasRect.width || !canvasRect.height || !imageRect.width || !imageRect.height) return;
  
    frame.style.left = `${((imageRect.left - canvasRect.left) / canvasRect.width) * 100}%`;
    frame.style.top = `${((imageRect.top - canvasRect.top) / canvasRect.height) * 100}%`;
    frame.style.width = `${(imageRect.width / canvasRect.width) * 100}%`;
    frame.style.height = `${(imageRect.height / canvasRect.height) * 100}%`;
  }
  
  function toScenePercent(value, total) {
    return `${(value / total) * 100}%`;
  }
  
  function canCurrentPageUseSceneArtwork(scene) {
    return state.currentPage.nodeId === scene.rootNodeId;
  }
  
  function normalizeArtworkUrl(imageUrl) {
    if (!imageUrl) return null;
    try {
      return new URL(imageUrl, window.location.origin).pathname;
    } catch {
      return String(imageUrl).split("?")[0].split("#")[0];
    }
  }
  
  function isSameArtworkUrl(leftUrl, rightUrl) {
    const left = normalizeArtworkUrl(leftUrl);
    const right = normalizeArtworkUrl(rightUrl);
    return Boolean(left && right && left === right);
  }
  
  function getSceneEnvironmentUrl(scene, imageUrl) {
    if (!imageUrl) return null;
    const sceneArtwork = state.artworkByScene.get(scene.id);
    const pageArtwork = state.artworkByPage.get(getPageArtworkCacheKey(state.currentPage));
    if (state.currentPage.sceneId === scene.id && isSameArtworkUrl(imageUrl, state.currentPage.imageUrl)) {
      return getPageEnvironmentUrl(state.currentPage);
    }
    if (isSameArtworkUrl(imageUrl, pageArtwork?.imageUrl)) {
      return pageArtwork.environmentUrl ?? getPageEnvironmentUrl(pageArtwork.page);
    }
    if (isSameArtworkUrl(imageUrl, sceneArtwork?.imageUrl)) {
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
    const isWaitingToRetry = cachedPlan?.status === "request_failed" && Date.now() < retryAt;
    const cachedPlanNeedsRecovery = cachedPlan?.status !== "request_failed"
      && environmentPlanNeedsTargetRecovery(
        cachedPlan,
        getCurrentRequestPage(),
        state.activePack?.nodes
      );
    if (
      !environmentUrl
      || state.environmentPlanRequests.has(environmentUrl)
      || isWaitingToRetry
      || (cachedPlan && cachedPlan.status !== "request_failed" && !cachedPlanNeedsRecovery)
    ) {
      return;
    }
  
    if (cachedPlan) {
      state.environmentPlans.delete(environmentUrl);
    }
  
    const requestEpoch = environmentPlanEpoch;
    let request;
    request = fetchEnvironmentPlanWithRetry(environmentUrl)
      .then((plan) => {
        if (requestEpoch !== environmentPlanEpoch) return;
        if (!plan) throw new Error("Environment plan is not ready");
        if (!isCurrentEnvironmentPlan(plan)) {
          // The illustration can outlive the VLM mapping contract in the runtime
          // cache. Ask the server to rebuild that exact page's mapping and never
          // paint the stale coordinates while it catches up.
          promoteCurrentPageEnvironmentPlan(state.currentPage?.imageUrl ?? environmentUrl);
          throw new Error("Environment plan is stale");
        }
        const normalizedPlan = normalizeEnvironmentPlan(plan);
        if (environmentPlanNeedsTargetRecovery(
          normalizedPlan,
          getCurrentRequestPage(),
          state.activePack?.nodes
        )) {
          // A fallback plan with no destination targets is not a successful VLM
          // mapping for an explorable page. Promote the current page so the
          // server regenerates its target map, then let the normal retry loop
          // fetch the replacement without hiding the illustration.
          promoteCurrentPageEnvironmentPlan(state.currentPage?.imageUrl ?? environmentUrl);
          throw new Error("Environment plan has no destination targets");
        }
        state.environmentPlans.set(environmentUrl, normalizedPlan);
      })
      .catch(() => {
        if (requestEpoch !== environmentPlanEpoch) return;
        const retryAt = Date.now() + ENVIRONMENT_PLAN_REQUEST_RETRY_MS;
        state.environmentPlans.set(environmentUrl, {
          version: ENVIRONMENT_PLAN_SCHEMA_VERSION,
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
  
  async function promoteCurrentPageEnvironmentPlan(imageUrl) {
    const requestPage = getCurrentRequestPage();
    const currentNode = state.activePack?.nodes?.[requestPage?.nodeId];
    if (!imageUrl || !requestPage?.nodeId || !(currentNode?.childIds?.length > 0)) return;
  
    const requestKey = `${state.activeCountrySlug}:${requestPage.sceneId}:${requestPage.nodeId}`;
    if (state.environmentPlanPromotions.has(requestKey)) return;
  
    const requestEpoch = environmentPlanEpoch;
    const expectedPageId = requestPage.id;
    const expectedNodeId = requestPage.nodeId;
    const params = new URLSearchParams({
      countrySlug: state.activeCountrySlug,
      sceneId: requestPage.sceneId,
      nodeId: requestPage.nodeId,
      priority: "interactive",
      quality: state.imageQuality
    });
  
    let request;
    request = fetchArtworkResource(apiPath(`/api/artwork?${params.toString()}`), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Target plan promotion failed: ${response.status}`);
        const { page } = await response.json();
        if (
          requestEpoch !== environmentPlanEpoch
          || state.currentPage?.id !== expectedPageId
          || state.currentPage?.nodeId !== expectedNodeId
        ) return;
  
        const environmentUrl = getPageEnvironmentUrl(page);
        if (!environmentUrl) throw new Error("Target plan promotion did not provide an environment URL");
        applyCurrentPageEnvironmentReference(page, environmentUrl);
        requestEnvironmentPlan(environmentUrl);
        render();
      })
      .catch(() => {
        // The current page remains fully usable. A later render can retry the
        // promotion without replacing its already-decoded illustration.
      })
      .finally(() => {
        if (state.environmentPlanPromotions.get(requestKey) === request) {
          state.environmentPlanPromotions.delete(requestKey);
        }
      });
  
    state.environmentPlanPromotions.set(requestKey, request);
  }
  
  function applyCurrentPageEnvironmentReference(page, environmentUrl) {
    const environmentStatus = page?.environmentStatus ?? page?.generated?.environmentStatus ?? "pending";
    state.currentPage = {
      ...state.currentPage,
      environmentUrl,
      environmentStatus,
      generated: {
        ...state.currentPage.generated,
        ...page.generated,
        environmentUrl,
        environmentStatus
      }
    };
  
    const scene = state.activePack?.scenes?.[state.currentPage.sceneId];
    const cache = scene && state.currentPage.nodeId === scene.rootNodeId
      ? state.artworkByScene
      : state.artworkByPage;
    const cacheKey = cache === state.artworkByScene
      ? scene.id
      : getPageArtworkCacheKey(state.currentPage);
    const cachedArtwork = cache.get(cacheKey);
    if (!cachedArtwork) return;
    cache.set(cacheKey, {
      ...cachedArtwork,
      environmentUrl,
      page: {
        ...cachedArtwork.page,
        environmentUrl,
        environmentStatus,
        generated: {
          ...cachedArtwork.page?.generated,
          ...page.generated,
          environmentUrl,
          environmentStatus
        }
      }
    });
  }
  
  async function fetchEnvironmentPlanWithRetry(environmentUrl) {
    for (let attempt = 0; attempt < ENVIRONMENT_PLAN_RETRY_DELAYS_MS.length; attempt += 1) {
      const delayMs = ENVIRONMENT_PLAN_RETRY_DELAYS_MS[attempt];
      if (delayMs > 0) {
        await waitFor(delayMs);
      }
  
      let plan;
      try {
        plan = await explorerClient.getEnvironmentPlan(environmentUrl);
      } catch (error) {
        const status = Number(error?.status);
        const canRetry = status === 202 || status === 404 || status === 409 || status === 425;
        if (canRetry) continue;
        throw error;
      }
      if (["pending", "queued", "processing"].includes(plan?.status)) continue;
      return plan;
    }
    return null;
  }
  
  function waitFor(delayMs) {
    return new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
  
  function renderImageTargetHotspots(environmentPlan, nodes) {
    const targets = Array.isArray(environmentPlan?.targets) ? environmentPlan.targets : [];
    return targets
      .filter((target) => target?.nodeId && nodes[target.nodeId] && target.visualBounds && target.labelBounds)
      .flatMap((target) => {
        const node = nodes[target.nodeId];
        return [
          renderImageTargetHotspot(target, node, target.visualBounds, "visual"),
          renderImageTargetHotspot(target, node, target.labelBounds, "label")
        ];
      });
  }
  
  function renderImageTargetHotspot(target, node, bounds, mode) {
    const { x, y, width, height } = bounds;
    const hit = document.createElement("button");
    const isActive = target.nodeId === state.selectedNodeId;
    hit.type = "button";
    hit.className = `image-target-hotspot image-target-hotspot--${mode}`;
    hit.classList.toggle("is-active", isActive);
    hit.dataset.targetMode = mode;
    if (isActive) hit.setAttribute("aria-current", "location");
    hit.setAttribute(
      "aria-label",
      mode === "visual" ? `Explore the ${node.title} area` : `Explore ${node.title}`
    );
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
      scheduleSceneImageOverlayLayout();
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
    }, APP_CONFIG.notifications.transientStatusDurationMs);
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
    return explorerClient.resolveFlipbookClick({
        currentPage: getCurrentRequestPage(),
        normalizedClick,
        imageClick,
        targetNodeId,
        detourPhrase,
        imageQuality: state.imageQuality
      }, { signal });
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
  
  function renderNodeDetail() {
    renderExplorerDetailPanel({
      detailSheet: elements.detailSheet,
      detailRoot: elements.nodeDetail,
      node: getDetailNode(),
      detailOverride: state.detailOverride,
      mode: state.detailPanelMode
    });
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
  
  function clearEnvironmentState(countrySlug) {
    environmentPlanEpoch += 1;
    state.environmentPlanPromotions.clear();
    const environmentPrefix = `/runtime-cache/${countrySlug}/environment/`;
    for (const environmentUrl of state.environmentPlans.keys()) {
      if (String(environmentUrl).includes(environmentPrefix)) state.environmentPlans.delete(environmentUrl);
    }
    for (const environmentUrl of state.environmentPlanRequests.keys()) {
      if (String(environmentUrl).includes(environmentPrefix)) state.environmentPlanRequests.delete(environmentUrl);
    }
  }
  return {
    renderScene,
    scheduleSceneImageOverlayLayout,
    canCurrentPageUseSceneArtwork,
    getPageEnvironmentUrl,
    requestEnvironmentPlan,
    promoteCurrentPageEnvironmentPlan,
    applyCurrentPageEnvironmentReference,
    preloadArtworkImage,
    bindPageClick,
    resolveOverlayTarget,
    cancelPendingNavigation,
    requestFlipbookPage,
    getCurrentRequestPage,
    isRuntimeArtworkPage,
    computeImageClick,
    runFlipbookResult,
    renderNodeDetail,
    renderDetour,
    endNavigationFeedback,
    explainClickError,
    clearEnvironmentState,
  };
}
