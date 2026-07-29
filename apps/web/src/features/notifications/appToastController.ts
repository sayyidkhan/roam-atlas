import {
  appToastBridge,
  type AppToastOptions
} from "./appToastBridge";

export type { AppToastOptions } from "./appToastBridge";

type AppToastControllerDependencies = {
  defaultDurationMs: number;
};

/**
 * Owns transient notification timing while React owns presentation.
 */
export function createAppToastController({
  defaultDurationMs
}: AppToastControllerDependencies) {
  let timer: number | null = null;

  function show({
    title,
    message,
    tone = "success",
    durationMs = defaultDurationMs
  }: AppToastOptions): void {
    clearTimer();
    appToastBridge.publish({
      commands: { dismiss },
      message: String(message),
      title: String(title),
      tone
    });
    timer = window.setTimeout(dismiss, durationMs);
  }

  function dismiss(): void {
    clearTimer();
    appToastBridge.clear();
  }

  function clearTimer(): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  return { dismiss, show };
}
