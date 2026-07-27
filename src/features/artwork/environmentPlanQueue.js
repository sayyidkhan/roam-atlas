import path from "node:path";

import {
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_SCHEMA_VERSION
} from "../../lib/prompts/buildEnvironmentPlanPrompt.js";
import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.js";

export function createEnvironmentPlanQueue({
  jobRepository,
  createEnvironmentPlan,
  createFallbackPlan,
  hasExpectedTargets,
  isPathBeingFlushed,
  logger = console
}) {
  const pendingPlans = new Map();
  let processorActive = false;
  let activeTask = null;

  async function ensurePlan(
    page,
    paths,
    { signal = null, jobPath = paths.environmentPath } = {}
  ) {
    if (!page?.imageUrl) return null;
    throwIfAborted(signal);
    const existing = await findMatchingPlan(page, paths);
    if (existing) return existing;

    let plan;
    try {
      plan = await createEnvironmentPlan(page, { signal });
    } catch (error) {
      throwIfAborted(signal);
      plan = createFallbackPlan(page, String(error?.message ?? error));
    }
    throwIfAborted(signal);
    await jobRepository.writeJsonArtifact(
      paths.environmentPath,
      plan,
      jobPath
    );
    return plan;
  }

  async function findMatchingPlan(page, paths) {
    const existing = await jobRepository.readEnvironment(
      paths.environmentPath
    );
    return (
      existing?.version === ENVIRONMENT_PLAN_SCHEMA_VERSION &&
      existing.promptVersion === ENVIRONMENT_PLAN_PROMPT_VERSION &&
      existing.imageUrl === page.imageUrl &&
      hasExpectedTargets(page, existing)
    )
      ? existing
      : null;
  }

  function queuePlan({ page, paths, jobPath }) {
    if (
      !page?.imageUrl ||
      pendingPlans.has(paths.environmentPath) ||
      isPathBeingFlushed(paths.environmentPath)
    ) {
      return;
    }
    pendingPlans.set(paths.environmentPath, { page, paths, jobPath });
    scheduleProcessing();
  }

  function cancelForCountry(countryCacheRoot) {
    const activeRuns = [];
    for (const [environmentPath] of pendingPlans) {
      if (isPathInside(countryCacheRoot, path.normalize(environmentPath))) {
        pendingPlans.delete(environmentPath);
      }
    }
    if (
      activeTask &&
      isPathInside(
        countryCacheRoot,
        path.normalize(activeTask.environmentPath)
      )
    ) {
      activeTask.controller.abort(
        new Error(
          "Environment analysis cancelled because its country runtime cache was flushed."
        )
      );
      activeRuns.push(activeTask.done);
    }
    return activeRuns;
  }

  function scheduleProcessing(delayMs = 250) {
    if (processorActive) return;
    setTimeout(() => {
      processNext().catch((error) => {
        logger.error("Environment plan processing failed:", error);
      });
    }, delayMs);
  }

  async function processNext() {
    if (processorActive || pendingPlans.size === 0) return;
    const [environmentPath, task] = pendingPlans.entries().next().value;
    pendingPlans.delete(environmentPath);
    processorActive = true;
    const controller = new AbortController();
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    });
    activeTask = { environmentPath, controller, done };
    try {
      await updateReadyJob(task.jobPath, task.page.imageUrl, {
        environmentUrl: task.paths.environmentUrl,
        environmentStatus: "processing",
        environmentProcessingStartedAt: new Date().toISOString()
      });
      const plan = await ensurePlan(task.page, task.paths, {
        signal: controller.signal,
        jobPath: task.jobPath
      });
      await updateReadyJob(task.jobPath, task.page.imageUrl, {
        environmentUrl: task.paths.environmentUrl,
        environmentStatus: plan?.status ?? "fallback",
        environmentCompletedAt: new Date().toISOString()
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        await updateReadyJob(task.jobPath, task.page.imageUrl, {
          environmentUrl: task.paths.environmentUrl,
          environmentStatus: "failed",
          environmentError: String(error?.message ?? error),
          environmentFailedAt: new Date().toISOString()
        });
      }
    } finally {
      if (activeTask?.done === done) activeTask = null;
      resolveDone();
      processorActive = false;
      if (pendingPlans.size > 0) scheduleProcessing();
    }
  }

  async function updateReadyJob(jobPath, imageUrl, patch) {
    const currentJob = await jobRepository.readJob(jobPath);
    if (
      currentJob?.status !== "ready" ||
      currentJob.imageUrl !== imageUrl
    ) {
      return false;
    }
    await jobRepository.writeJob(jobPath, { ...currentJob, ...patch });
    return true;
  }

  return {
    ensurePlan,
    findMatchingPlan,
    queuePlan,
    cancelForCountry
  };
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("Operation aborted.");
  }
}
