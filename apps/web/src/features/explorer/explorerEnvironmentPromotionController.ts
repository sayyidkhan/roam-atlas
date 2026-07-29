import type {
  ExplorerEnvironmentPage,
  ExplorerEnvironmentState
} from "./explorerEnvironmentTypes";

type EnvironmentPromotionDependencies = {
  apiPath: (path: string) => string;
  fetchArtworkResource: (
    resource: RequestInfo | URL,
    options?: RequestInit
  ) => Promise<Response>;
  getCurrentEpoch: () => number;
  getCurrentRequestPage: () => ExplorerEnvironmentPage | null;
  getPageArtworkCacheKey: (
    page: ExplorerEnvironmentPage | null
  ) => string;
  getPageEnvironmentUrl: (
    page: ExplorerEnvironmentPage | null | undefined
  ) => string | null;
  render: () => void;
  requestEnvironmentPlan: (
    environmentUrl: string | null | undefined
  ) => Promise<void>;
  state: ExplorerEnvironmentState;
};

export function createExplorerEnvironmentPromotionController(
  dependencies: EnvironmentPromotionDependencies
) {
  const {
    apiPath,
    fetchArtworkResource,
    getCurrentEpoch,
    getCurrentRequestPage,
    getPageArtworkCacheKey,
    getPageEnvironmentUrl,
    render,
    requestEnvironmentPlan,
    state
  } = dependencies;

  async function promoteCurrentPageEnvironmentPlan(
    imageUrl: string | null | undefined
  ): Promise<void> {
    const requestPage = getCurrentRequestPage();
    const currentNode =
      requestPage?.nodeId && state.activePack
        ? state.activePack.nodes[requestPage.nodeId]
        : null;
    if (
      !imageUrl ||
      !requestPage?.nodeId ||
      !requestPage.sceneId ||
      !currentNode?.childIds?.length
    ) {
      return;
    }
    const requestKey = `${state.activeCountrySlug}:${requestPage.sceneId}:${requestPage.nodeId}`;
    if (state.environmentPlanPromotions.has(requestKey)) return;

    const requestEpoch = getCurrentEpoch();
    const expectedPageId = requestPage.id;
    const expectedNodeId = requestPage.nodeId;
    const params = new URLSearchParams({
      countrySlug: state.activeCountrySlug,
      sceneId: requestPage.sceneId,
      nodeId: requestPage.nodeId,
      priority: "interactive",
      quality: state.imageQuality
    });
    const request = fetchArtworkResource(
      apiPath(`/api/artwork?${params.toString()}`),
      { cache: "no-store" }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Target plan promotion failed: ${response.status}`
          );
        }
        const { page } = (await response.json()) as {
          page: ExplorerEnvironmentPage;
        };
        if (
          requestEpoch !== getCurrentEpoch() ||
          state.currentPage?.id !== expectedPageId ||
          state.currentPage?.nodeId !== expectedNodeId
        ) {
          return;
        }
        const environmentUrl = getPageEnvironmentUrl(page);
        if (!environmentUrl) {
          throw new Error(
            "Target plan promotion did not provide an environment URL"
          );
        }
        applyCurrentPageEnvironmentReference(
          page,
          environmentUrl
        );
        void requestEnvironmentPlan(environmentUrl);
        render();
      })
      .catch(() => {
        // The decoded illustration remains usable; later renders may retry.
      })
      .finally(() => {
        if (
          state.environmentPlanPromotions.get(requestKey) ===
          request
        ) {
          state.environmentPlanPromotions.delete(requestKey);
        }
      });
    state.environmentPlanPromotions.set(requestKey, request);
    await request;
  }

  function applyCurrentPageEnvironmentReference(
    page: ExplorerEnvironmentPage,
    environmentUrl: string
  ): void {
    if (!state.currentPage) return;
    const environmentStatus =
      page.environmentStatus ??
      page.generated?.environmentStatus ??
      "pending";
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
    const scene =
      state.currentPage.sceneId && state.activePack
        ? state.activePack.scenes[state.currentPage.sceneId]
        : null;
    const cache =
      scene && state.currentPage.nodeId === scene.rootNodeId
        ? state.artworkByScene
        : state.artworkByPage;
    const cacheKey =
      cache === state.artworkByScene
        ? scene?.id
        : getPageArtworkCacheKey(state.currentPage);
    if (!cacheKey) return;
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

  return {
    applyCurrentPageEnvironmentReference,
    promoteCurrentPageEnvironmentPlan
  };
}
