import type {
  RuntimeNode,
  RuntimePage
} from "../../app/browserRuntime";
import type {
  ArtworkCacheEntry
} from "../artwork/artworkCacheTypes";
import type {
  ArtworkJob
} from "../artwork/artworkRuntimeTypes";
import type { ExplorerDestinationInput } from "./explorerDestinationController";
import type { DestinationScene } from "./explorerDestinationPolicy";
import type { ExplorerSceneInput } from "./explorerSceneController";
import type { SceneInput } from "./explorerScenePolicy";

type ExplorerNode = RuntimeNode & {
  childIds?: string[];
};

type ExplorerScene = SceneInput & DestinationScene & {
  pageType?: string;
  rootNodeId: string;
};

type ExplorerPage = RuntimePage;

type ExplorerPack = {
  nodes: Record<string, ExplorerNode>;
  scenes: Record<string, ExplorerScene>;
};

type CachedArtwork = ArtworkCacheEntry;

type EnvironmentPlan =
  NonNullable<ExplorerSceneInput["environmentPlan"]> &
    Record<string, unknown>;

type ExplorerSceneState = {
  activePack: ExplorerPack | null;
  artworkByPage: Map<string, ArtworkCacheEntry>;
  artworkByScene: Map<string, ArtworkCacheEntry>;
  artworkJobs: Map<string, ArtworkJob>;
  currentPage: ExplorerPage | null;
  currentSceneId: string | null;
  environmentPlans: Map<string, unknown>;
  experienceConfig: {
    maxParallelImageJobs: number;
  };
  selectedNodeId: string | null;
};

type ExplorerSceneOrchestratorDependencies = {
  environmentPlanNeedsTargetRecovery: (
    plan: unknown,
    page: ExplorerPage | null,
    nodes?: Record<string, ExplorerNode>
  ) => boolean;
  getCurrentRequestPage: () => ExplorerPage | null;
  getPageArtworkCacheKey: (
    page: ExplorerPage | null
  ) => string;
  getPageArtworkJobKey: (
    page: ExplorerPage | null
  ) => string;
  getPageEnvironmentUrl: (
    page: ExplorerPage | CachedArtwork | null | undefined
  ) => string | null;
  isArtworkJobPending: (job: ArtworkJob | null) => boolean;
  listNextArtworkDestinations: (input: {
    currentPage: ExplorerPage;
    limit: number;
    nodes: Record<string, ExplorerNode>;
    scene: ExplorerScene;
    scenes: Record<string, ExplorerScene>;
  }) => ExplorerDestinationInput["targets"];
  prefetchNextDestinations: () => void;
  promoteCurrentPageEnvironmentPlan: (
    imageUrl: string
  ) => void | Promise<void>;
  publishExplorerChromeContent: (content: {
    title: string;
  }) => void;
  publishExplorerDestinations: (
    input: ExplorerDestinationInput
  ) => void;
  publishExplorerScene: (input: ExplorerSceneInput) => void;
  requestCurrentPageArtwork: (options: {
    jobKind: "interactive";
  }) => void;
  requestEnvironmentPlan: (
    environmentUrl: string
  ) => void | Promise<void>;
  requestSceneArtwork: (
    sceneId: string,
    options: { jobKind: "interactive" }
  ) => void;
  state: ExplorerSceneState;
};

export function createExplorerSceneOrchestrator(
  dependencies: ExplorerSceneOrchestratorDependencies
) {
  const {
    environmentPlanNeedsTargetRecovery,
    getCurrentRequestPage,
    getPageArtworkCacheKey,
    getPageArtworkJobKey,
    getPageEnvironmentUrl,
    isArtworkJobPending,
    listNextArtworkDestinations,
    prefetchNextDestinations,
    promoteCurrentPageEnvironmentPlan,
    publishExplorerChromeContent,
    publishExplorerDestinations,
    publishExplorerScene,
    requestCurrentPageArtwork,
    requestEnvironmentPlan,
    requestSceneArtwork,
    state
  } = dependencies;

  function renderScene(): void {
    const pack = state.activePack;
    const currentPage = state.currentPage;
    const sceneId = state.currentSceneId;
    if (!pack || !currentPage || !sceneId) return;
    const scene = pack.scenes[sceneId];
    if (!scene) return;

    const pageNode = currentPage.nodeId
      ? pack.nodes[currentPage.nodeId]
      : null;
    const sceneArtwork = readCachedArtwork(
      state.artworkByScene.get(scene.id)
    );
    const pageArtwork = readCachedArtwork(
      state.artworkByPage.get(
        getPageArtworkCacheKey(currentPage)
      )
    );
    const pageTitle =
      currentPage.plan?.title ??
      pageNode?.title ??
      scene.title;
    const canUseSceneArtwork =
      canCurrentPageUseSceneArtwork(scene);
    const imageUrl =
      currentPage.sceneId === scene.id
        ? currentPage.imageUrl ??
          (canUseSceneArtwork
            ? sceneArtwork?.imageUrl
            : pageArtwork?.imageUrl) ??
          null
        : sceneArtwork?.imageUrl ?? null;
    publishExplorerChromeContent({
      title: pageTitle
    });

    const environmentUrl = getSceneEnvironmentUrl(
      scene,
      imageUrl
    );
    const environmentPlan = environmentUrl
      ? readEnvironmentPlan(
          state.environmentPlans.get(environmentUrl)
        )
      : null;
    const artworkJobKey = canUseSceneArtwork
      ? scene.id
      : getPageArtworkJobKey(currentPage);
    const artworkJob = readArtworkJob(
      state.artworkJobs.get(artworkJobKey)
    );
    const previewImageUrl = !imageUrl
      ? artworkJob?.decodedPartialImageUrl ?? null
      : null;
    const nextDestinations =
      listNextArtworkDestinations({
        scene,
        scenes: pack.scenes,
        nodes: pack.nodes,
        currentPage,
        limit: state.experienceConfig.maxParallelImageJobs
      });

    publishExplorerScene({
      displayImageUrl: imageUrl ?? previewImageUrl,
      environmentPlan,
      hasFinalArtwork: Boolean(imageUrl),
      isArtworkPending:
        !imageUrl && isArtworkJobPending(artworkJob),
      isPreview: Boolean(previewImageUrl),
      nodes: pack.nodes,
      pageTitle,
      scene,
      selectedNodeId: state.selectedNodeId
    });
    publishExplorerDestinations({
      artworkJobKey,
      isArtworkPending:
        !imageUrl && isArtworkJobPending(artworkJob),
      mode: !imageUrl
        ? "loading"
        : nextDestinations.length
          ? "rail"
          : "hidden",
      nodes: pack.nodes,
      pageTitle,
      scene,
      targets: nextDestinations
    });

    if (
      environmentUrl &&
      (!environmentPlan ||
        environmentPlanNeedsTargetRecovery(
          environmentPlan,
          getCurrentRequestPage(),
          pack.nodes
        ))
    ) {
      void requestEnvironmentPlan(environmentUrl);
    }
    if (
      imageUrl &&
      !environmentUrl &&
      (pageNode?.childIds?.length ?? 0) > 0
    ) {
      void promoteCurrentPageEnvironmentPlan(imageUrl);
    }
    if (!imageUrl && !state.artworkJobs.has(artworkJobKey)) {
      if (canUseSceneArtwork) {
        requestSceneArtwork(scene.id, {
          jobKind: "interactive"
        });
      } else {
        requestCurrentPageArtwork({
          jobKind: "interactive"
        });
      }
    }
    prefetchNextDestinations();
  }

  function canCurrentPageUseSceneArtwork(
    scene: ExplorerScene
  ): boolean {
    return state.currentPage?.nodeId === scene.rootNodeId;
  }

  function getSceneEnvironmentUrl(
    scene: ExplorerScene,
    imageUrl: string | null | undefined
  ): string | null {
    if (!imageUrl) return null;
    const currentPage = state.currentPage;
    if (!currentPage) return null;
    const sceneArtwork = readCachedArtwork(
      state.artworkByScene.get(scene.id)
    );
    const pageArtwork = readCachedArtwork(
      state.artworkByPage.get(
        getPageArtworkCacheKey(currentPage)
      )
    );
    if (
      currentPage.sceneId === scene.id &&
      isSameArtworkUrl(imageUrl, currentPage.imageUrl)
    ) {
      return getPageEnvironmentUrl(currentPage);
    }
    if (
      isSameArtworkUrl(imageUrl, pageArtwork?.imageUrl)
    ) {
      return (
        pageArtwork?.environmentUrl ??
        getPageEnvironmentUrl(pageArtwork?.page)
      );
    }
    if (
      isSameArtworkUrl(imageUrl, sceneArtwork?.imageUrl)
    ) {
      return (
        sceneArtwork?.environmentUrl ??
        getPageEnvironmentUrl(sceneArtwork?.page)
      );
    }
    return null;
  }

  return {
    canCurrentPageUseSceneArtwork,
    renderScene
  };
}

export function isSameArtworkUrl(
  leftUrl: string | null | undefined,
  rightUrl: string | null | undefined
): boolean {
  const left = normalizeArtworkUrl(leftUrl);
  const right = normalizeArtworkUrl(rightUrl);
  return Boolean(left && right && left === right);
}

export function normalizeArtworkUrl(
  imageUrl: string | null | undefined
): string | null {
  if (!imageUrl) return null;
  try {
    return new URL(imageUrl, window.location.origin).pathname;
  } catch {
    return String(imageUrl).split("?")[0].split("#")[0];
  }
}

function readArtworkJob(value: unknown): ArtworkJob | null {
  return value && typeof value === "object"
    ? (value as ArtworkJob)
    : null;
}

function readCachedArtwork(
  value: unknown
): CachedArtwork | null {
  return value && typeof value === "object"
    ? (value as CachedArtwork)
    : null;
}

function readEnvironmentPlan(
  value: unknown
): EnvironmentPlan | null {
  return value && typeof value === "object"
    ? (value as EnvironmentPlan)
    : null;
}
