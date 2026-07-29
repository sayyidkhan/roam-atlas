export type ApplicationLifecycle = {
  applyRoute: (pathname: string) => Promise<void>;
  bootstrap: () => Promise<void>;
  dispose: () => void;
};

export type ApplicationRuntimeLifecycle = {
  applyRoute: (pathname: string) => Promise<void>;
  start: () => Promise<() => void>;
};

export function createApplicationRuntimeLifecycle(
  lifecycle: ApplicationLifecycle
): ApplicationRuntimeLifecycle {
  let runtimeStart: Promise<void> | null = null;
  let routeRequest: Promise<void> | null = null;
  let lastRoutePathname: string | null = null;
  let consumers = 0;

  async function start(): Promise<() => void> {
    consumers += 1;
    let isReleased = false;
    const release = (): void => {
      if (isReleased) return;
      isReleased = true;
      consumers = Math.max(0, consumers - 1);
      if (consumers === 0) stop();
    };

    runtimeStart ??= lifecycle.bootstrap();
    try {
      await runtimeStart;
    } catch (error) {
      release();
      throw error;
    }
    return release;
  }

  async function applyRoute(pathname: string): Promise<void> {
    if (!runtimeStart) {
      throw new Error(
        "Application runtime must start before applying a route."
      );
    }
    await runtimeStart;
    if (
      pathname === lastRoutePathname &&
      routeRequest
    ) {
      await routeRequest;
      return;
    }

    lastRoutePathname = pathname;
    const request = lifecycle.applyRoute(pathname);
    routeRequest = request;
    try {
      await request;
    } catch (error) {
      if (lastRoutePathname === pathname) {
        lastRoutePathname = null;
        routeRequest = null;
      }
      throw error;
    }
  }

  function stop(): void {
    lifecycle.dispose();
    runtimeStart = null;
    routeRequest = null;
    lastRoutePathname = null;
  }

  return {
    applyRoute,
    start
  };
}
