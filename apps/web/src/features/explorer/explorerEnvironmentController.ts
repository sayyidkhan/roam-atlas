import { createExplorerEnvironmentPromotionController } from "./explorerEnvironmentPromotionController";
import { getPageEnvironmentUrl } from "./explorerEnvironmentPagePolicy";
import type {
  EnvironmentControllerDependencies,
  EnvironmentPlan
} from "./explorerEnvironmentTypes";

export function createExplorerEnvironmentController(
  dependencies: EnvironmentControllerDependencies
) {
  const {
    ENVIRONMENT_PLAN_REQUEST_RETRY_MS,
    ENVIRONMENT_PLAN_RETRY_DELAYS_MS,
    ENVIRONMENT_PLAN_SCHEMA_VERSION,
    apiPath,
    environmentPlanNeedsTargetRecovery,
    explorerClient,
    fetchArtworkResource,
    getCurrentRequestPage,
    getPageArtworkCacheKey,
    isCurrentEnvironmentPlan,
    normalizeEnvironmentPlan,
    render,
    state
  } = dependencies;
  let environmentPlanEpoch = 0;

  const environmentPromotionController =
    createExplorerEnvironmentPromotionController({
      apiPath,
      fetchArtworkResource,
      getCurrentEpoch: () => environmentPlanEpoch,
      getCurrentRequestPage,
      getPageArtworkCacheKey,
      getPageEnvironmentUrl,
      render,
      requestEnvironmentPlan,
      state
    });
  const {
    applyCurrentPageEnvironmentReference,
    promoteCurrentPageEnvironmentPlan
  } = environmentPromotionController;

  async function requestEnvironmentPlan(
    environmentUrl: string | null | undefined
  ): Promise<void> {
    if (!environmentUrl) return;
    const cachedPlan =
      state.environmentPlans.get(environmentUrl);
    const retryAt = Number(cachedPlan?.retryAt ?? 0);
    const isWaitingToRetry =
      cachedPlan?.status === "request_failed" &&
      Date.now() < retryAt;
    const cachedPlanNeedsRecovery =
      cachedPlan?.status !== "request_failed" &&
      Boolean(
        cachedPlan &&
          environmentPlanNeedsTargetRecovery(
            cachedPlan,
            getCurrentRequestPage(),
            state.activePack?.nodes
          )
      );
    if (
      state.environmentPlanRequests.has(environmentUrl) ||
      isWaitingToRetry ||
      (cachedPlan &&
        cachedPlan.status !== "request_failed" &&
        !cachedPlanNeedsRecovery)
    ) {
      return;
    }
    if (cachedPlan) {
      state.environmentPlans.delete(environmentUrl);
    }

    const requestEpoch = environmentPlanEpoch;
    const request = fetchEnvironmentPlanWithRetry(
      environmentUrl
    )
      .then((plan) => {
        if (requestEpoch !== environmentPlanEpoch) return;
        if (!plan) {
          throw new Error("Environment plan is not ready");
        }
        if (!isCurrentEnvironmentPlan(plan)) {
          void promoteCurrentPageEnvironmentPlan(
            state.currentPage?.imageUrl ?? environmentUrl
          );
          throw new Error("Environment plan is stale");
        }
        const normalizedPlan =
          normalizeEnvironmentPlan(plan);
        if (
          environmentPlanNeedsTargetRecovery(
            normalizedPlan,
            getCurrentRequestPage(),
            state.activePack?.nodes
          )
        ) {
          void promoteCurrentPageEnvironmentPlan(
            state.currentPage?.imageUrl ?? environmentUrl
          );
          throw new Error(
            "Environment plan has no destination targets"
          );
        }
        state.environmentPlans.set(
          environmentUrl,
          normalizedPlan
        );
      })
      .catch(() => {
        if (requestEpoch !== environmentPlanEpoch) return;
        const retryAt =
          Date.now() + ENVIRONMENT_PLAN_REQUEST_RETRY_MS;
        state.environmentPlans.set(environmentUrl, {
          version: ENVIRONMENT_PLAN_SCHEMA_VERSION,
          status: "request_failed",
          retryAt,
          targets: [],
          layers: []
        });
        window.setTimeout(() => {
          if (requestEpoch !== environmentPlanEpoch) return;
          const failedPlan =
            state.environmentPlans.get(environmentUrl);
          if (
            failedPlan?.status !== "request_failed" ||
            Number(failedPlan.retryAt ?? 0) > Date.now()
          ) {
            return;
          }
          state.environmentPlans.delete(environmentUrl);
          void requestEnvironmentPlan(environmentUrl);
        }, ENVIRONMENT_PLAN_REQUEST_RETRY_MS);
      })
      .finally(() => {
        if (
          state.environmentPlanRequests.get(environmentUrl) ===
          request
        ) {
          state.environmentPlanRequests.delete(environmentUrl);
        }
        if (
          requestEpoch === environmentPlanEpoch &&
          state.currentView === "explorer"
        ) {
          render();
        }
      });
    state.environmentPlanRequests.set(environmentUrl, request);
    await request;
  }

  async function fetchEnvironmentPlanWithRetry(
    environmentUrl: string
  ): Promise<EnvironmentPlan | null> {
    for (
      let attempt = 0;
      attempt < ENVIRONMENT_PLAN_RETRY_DELAYS_MS.length;
      attempt += 1
    ) {
      const delayMs =
        ENVIRONMENT_PLAN_RETRY_DELAYS_MS[attempt] ?? 0;
      if (delayMs > 0) await waitFor(delayMs);
      try {
        const plan =
          await explorerClient.getEnvironmentPlan(
            environmentUrl
          );
        if (
          ["pending", "queued", "processing"].includes(
            plan?.status ?? ""
          )
        ) {
          continue;
        }
        return plan;
      } catch (error) {
        const status = getErrorStatus(error);
        if ([202, 404, 409, 425].includes(status)) continue;
        throw error;
      }
    }
    return null;
  }

  function clearEnvironmentState(
    countrySlug: string
  ): void {
    environmentPlanEpoch += 1;
    state.environmentPlanPromotions.clear();
    const environmentPrefix =
      `/runtime-cache/${countrySlug}/environment/`;
    for (const environmentUrl of state.environmentPlans.keys()) {
      if (
        String(environmentUrl).includes(environmentPrefix)
      ) {
        state.environmentPlans.delete(environmentUrl);
      }
    }
    for (const environmentUrl of state.environmentPlanRequests.keys()) {
      if (
        String(environmentUrl).includes(environmentPrefix)
      ) {
        state.environmentPlanRequests.delete(environmentUrl);
      }
    }
  }

  return {
    applyCurrentPageEnvironmentReference,
    clearEnvironmentState,
    getPageEnvironmentUrl,
    promoteCurrentPageEnvironmentPlan,
    requestEnvironmentPlan
  };
}

function getErrorStatus(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  ) {
    return Number(error.status);
  }
  return 0;
}

function waitFor(delayMs: number): Promise<void> {
  return new Promise((resolve) =>
    window.setTimeout(resolve, delayMs)
  );
}
