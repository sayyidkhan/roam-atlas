import { APP_CONFIG } from "../config/appConfig.js";

export type RootPage = {
  id: "root";
  countrySlug: string;
  sceneId: string;
  nodeId: string;
  imageUrl: null;
  parentId: null;
  parentClick: null;
  status: "ready";
};

type RootPagePack = {
  countrySlug: string;
  overviewSceneId: string;
  rootNodeId: string;
};

type LoadingStep = {
  label: string;
  state: string;
};

type LoadingTrail = {
  current: {
    phase: string;
    message: string;
    detail: string;
  };
  steps: LoadingStep[];
};

export type LoadingJob = {
  status: string;
};

export type RuntimePage = {
  id?: string;
  countrySlug?: string;
  sceneId: string | null;
  nodeId: string | null;
  imageUrl?: string | null;
  environmentUrl?: string | null;
  artworkDecoded?: boolean;
  parentId?: string | null;
  parentClick?: unknown;
  status?: string;
  plan?: {
    title: string;
    factMode: string;
  };
};

export type RuntimeNode = {
  title: string;
  facts?: unknown[];
  parentId?: string | null;
};

export type RuntimeScene = {
  id: string;
  rootNodeId: string;
};

export type RuntimePack = {
  countrySlug: string;
  overviewSceneId: string;
  rootNodeId: string;
  title: string;
  nodes: Record<string, RuntimeNode>;
  scenes: Record<string, RuntimeScene>;
};

type PendingJob = {
  intervalId?: number;
};

export type BrowserFeedbackState = {
  experienceConfig: { showLoadingSteps: boolean };
  pendingJob: PendingJob | null;
  history: Array<{ page: RuntimePage | null; nodeId: string | null }>;
  currentPage: RuntimePage | null;
  currentSceneId: string | null;
  selectedNodeId: string | null;
  detailOverride: unknown;
  detailPanelMode: string;
  activePack: RuntimePack | null;
  activeCountrySlug: string;
};

export type BrowserFeedbackElements = {
  viewport: HTMLElement;
};

type BrowserFeedbackDependencies = {
  buildLoadingStepTrail: (input: {
    job: LoadingJob;
    pageTitle?: string;
  }) => LoadingTrail;
  canonicalRouteForNode: (
    countrySlug: string,
    nodeId: string,
    pack: RuntimePack
  ) => string;
  elements: BrowserFeedbackElements;
  endNavigationFeedback: () => void;
  render: () => void;
  state: BrowserFeedbackState;
};

export type LoadingPanelOptions = {
  job?: LoadingJob | null;
  pageTitle?: string;
  fallbackMessage?: string;
};

export function apiPath(path: string): string {
  if (!window.location.origin.startsWith("http")) {
    throw new Error("RoamAtlas must be opened through the dev server, not as a local file.");
  }
  return path;
}

export function toApiUrl(path: string): string {
  if (String(path).startsWith("http")) return path;
  return apiPath(String(path).replace(/^\.\//, "/"));
}

export function fetchArtworkResource(
  resource: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  const timeoutMs = APP_CONFIG.artwork.requestTimeoutMs;
  const timeoutSignal = typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(timeoutMs)
    : createTimeoutAbortSignal(timeoutMs);
  const signal = options.signal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([options.signal, timeoutSignal])
    : options.signal ?? timeoutSignal;
  return fetch(resource, { ...options, signal });
}

export function createRootPage(pack: RootPagePack): RootPage {
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

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function setBrowserPath(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (window.location.pathname === path) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function createBrowserFeedbackController({
  buildLoadingStepTrail,
  canonicalRouteForNode,
  elements,
  endNavigationFeedback,
  render,
  state
}: BrowserFeedbackDependencies) {
  function renderLoadingPanel({ job = null, pageTitle, fallbackMessage }: LoadingPanelOptions): void {
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
      <div class="loading-panel-progress ${progressState}" aria-hidden="true"><span></span></div>
      <ol class="loading-panel-steps">
        ${trail.steps.map((step) => (
          `<li class="loading-panel-step loading-panel-step--${step.state}">${escapeHtml(step.label)}</li>`
        )).join("")}
      </ol>
    `;
  }

  function clearLoadingPanel() {
    elements.viewport.querySelector(".loading-panel")?.remove();
    clearScrollStatus();
  }

  function renderScrollStatus(message: string): void {
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

  function clearPendingJob() {
    if (state.pendingJob?.intervalId) window.clearInterval(state.pendingJob.intervalId);
    state.pendingJob = null;
    endNavigationFeedback();
  }

  function enterReadyPage(page: RuntimePage): void {
    clearPendingJob();
    if (state.currentPage) {
      state.history.push({ page: state.currentPage, nodeId: state.selectedNodeId });
    }
    state.currentPage = page;
    state.currentSceneId = page.sceneId;
    state.selectedNodeId = page.nodeId;
    state.detailOverride = null;
    const activePack = state.activePack;
    if (!activePack) throw new Error("Cannot enter a page without an active country pack.");
    const detailNode = page.nodeId && page.nodeId !== activePack.rootNodeId
      ? activePack.nodes[page.nodeId]
      : null;
    state.detailPanelMode = detailNode ? "compact" : "hidden";
    if (page.nodeId) {
      setBrowserPath(canonicalRouteForNode(state.activeCountrySlug, page.nodeId, activePack));
    }
    render();
  }

  return {
    clearLoadingPanel,
    clearPendingJob,
    clearScrollStatus,
    enterReadyPage,
    renderLoadingPanel,
    renderScrollStatus
  };
}

function createTimeoutAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(new Error("Artwork request timed out.")), timeoutMs);
  return controller.signal;
}
