import { composeApplicationRuntime } from "./applicationRuntimeComposition";
import { createApplicationRuntimeLifecycle } from "./applicationRuntimeLifecycle";
import { createApplicationRuntimeManager } from "./applicationRuntimeManager";

const applicationRuntimeManager =
  createApplicationRuntimeManager(() =>
    createApplicationRuntimeLifecycle(
      composeApplicationRuntime()
    )
  );

export function startApplicationRuntime(): Promise<
  () => void
> {
  return applicationRuntimeManager.start();
}

export function applyApplicationRuntimeRoute(
  pathname: string
): Promise<void> {
  return applicationRuntimeManager.applyRoute(pathname);
}
