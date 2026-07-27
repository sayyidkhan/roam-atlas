export function createArtworkController(dependencies) {
  const {
    APP_CONFIG,
    ARTWORK_POLL_INTERVAL_MS,
    ARTWORK_POLL_MAX_ATTEMPTS,
    ARTWORK_POLL_TIMEOUT_MS,
    ARTWORK_REQUEST_TIMEOUT_MS,
    applyCurrentPageEnvironmentReference,
    apiPath,
    canCurrentPageUseSceneArtwork,
    clearLoadingPanel,
    clearPendingJob,
    createRootPage,
    elements,
    enterReadyPage,
    explainClickError,
    explorerClient,
    fetchArtworkResource,
    fetchExperienceConfig,
    getArtworkFailureMessage,
    getCurrentRequestPage,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    getPageEnvironmentUrl,
    getPrefetchDestinationLimitCallback,
    hasStoredImageQualityPreference,
    isArtworkJobFailed,
    isArtworkJobPending,
    isRuntimeArtworkPage,
    listNextArtworkDestinations,
    loadExperienceConfigClient,
    mergePrefetchedArtworkCallback,
    prefetchNextDestinationsCallback,
    preloadArtworkImage,
    promoteCurrentPageEnvironmentPlan,
    render,
    renderScene,
    renderScrollStatus,
    requestEnvironmentPlan,
    requestFlipbookPage,
    resolveFlipbookClick,
    normalizeImageQuality,
    state,
    storeArtworkCacheCallback,
    toApiUrl,
  } = dependencies;
  const prefetchPollers = new Map();
  let prefetchRenderFrame = null;
  let prefetchEpoch = 0;
  let artworkAttemptSequence = 0;

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
        sceneId,
        quality: state.imageQuality
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
        nodeId: page.nodeId,
        quality: state.imageQuality
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
      state.experienceConfig = await fetchExperienceConfig({
        fetchFn: (path, options) => fetch(apiPath(path), options)
      });
      if (!hasStoredImageQualityPreference()) {
        state.imageQuality = normalizeImageQuality(state.experienceConfig.defaultImageQuality);
      }
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
      prefetch: "priority",
      quality: state.imageQuality
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
  
  return {
    requestSceneArtwork,
    requestCurrentPageArtwork,
    stopArtworkPoller,
    renderImageGenerationPending,
    requestArtworkForCurrentPage,
    retryArtwork,
    loadExperienceConfig,
    prefetchNextDestinations,
    resetPrefetchForSceneChange,
    invalidatePrefetchState,
    isArtworkTargetReady,
    getPrefetchReadinessLabel,
    mergePrefetchedArtwork,
  };
}
