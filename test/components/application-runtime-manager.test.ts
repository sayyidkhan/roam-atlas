import { describe, expect, it, vi } from "vitest";

import type {
  ApplicationRuntimeLifecycle
} from "../../apps/web/src/app/applicationRuntimeLifecycle";
import { createApplicationRuntimeManager } from "../../apps/web/src/app/applicationRuntimeManager";

function createLifecycle(): ApplicationRuntimeLifecycle {
  return {
    applyRoute: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(vi.fn())
  };
}

describe("application runtime manager", () => {
  it("rebuilds the DOM-bound lifecycle after the last host releases it", async () => {
    const firstLifecycle = createLifecycle();
    const secondLifecycle = createLifecycle();
    const lifecycleFactory = vi
      .fn()
      .mockReturnValueOnce(firstLifecycle)
      .mockReturnValueOnce(secondLifecycle);
    const manager = createApplicationRuntimeManager(
      lifecycleFactory
    );

    const releaseFirst = await manager.start();
    await manager.applyRoute("/argentina/config");
    releaseFirst();

    const releaseSecond = await manager.start();
    await manager.applyRoute("/singapore");

    expect(lifecycleFactory).toHaveBeenCalledTimes(2);
    expect(firstLifecycle.applyRoute).toHaveBeenCalledWith(
      "/argentina/config"
    );
    expect(secondLifecycle.applyRoute).toHaveBeenCalledWith(
      "/singapore"
    );

    releaseSecond();
  });
});
