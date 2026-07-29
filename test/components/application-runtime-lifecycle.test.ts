import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { createApplicationRuntimeLifecycle } from "../../apps/web/src/app/applicationRuntimeLifecycle";

describe("application runtime lifecycle", () => {
  it("shares one bootstrap across consumers and disposes after the final release", async () => {
    const lifecycle = {
      applyRoute: vi.fn(async () => {}),
      bootstrap: vi.fn(async () => {}),
      dispose: vi.fn()
    };
    const runtime =
      createApplicationRuntimeLifecycle(lifecycle);

    const releaseFirst = await runtime.start();
    const releaseSecond = await runtime.start();

    expect(lifecycle.bootstrap).toHaveBeenCalledTimes(1);
    releaseFirst();
    expect(lifecycle.dispose).not.toHaveBeenCalled();
    releaseSecond();
    expect(lifecycle.dispose).toHaveBeenCalledTimes(1);

    const releaseRestarted = await runtime.start();
    expect(lifecycle.bootstrap).toHaveBeenCalledTimes(2);
    releaseRestarted();
  });

  it("rejects route application until bootstrap has started", async () => {
    const runtime = createApplicationRuntimeLifecycle({
      applyRoute: vi.fn(async () => {}),
      bootstrap: vi.fn(async () => {}),
      dispose: vi.fn()
    });

    await expect(
      runtime.applyRoute("/singapore")
    ).rejects.toThrow(
      "Application runtime must start before applying a route."
    );
  });

  it("deduplicates concurrent requests for the same pathname", async () => {
    let resolveRoute: (() => void) | undefined;
    const routePending = new Promise<void>((resolve) => {
      resolveRoute = resolve;
    });
    const lifecycle = {
      applyRoute: vi.fn(() => routePending),
      bootstrap: vi.fn(async () => {}),
      dispose: vi.fn()
    };
    const runtime =
      createApplicationRuntimeLifecycle(lifecycle);
    const release = await runtime.start();

    const first = runtime.applyRoute("/singapore");
    const second = runtime.applyRoute("/singapore");
    await Promise.resolve();
    expect(lifecycle.applyRoute).toHaveBeenCalledTimes(1);
    resolveRoute?.();
    await Promise.all([first, second]);
    release();
  });

  it("allows a failed route to be retried", async () => {
    const lifecycle = {
      applyRoute: vi
        .fn()
        .mockRejectedValueOnce(new Error("route failed"))
        .mockResolvedValueOnce(undefined),
      bootstrap: vi.fn(async () => {}),
      dispose: vi.fn()
    };
    const runtime =
      createApplicationRuntimeLifecycle(lifecycle);
    const release = await runtime.start();

    await expect(
      runtime.applyRoute("/singapore")
    ).rejects.toThrow("route failed");
    await expect(
      runtime.applyRoute("/singapore")
    ).resolves.toBeUndefined();
    expect(lifecycle.applyRoute).toHaveBeenCalledTimes(2);
    release();
  });
});
