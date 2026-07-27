/**
 * Renders and hydrates non-factual reference photos in the starter-map tree.
 * The caller supplies URL building so this view cannot choose sources or make
 * factual claims about a place.
 */
export function createDraftReferencePhotoView({
  buildPlaceImageUrl,
  clamp01,
  escapeHtml,
  renderReadyMark,
  photoTimeoutMs = 90_000
}) {
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
          <span class="draft-photo-ready" aria-hidden="true">${renderReadyMark()}</span>
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
        settle(() => retryDraftPlacePhoto(root, button, image, src, "Retrying search"));
      }, photoTimeoutMs));

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
        settle(() => retryDraftPlacePhoto(root, button, image, src, "Retrying"));
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
      return `${parsed.origin}${parsed.pathname}${parsed.search}`.toLowerCase();
    } catch {
      return String(value ?? "").trim().toLowerCase();
    }
  }

  return { renderDraftPlacePhoto, hydrateDraftPlacePhotos };
}
