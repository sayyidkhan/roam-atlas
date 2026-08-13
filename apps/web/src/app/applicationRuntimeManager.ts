import type {
  ApplicationRuntimeLifecycle
} from "./applicationRuntimeLifecycle";

type ApplicationRuntimeLifecycleFactory =
  () => ApplicationRuntimeLifecycle;

export function createApplicationRuntimeManager(
  createLifecycle: ApplicationRuntimeLifecycleFactory
) {
  let activeLifecycle: ApplicationRuntimeLifecycle | null =
    null;
  let consumers = 0;

  async function start(): Promise<() => void> {
    const lifecycle =
      activeLifecycle ?? (activeLifecycle = createLifecycle());
    consumers += 1;

    try {
      const releaseLifecycle = await lifecycle.start();
      let isReleased = false;

      return () => {
        if (isReleased) return;
        isReleased = true;
        releaseLifecycle();
        consumers = Math.max(0, consumers - 1);

        if (
          consumers === 0 &&
          activeLifecycle === lifecycle
        ) {
          activeLifecycle = null;
        }
      };
    } catch (error) {
      consumers = Math.max(0, consumers - 1);
      if (
        consumers === 0 &&
        activeLifecycle === lifecycle
      ) {
        activeLifecycle = null;
      }
      throw error;
    }
  }

  function applyRoute(pathname: string): Promise<void> {
    if (!activeLifecycle) {
      return Promise.reject(
        new Error(
          "Application runtime must start before applying a route."
        )
      );
    }
    return activeLifecycle.applyRoute(pathname);
  }

  return {
    applyRoute,
    start
  };
}
