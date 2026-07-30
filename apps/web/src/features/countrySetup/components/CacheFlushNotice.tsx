import type {
  CountryRuntimeCacheState
} from "../../runtimeCache/runtimeCacheTypes";

export function CacheFlushNotice({
  state
}: {
  state: CountryRuntimeCacheState | null;
}) {
  if (
    !state ||
    !["loading", "failed"].includes(state.status)
  ) {
    return null;
  }
  const visualsOnly = state.scope === "visuals";
  const title =
    state.status === "failed"
      ? visualsOnly
        ? "Visual reset failed"
        : "Runtime reset failed"
      : visualsOnly
        ? "Resetting generated visuals"
        : "Resetting runtime artifacts";
  const message =
    state.message ??
    (visualsOnly
      ? "Clearing generated images and visual cache."
      : "Clearing generated runtime artifacts.");

  return (
    <section
      className={
        state.status === "failed"
          ? "cache-flush-notice cache-flush-notice--failed"
          : "cache-flush-notice"
      }
      aria-live="polite"
    >
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  );
}
