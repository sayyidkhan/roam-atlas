import { composeApplicationRuntime } from "./applicationRuntimeComposition";
import { createApplicationRuntimeLifecycle } from "./applicationRuntimeLifecycle";

const applicationRuntimeLifecycle =
  createApplicationRuntimeLifecycle(
    composeApplicationRuntime()
  );

export function startApplicationRuntime(): Promise<
  () => void
> {
  return applicationRuntimeLifecycle.start();
}

export function applyApplicationRuntimeRoute(
  pathname: string
): Promise<void> {
  return applicationRuntimeLifecycle.applyRoute(pathname);
}
